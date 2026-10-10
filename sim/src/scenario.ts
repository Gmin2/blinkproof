import { parse as parseYaml } from 'yaml'
import type { Bench, PartState } from './bench'

// wokwi's automation scenario shape: name, version 1, steps. each step is one key, plus an optional name.
// wokwi's steps mean what they mean there. ours are new keys, so a wokwi scenario reads the same here
export type Step = { name?: string } & Record<string, unknown>
export type Scenario = { name: string; version: 1; author?: string; steps: Step[] }

export type StepResult = { index: number; kind: string; name?: string; ok: boolean; atMs: number; detail: string }
export type Report = {
  ok: boolean
  scenario: string
  steps: StepResult[]
  // the step that failed, with what the bench looked like then
  failed?: StepResult & { bench: string; serialTail: string }
  simMs: number
}

const WOKWI = ['delay', 'wait-serial', 'write-serial', 'set-control', 'expect-pin']
const OURS = ['wait-text', 'expect-text', 'expect-pixels', 'expect-servo', 'expect-tone', 'expect-led', 'expect-serial']
export const STEPS = [...WOKWI, ...OURS]

const WAIT_LIMIT_MS = 10_000

export function parseDuration(v: unknown): number {
  const m = String(v).trim().match(/^(\d+(?:\.\d+)?)\s*(us|ms|s)$/)
  if (!m) throw new Error(`${JSON.stringify(v)} needs units, like 200ms or 2s`)
  const n = Number(m[1])
  return m[2] === 's' ? n * 1000 : m[2] === 'us' ? n / 1000 : n
}

export function parseScenario(input: string | unknown): { scenario?: Scenario; errors: string[] } {
  let s: any
  try {
    s = typeof input === 'string' ? parseYaml(input) : input
  } catch (e) {
    return { errors: [`not yaml: ${(e as Error).message}`] }
  }
  const errors: string[] = []
  if (typeof s?.name !== 'string') errors.push('name is required')
  if (s?.version !== 1) errors.push(`unsupported scenario version: ${s?.version}`)
  if (!Array.isArray(s?.steps)) return { errors: [...errors, 'steps must be a list'] }
  s.steps.forEach((step: unknown, i: number) => {
    if (!step || typeof step !== 'object') return errors.push(`step ${i + 1} must be an object`)
    const keys = Object.keys(step).filter((k) => k !== 'name')
    if (keys.length !== 1) return errors.push(`step ${i + 1} needs exactly one step key, has ${keys.join(', ') || 'none'}`)
    if (!STEPS.includes(keys[0])) return errors.push(`step ${i + 1}: invalid step key ${keys[0]}. known: ${STEPS.join(', ')}`)
    if (keys[0] === 'delay') {
      try {
        parseDuration((step as Step).delay)
      } catch (e) {
        errors.push(`step ${i + 1}: ${(e as Error).message}`)
      }
    }
  })
  return errors.length ? { errors } : { scenario: s as Scenario, errors }
}

export function colorName([r, g, b]: number[]) {
  const max = Math.max(r, g, b)
  if (max < 8) return 'off'
  const on = [r, g, b].map((v) => v >= max * 0.5)
  const names: Record<string, string> = { '100': 'red', '010': 'green', '001': 'blue', '110': 'yellow', '011': 'cyan', '101': 'magenta', '111': 'white' }
  return names[on.map(Number).join('')]
}

class Fail extends Error {}

function part<T extends PartState['type']>(bench: Bench, id: unknown, ...types: T[]) {
  const p = bench.parts[String(id)]
  if (!p) throw new Fail(`no part ${id}. parts: ${Object.keys(bench.parts).join(', ')}`)
  if (types.length && !types.includes(p.type as T)) throw new Fail(`${id} is a ${p.type}, this step wants ${types.join(' or ')}`)
  return p as Extract<PartState, { type: T }>
}

