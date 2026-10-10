import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bench, Circuit, parseScenario, run } from '../src'
import { diagram, firmware, source } from './build'

const test = parseScenario(readFileSync(new URL('../../sketches/parking/test.yaml', import.meta.url), 'utf8')).scenario!

async function prove(src: string) {
  const fw = await firmware(src)
  const bench = new Bench(Circuit.parse(diagram('parking')).circuit!, fw.hex, fw.symbols)
  return { report: run(bench, test), bench, fw }
}

// what a model might add to steady the reading: a 100 sample moving average. 400 more bytes of globals
const smoothed = source('parking')
  .replace('unsigned long lastBeep = 0;', 'unsigned long lastBeep = 0;\nlong readings[100];\nint slot = 0;')
  .replace('  long cm = readCm();', '  readings[slot++ % 100] = readCm();\n  long sum = 0;\n  for (int i = 0; i < 100; i++) sum += readings[i];\n  long cm = sum / 100;')

describe('parking sensor', () => {
  it('guides a car in: OK, SLOW with the distance, STOP with a red ring and a long tone', async () => {
    const { report, bench } = await prove(source('parking'))
    expect(report.failed).toBeUndefined()
    const mem = bench.board.memory()!
    // the oled buffer and the ring both come out of the heap
    expect(mem.heapBytes).toBeGreaterThanOrEqual(1024 + 48)
    expect(mem.leastFree).toBeGreaterThan(100)
    expect(bench.board.collidedAtMs).toBeUndefined()
  })

  it('runs out of ram once a 100 sample average is added, and the test catches it', async () => {
    const { report, bench, fw } = await prove(smoothed)
    // arduino-cli is happy, its number leaves out the 1k the oled mallocs
    expect(fw.ram).toBeLessThan(1100)
    expect(report.ok).toBe(false)
    expect(bench.board.serial).toContain('oled failed')
    expect(report.failed!.index).toBe(1)
    expect(report.failed!.bench).toMatch(/ram: /)
  })

  it('the same bug with begin() unchecked: no error anywhere, the screen just stays black', async () => {
    const unchecked = smoothed.replace(/if \(!display\.begin\(SSD1306_SWITCHCAPVCC, 0x3C\)\) \{[^}]*\}/, 'display.begin(SSD1306_SWITCHCAPVCC, 0x3C);')
    const { report } = await prove(unchecked)
    expect(report.ok).toBe(false)
    expect(report.failed!.kind).toBe('expect-text')
    expect(report.failed!.detail).toContain('the screen shows')
  })
})
