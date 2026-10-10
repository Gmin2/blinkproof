import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Bench, Circuit, checkRules, parseScenario, run } from '../src'
import { diagram, firmware, source } from './build'

const test = (name: string) => parseScenario(readFileSync(new URL(`../../sketches/${name}/test.yaml`, import.meta.url), 'utf8')).scenario!

describe('nano', () => {
  it('dims a led with a knob on A7, pwm read back as brightness', async () => {
    const fw = await firmware(source('nano-dimmer'), 'nano')
    const bench = new Bench(Circuit.parse(diagram('nano-dimmer')).circuit!, fw.hex, fw.symbols)
    const r = run(bench, test('nano-dimmer'))
    expect(r.failed).toBeUndefined()
    expect(r.steps.find((s) => s.name === 'halfway, half bright')!.detail).toMatch(/lit, (4[5-9]|5[0-5])%/)
  })

  it('has no wiring errors as built', () => {
    const c = Circuit.parse(diagram('nano-dimmer')).circuit!
    expect(checkRules(c, source('nano-dimmer')).filter((f) => f.severity === 'error')).toEqual([])
  })

  it('refuses digital parts and pinMode on A6 and A7', () => {
    const d = diagram('nano-dimmer')
    d.parts.push({ id: 'btn', type: 'wokwi-pushbutton' })
    d.connections.push(['btn:1.l', 'nano:A6', '', []], ['btn:2.l', 'nano:GND.1', '', []])
    const f = checkRules(Circuit.parse(d).circuit!, source('nano-dimmer').replace('pinMode(LED, OUTPUT);', 'pinMode(LED, OUTPUT);\n  pinMode(A6, INPUT_PULLUP);'))
    expect(f.filter((x) => x.rule === 'analog-only').length).toBe(2)
  })

  it('takes the icsp copy of a pin as the pin itself', () => {
    const d = diagram('nano-dimmer')
    d.connections = d.connections.map((c: string[]) => (c[1] === 'nano:GND.2' ? [c[0], 'nano:GND.3', c[2], c[3]] : c))
    expect(Circuit.parse(d).circuit!.onGround('led1:C')).toBe(true)
  })
})
