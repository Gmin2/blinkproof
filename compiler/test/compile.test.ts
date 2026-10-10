import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { checkSources, compile, parseDiagnostics } from '../src/compile.ts'

const sketch = (name: string) => readFileSync(new URL(`../../sketches/${name}/${name}.ino`, import.meta.url), 'utf8')

describe('compile', () => {
  it('builds blink to the same hex arduino-cli gives on its own', async () => {
    const r = await compile('uno', { 'sketch.ino': sketch('blink') })
    expect(r.ok).toBe(true)
    expect(r.hex).toBe(readFileSync(new URL('../../sketches/blink/build/blink.ino.hex', import.meta.url), 'utf8'))
    expect(r.flash).toBeGreaterThan(1000)
    expect(r.ram).toBeGreaterThan(100)
  }, 120_000)

  it('serves the same sources from the cache', async () => {
    const files = { 'sketch.ino': sketch('blink') }
    await compile('uno', files)
    const again = await compile('uno', files)
    expect(again.cached).toBe(true)
    expect(again.ms).toBeLessThan(100)
  }, 120_000)

  it('gives gcc errors with their line', async () => {
    const r = await compile('uno', { 'sketch.ino': 'void setup() {\n  pinMode(13, OUTPUT)\n}\nvoid loop() { nope(); }\n' })
    expect(r.ok).toBe(false)
    expect(r.diagnostics.some((d) => d.line === 3 || d.line === 2)).toBe(true)
    expect(r.diagnostics.some((d) => d.line === 4 && /nope/.test(d.message))).toBe(true)
  }, 120_000)

  it('counts the ram the oled sketch uses before malloc', async () => {
    const r = await compile('uno', { 'sketch.ino': sketch('hello-oled') })
    expect(r.ok).toBe(true)
    // the 1k screen buffer is malloced at runtime, so it is not in this number
    expect(r.ram!).toBeLessThan(1024)
  }, 120_000)
})

describe('sources', () => {
  it('refuses a library the image does not have, before docker runs', async () => {
    const r = await compile('uno', { 'sketch.ino': '#include <FastLED.h>\nvoid setup(){}\nvoid loop(){}\n' })
    expect(r.ok).toBe(false)
    expect(r.ms).toBeLessThan(50)
    expect(r.diagnostics[0]).toMatchObject({ line: 1, message: expect.stringContaining('FastLED.h') })
  })

  it('takes core headers, avr headers, gfx fonts and local files', () => {
    const files = {
      'sketch.ino': '#include <Wire.h>\n#include <avr/pgmspace.h>\n#include <Fonts/FreeSans9pt7b.h>\n#include "pins.h"\n',
      'pins.h': '#define LED 13\n',
    }
    expect(checkSources(files)).toEqual([])
  })

  it('refuses odd file names and a missing sketch.ino', () => {
    expect(checkSources({ '../x.ino': '' }).map((d) => d.message)).toEqual(['missing sketch.ino', 'bad file name ../x.ino'])
  })

  it('reads gcc lines', () => {
    const log = "/w/sketch/sketch.ino:4:15: error: 'nope' was not declared in this scope\n"
    expect(parseDiagnostics(log)).toEqual([{ file: 'sketch.ino', line: 4, col: 15, severity: 'error', message: "'nope' was not declared in this scope" }])
  })
})
