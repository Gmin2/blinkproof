import { execFile } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

export const BOARDS = {
  uno: { image: 'bp-avr', fqbn: 'arduino:avr:uno' },
  nano: { image: 'bp-avr', fqbn: 'arduino:avr:nano:cpu=atmega328' },
  mega: { image: 'bp-avr', fqbn: 'arduino:avr:mega' },
} as const

export type Board = keyof typeof BOARDS

export type Diagnostic = {
  file: string
  line: number
  col: number
  severity: 'error' | 'warning'
  message: string
}

export type CompileResult = {
  ok: boolean
  hex?: string
  // bytes used, from arduino-cli's summary
  flash?: number
  ram?: number
  diagnostics: Diagnostic[]
  log: string
  ms: number
  cached: boolean
}

// what is baked into the bp-avr image. anything else would need the network, which the build never gets
const LIBRARY_HEADERS = new Set([
  'Adafruit_BusIO_Register.h', 'Adafruit_I2CDevice.h', 'Adafruit_I2CRegister.h', 'Adafruit_SPIDevice.h',
  'Adafruit_GFX.h', 'Adafruit_GrayOLED.h', 'Adafruit_SPITFT.h', 'gfxfont.h',
  'Adafruit_NeoPixel.h', 'Adafruit_SSD1306.h', 'Adafruit_Sensor.h', 'DHT.h', 'DHT_U.h',
  'LiquidCrystal_I2C.h', 'Servo.h',
  'Arduino.h', 'EEPROM.h', 'SPI.h', 'SoftwareSerial.h', 'Wire.h',
  'stdint.h', 'stdlib.h', 'string.h', 'math.h', 'stdio.h', 'stdbool.h', 'ctype.h', 'limits.h',
])
const HEADER_DIRS = ['avr/', 'util/', 'Fonts/']

const FILE_NAME = /^[A-Za-z0-9_-]+\.(ino|h|cpp|c)$/
const MAX_BYTES = 200_000
const CACHE = resolve(import.meta.dirname, '../../.cache/compile')

export function checkSources(files: Record<string, string>) {
  const out: Diagnostic[] = []
  const bad = (file: string, line: number, message: string) =>
    out.push({ file, line, col: 1, severity: 'error', message })

  if (!('sketch.ino' in files)) bad('sketch.ino', 0, 'missing sketch.ino')
  let total = 0
  for (const [name, text] of Object.entries(files)) {
    if (!FILE_NAME.test(name)) bad(name, 0, `bad file name ${name}`)
    total += text.length
    text.split('\n').forEach((src, i) => {
      const m = src.match(/^\s*#\s*include\s*([<"])([^>"]+)[>"]/)
      if (!m) return
      const [, quote, header] = m
      if (quote === '"' && header in files) return
      if (LIBRARY_HEADERS.has(header) || HEADER_DIRS.some((d) => header.startsWith(d))) return
      bad(name, i + 1, `library not available: ${header}. available: ${[...LIBRARY_HEADERS].filter((h) => /^[A-Z]/.test(h)).join(', ')}`)
    })
  }
  if (total > MAX_BYTES) bad('sketch.ino', 0, `sources over ${MAX_BYTES} bytes`)
  return out
}

// gcc lines look like /w/sketch/sketch.ino:12:5: error: 'x' was not declared in this scope
export function parseDiagnostics(log: string) {
  const out: Diagnostic[] = []
  for (const m of log.matchAll(/\/w\/sketch\/([^:\s]+):(\d+):(\d+): (error|warning): (.+)/g)) {
    out.push({ file: m[1], line: +m[2], col: +m[3], severity: m[4] as Diagnostic['severity'], message: m[5] })
  }
  return out
}

function parseSizes(log: string) {
  const flash = log.match(/Sketch uses (\d+) bytes/)
  const ram = log.match(/Global variables use (\d+) bytes/)
  return { flash: flash ? +flash[1] : undefined, ram: ram ? +ram[1] : undefined }
}

function run(cmd: string, args: string[], timeout: number) {
  return new Promise<{ code: number; out: string }>((done) => {
    execFile(cmd, args, { timeout, maxBuffer: 4 << 20 }, (err, stdout, stderr) => {
      const code = err ? (typeof err.code === 'number' ? err.code : 1) : 0
      done({ code, out: stdout + stderr })
    })
  })
}

// two docker builds at a time, the rest wait their turn
let active = 0
const waiting: (() => void)[] = []
async function slot<T>(fn: () => Promise<T>) {
  if (active >= 2) await new Promise<void>((r) => waiting.push(r))
  active++
  try {
    return await fn()
  } finally {
    active--
    waiting.shift()?.()
  }
}

export async function compile(board: Board, files: Record<string, string>): Promise<CompileResult> {
  const start = performance.now()
  const ms = () => Math.round(performance.now() - start)
  const target = BOARDS[board]
  if (!target) {
    return { ok: false, diagnostics: [{ file: '', line: 0, col: 0, severity: 'error', message: `unknown board ${board}` }], log: '', ms: ms(), cached: false }
  }
  const refused = checkSources(files)
  if (refused.length) return { ok: false, diagnostics: refused, log: '', ms: ms(), cached: false }

  const hash = createHash('sha256').update(board)
  for (const name of Object.keys(files).sort()) hash.update(`\0${name}\0${files[name]}`)
  const key = hash.digest('hex').slice(0, 32)
  const cacheFile = join(CACHE, `${key}.json`)
  try {
    const hit = JSON.parse(await readFile(cacheFile, 'utf8')) as CompileResult
    return { ...hit, ms: ms(), cached: true }
  } catch {}

  const result = await slot(async () => {
    const dir = await mkdtemp(join(tmpdir(), 'bp-'))
    const sketch = join(dir, 'sketch')
    try {
      await mkdir(sketch)
      for (const [name, text] of Object.entries(files)) await writeFile(join(sketch, name), text)
      const { code, out } = await run('docker', [
        'run', '--rm', '--network', 'none', '--memory', '1g', '--cpus', '2',
        '-v', `${sketch}:/w/sketch`, target.image,
        'arduino-cli', 'compile', '-b', target.fqbn, '--warnings', 'default', '--output-dir', '/w/sketch/build', '/w/sketch',
      ], 90_000)
      const hex = code === 0 ? await readFile(join(sketch, 'build', 'sketch.ino.hex'), 'utf8').catch(() => undefined) : undefined
      return { ok: !!hex, hex, ...parseSizes(out), diagnostics: parseDiagnostics(out), log: out.trim(), ms: 0, cached: false }
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  // a build that failed on the code is cached too, the same sources fail the same way.
  // one that failed for no reason gcc gave (docker down, a timeout) is not
  if (result.ok || result.diagnostics.length) {
    await mkdir(CACHE, { recursive: true })
    await writeFile(cacheFile, JSON.stringify(result))
  }
  return { ...result, ms: ms() }
}