// runs a scenario against a bench. a generator so the browser can play it a frame at a time,
// node just runs it to the end with run()
export function* play(bench: Bench, scenario: Scenario): Generator<StepResult | null, Report> {
  const results: StepResult[] = []
  // where the last wait-serial matched, so one line is not matched twice
  let cursor = 0
  const sim = () => Math.round(bench.uno.ms)

  // wait until check() passes, a few ms of sim time at a time
  function* until(check: () => boolean, limitMs: number, what: string) {
    const end = bench.uno.ms + limitMs
    while (!check()) {
      if (bench.uno.ms >= end) throw new Fail(`waited ${Math.round(limitMs)}ms of sim time for ${what}`)
      bench.run(5)
      yield null
    }
  }

  for (const [i, step] of scenario.steps.entries()) {
    const kind = Object.keys(step).find((k) => k !== 'name')!
    const arg = step[kind] as any
    const result: StepResult = { index: i + 1, kind, name: step.name, ok: true, atMs: sim(), detail: '' }
    try {
      switch (kind) {
        case 'delay': {
          const ms = parseDuration(arg)
          const end = bench.uno.ms + ms
          while (bench.uno.ms < end) {
            bench.run(Math.min(20, end - bench.uno.ms))
            yield null
          }
          result.detail = `${ms}ms`
          break
        }
        case 'wait-serial': {
          const text = String(arg)
          const limit = WAIT_LIMIT_MS
          yield* until(() => bench.uno.serial.indexOf(text, cursor) >= 0, limit, `serial to print ${JSON.stringify(text)}`)
          cursor = bench.uno.serial.indexOf(text, cursor) + text.length
          result.detail = text
          break
        }
        case 'expect-serial': {
          const text = String(arg?.contains ?? arg)
          if (!bench.uno.serial.includes(text)) throw new Fail(`serial never printed ${JSON.stringify(text)}`)
          result.detail = text
          break
        }
        case 'write-serial': {
          const bytes = typeof arg === 'string' ? [...arg].map((c) => c.charCodeAt(0)) : (arg as number[])
          for (const b of bytes) {
            bench.uno.usart.writeByte(b)
            bench.run(2)
          }
          result.detail = `${bytes.length} bytes`
          break
        }
        case 'set-control': {
          const id = arg?.['part-id']
          const control = arg?.name ?? arg?.control
          part(bench, id)
          try {
            bench.control(id, control, Number(arg?.value))
          } catch (e) {
            throw new Fail((e as Error).message)
          }
          result.detail = `${id}.${control} = ${arg?.value}`
          break
        }
        case 'expect-pin': {
          const id = String(arg?.['part-id'])
          const pin = String(arg?.name ?? arg?.pin)
          const want = Number(arg?.value ?? arg?.expected)
          const p = part(bench, id)
          const level = p.type === 'wokwi-arduino-uno' ? bench.uno.read(/^\d+$/.test(pin) ? `D${pin}` : pin) : bench.level(`${id}:${pin}`)
          const got = level ? 1 : 0
          if (got !== want) throw new Fail(`${id}:${pin} is ${got}, expected ${want}`)
          result.detail = `${id}:${pin} = ${got}`
          break
        }
        case 'wait-text':
        case 'expect-text': {
          const id = arg?.['part-id']
          const oled = part(bench, id, 'wokwi-ssd1306').oled
          const want = arg?.contains !== undefined ? String(arg.contains) : undefined
          const not = arg?.['not-contains'] !== undefined ? String(arg['not-contains']) : undefined
          const text = () => oled?.text() ?? ''
          const good = () => (want === undefined || text().includes(want)) && (not === undefined || !text().includes(not))
          const describe = `${id} to show ${want !== undefined ? JSON.stringify(want) : ''}${not !== undefined ? ` and not ${JSON.stringify(not)}` : ''}`
          if (!oled) throw new Fail(`${id} is not on the i2c bus, check DATA on A4, CLK on A5 and power`)
          if (kind === 'wait-text') yield* until(good, arg?.timeout ? parseDuration(arg.timeout) : WAIT_LIMIT_MS, describe)
          else if (!good()) throw new Fail(`wanted ${describe}, the screen shows ${JSON.stringify(text()) || 'nothing'}`)
          result.detail = JSON.stringify(text())
          break
        }
        case 'expect-pixels': {
          const id = arg?.['part-id']
          const strip = part(bench, id, 'wokwi-led-ring', 'wokwi-neopixel').strip
          if (!strip) throw new Fail(`${id} gets no power or no data pin`)
          const lit = strip.pixels.filter((c) => colorName(c) !== 'off').length
          const colors = strip.pixels.map(colorName)
          if (arg?.lit !== undefined && lit !== Number(arg.lit)) throw new Fail(`${id} has ${lit} pixels lit, expected ${arg.lit}. colours: ${colors.join(' ')}`)
          if (arg?.['min-lit'] !== undefined && lit < Number(arg['min-lit'])) throw new Fail(`${id} has ${lit} pixels lit, expected at least ${arg['min-lit']}`)
          if (arg?.['max-lit'] !== undefined && lit > Number(arg['max-lit'])) throw new Fail(`${id} has ${lit} pixels lit, expected at most ${arg['max-lit']}`)
          if (arg?.color !== undefined) {
            const which = arg.index !== undefined ? [Number(arg.index)] : colors.map((c, k) => (c === 'off' ? -1 : k)).filter((k) => k >= 0)
            if (!which.length) throw new Fail(`${id} has nothing lit, expected ${arg.color}`)
            const wrong = which.filter((k) => colors[k] !== arg.color)
            if (wrong.length) throw new Fail(`${id} pixel ${wrong[0]} is ${colors[wrong[0]]}, expected ${arg.color}`)
          }
          result.detail = `${lit} lit: ${colors.join(' ')}`
          break
        }
        case 'expect-servo': {
          const id = arg?.['part-id']
          const servo = part(bench, id, 'wokwi-servo').servo
          if (!servo) throw new Fail(`${id} gets no power or no signal pin`)
          if (!servo.pulses) throw new Fail(`${id} got no pulses, is the Servo attached to the pin it is wired to?`)
          const tol = Number(arg?.tolerance ?? 3)
          if (Math.abs(servo.angle - Number(arg?.angle)) > tol) throw new Fail(`${id} is at ${servo.angle} degrees, expected ${arg?.angle}`)
          result.detail = `${servo.angle} degrees`
          break
        }
        case 'expect-tone': {
          const id = arg?.['part-id']
          const buzzer = part(bench, id, 'wokwi-buzzer').buzzer
          if (!buzzer) throw new Fail(`${id} is not wired to a pin and GND`)
          // beeps come and go, so a window asks "did it sound at all in the last second"
          if (arg?.within !== undefined) {
            const since = bench.uno.ms - parseDuration(arg.within)
            const heard = buzzer.notes.filter((n) => n.startMs + n.ms >= since)
            const right = heard.filter((n) => arg?.hz === undefined || Math.abs(n.hz - Number(arg.hz)) <= Number(arg.hz) * 0.02)
            if (arg?.silent && heard.length) throw new Fail(`${id} played ${Math.round(heard[0].hz)} hz in the last ${arg.within}, expected silence`)
            if (!arg?.silent && !right.length) {
              throw new Fail(heard.length ? `${id} played ${heard.map((n) => Math.round(n.hz)).join(', ')} hz in the last ${arg.within}, expected ${arg.hz}` : `${id} made no sound in the last ${arg.within}`)
            }
            result.detail = heard.length ? `${heard.length} beeps, ${heard.map((n) => Math.round(n.hz)).join(' ')} hz` : 'silent'
            break
          }
          if (arg?.silent) {
            if (buzzer.hz) throw new Fail(`${id} plays ${buzzer.hz} hz, expected silence`)
          } else {
            if (!buzzer.hz) throw new Fail(`${id} is silent, expected ${arg?.hz ?? 'a'} hz tone`)
            if (arg?.hz !== undefined && Math.abs(buzzer.hz - Number(arg.hz)) > Number(arg.hz) * 0.02) throw new Fail(`${id} plays ${buzzer.hz} hz, expected ${arg.hz}`)
          }
          result.detail = buzzer.hz ? `${buzzer.hz} hz` : 'silent'
          break
        }
        case 'expect-led': {
          const id = arg?.['part-id']
          const led = part(bench, id, 'wokwi-led')
          if (arg?.lit !== undefined && led.lit !== !!arg.lit) throw new Fail(`${id} is ${led.lit ? 'lit' : 'dark'}, expected ${arg.lit ? 'lit' : 'dark'}`)
          // pwm: brightness is how much of the last 20 ms the led was on, 0 to 1
          const b = led.brightness
          if (arg?.['min-brightness'] !== undefined && b < Number(arg['min-brightness'])) throw new Fail(`${id} is at ${Math.round(b * 100)}% brightness, expected at least ${Math.round(Number(arg['min-brightness']) * 100)}%`)
          if (arg?.['max-brightness'] !== undefined && b > Number(arg['max-brightness'])) throw new Fail(`${id} is at ${Math.round(b * 100)}% brightness, expected at most ${Math.round(Number(arg['max-brightness']) * 100)}%`)
          result.detail = led.lit ? `lit, ${Math.round(b * 100)}%` : 'dark'
          break
        }
      }
    } catch (e) {
      if (!(e instanceof Fail)) throw e
      result.ok = false
      result.detail = e.message
    }
    result.atMs = sim()
    results.push(result)
    yield result
    if (!result.ok) {
      const serialTail = bench.uno.serial.split('\n').slice(-8).join('\n')
      return { ok: false, scenario: scenario.name, steps: results, failed: { ...result, bench: bench.describe(), serialTail }, simMs: sim() }
    }
  }
  return { ok: true, scenario: scenario.name, steps: results, simMs: sim() }
}

export function run(bench: Bench, scenario: Scenario) {
  const it = play(bench, scenario)
  for (;;) {
    const next = it.next()
    if (next.done) return next.value
  }
}
