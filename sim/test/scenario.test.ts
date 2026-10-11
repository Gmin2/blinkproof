import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bench, Circuit, parseScenario, run } from '../src'
import { build, diagram, source } from './build'

const yaml = (name: string) => readFileSync(new URL(`../../sketches/${name}/test.yaml`, import.meta.url), 'utf8')

async function prove(name: string, src = source(name), test = yaml(name)) {
  const { scenario, errors } = parseScenario(test)
  if (!scenario) throw new Error(errors.join('\n'))
  const bench = new Bench(Circuit.parse(diagram(name)).circuit!, await build(src))
  return run(bench, scenario)
}

describe('scenarios', () => {
  it('times a blink from its edge with wait-led', async () => {
    const led = (diagram('blink') as any).parts.find((p: any) => p.type === 'wokwi-led')?.id ?? 'led1'
    const test = `name: blinks once a second
version: 1
steps:
  - wait-led: { part-id: ${led}, lit: true, timeout: 2s }
  - delay: 100ms
  - expect-led: { part-id: ${led}, lit: true }
  - delay: 500ms
  - expect-led: { part-id: ${led}, lit: false }
  - wait-led: { part-id: ${led}, lit: true, timeout: 1500ms }
`
    const r = await prove('blink', source('blink'), test)
    expect(r.failed).toBeUndefined()
    expect(r.ok).toBe(true)
  })

  it('replays the wokwi slide pot test: 1 reads 1023, 0.5 reads 512, 0 reads 0', async () => {
    const r = await prove('pot-print')
    expect(r.failed).toBeUndefined()
    expect(r.ok).toBe(true)
    expect(r.steps.map((s) => s.kind)).toEqual(['set-control', 'wait-serial', 'set-control', 'wait-serial', 'set-control', 'wait-serial'])
  })

  it('fails a wrong sketch on the step that checks it, with the bench in the report', async () => {
    const r = await prove('pot-print', source('pot-print').replace('analogRead(A0)', 'analogRead(A1)'))
    expect(r.ok).toBe(false)
    expect(r.failed!.index).toBe(2)
    expect(r.failed!.detail).toBe('waited 10000ms of sim time for serial to print "Potentiometer value: 1023"')
    expect(r.failed!.serialTail).toMatch(/Potentiometer value: \d+/)
    expect(r.failed!.bench).toContain('pot1: at 100%')
  })

  it('drives the parts tour: distance fills the ring, the button opens the gate', async () => {
    const r = await prove('parts-tour')
    expect(r.failed).toBeUndefined()
    expect(r.ok).toBe(true)
  })

  it('catches a gate on the wrong pin with a reason a person can act on', async () => {
    const r = await prove('parts-tour', source('parts-tour').replace('gate.attach(3)', 'gate.attach(5)'))
    expect(r.ok).toBe(false)
    expect(r.failed!.kind).toBe('expect-servo')
    expect(r.failed!.detail).toContain('got no pulses')
  })
})

describe('reading a scenario', () => {
  it('wants units on delays, a name, version 1 and known steps', () => {
    const { errors } = parseScenario('version: 2\nsteps:\n  - delay: 500\n  - press: btn1\n')
    expect(errors).toEqual([
      'name is required',
      'unsupported scenario version: 2',
      'step 1: 500 needs units, like 200ms or 2s',
      expect.stringContaining('step 2: invalid step key press. known: delay, wait-serial'),
    ])
  })
})

describe('beeps', () => {
  it('expect-tone within a window hears intermittent beeps that an instant check misses', async () => {
    const test = `name: beeps
version: 1
steps:
  - delay: 450ms
  - expect-tone: { part-id: bz, silent: true }
  - expect-tone: { part-id: bz, within: 500ms }
  - expect-tone: { part-id: bz, hz: 1000, within: 500ms }
`
    const src = 'void setup() {}\nvoid loop() { tone(8, 1000, 40); delay(300); }\n'
    const d = { version: 1, parts: [{ id: 'uno', type: 'wokwi-arduino-uno' }, { id: 'bz', type: 'wokwi-buzzer' }], connections: [['bz:2', 'uno:8', ''], ['bz:1', 'uno:GND.1', '']] }
    const r = run(new Bench(Circuit.parse(d).circuit!, await build(src)), parseScenario(test).scenario!)
    expect(r.failed).toBeUndefined()
  })
})
