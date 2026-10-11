import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { Circuit, checkRules, connect, freePins, type Diagram } from '../src'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../../sketches/${name}/diagram.json`, import.meta.url), 'utf8')) as Diagram
const add = (d: Diagram, type: Parameters<typeof connect>[1]) => {
  const a = connect(d, type, { left: 500, top: 0 })
  if (a.error) throw new Error(a.error)
  return { d: { ...d, parts: [...d.parts, ...a.parts], connections: [...d.connections, ...a.connections] }, a }
}
const errors = (d: Diagram) => checkRules(Circuit.parse(d).circuit!).filter((f) => f.severity === 'error').map((f) => f.message)

describe('connect a part by hand', () => {
  it('an led gets its resistor, a free pwm pin and ground, and no errors', () => {
    const { d, a } = add(load('blink'), 'wokwi-led')
    expect(a.parts.map((p) => p.type)).toEqual(['wokwi-resistor', 'wokwi-led'])
    expect(a.parts[1].id).toBe('led2')
    expect(a.pins.A).toBe('9')
    expect(errors(d)).toEqual([])
  })

  it('an oled goes on the i2c pins, and a second one shares them', () => {
    let { d } = add(load('blink'), 'wokwi-ssd1306')
    expect(d.connections.some(([x, y]) => x === 'oled1:DATA' && y === 'uno:A4')).toBe(true)
    d = add(d, 'wokwi-ssd1306').d
    expect(errors(d)).toEqual([])
  })

  it('every newer part wires itself with no errors, on an uno and on a pico', () => {
    const types = ['wokwi-photoresistor-sensor', 'wokwi-dht22', 'wokwi-pir-motion-sensor', 'wokwi-lcd1602', 'wokwi-rgb-led', 'wokwi-slide-switch'] as const
    for (const board of ['blink', 'pico-plant']) {
      let d = load(board)
      for (const t of types) d = add(d, t).d
      expect(errors(d)).toEqual([])
    }
    // seven pins of its own, so on a board of its own
    expect(errors(add(load('blink'), 'wokwi-7segment').d)).toEqual([])
  })

  it('a button, a knob, a servo, a buzzer and a ring all fit on one uno without clashing', () => {
    let d = load('blink')
    for (const t of ['wokwi-pushbutton', 'wokwi-potentiometer', 'wokwi-servo', 'wokwi-buzzer', 'wokwi-led-ring'] as const) d = add(d, t).d
    expect(errors(d)).toEqual([])
    const pins = d.connections.flat().filter((r) => typeof r === 'string' && r.startsWith('uno:') && !/GND|5V|3\.3V/.test(r))
    expect(new Set(pins).size).toBe(pins.length)
  })

  it('a sonar on a pico comes with the echo divider the rules ask for', () => {
    const { d, a } = add(load('pico-plant'), 'wokwi-hc-sr04')
    expect(a.parts.filter((p) => p.type === 'wokwi-resistor').map((p) => p.attrs?.value)).toEqual(['1000', '2000'])
    expect(errors(d)).toEqual([])
  })

  it('lists the free pins a part can take, and uses the one picked', () => {
    const d = load('blink')
    const pins = freePins(d, 'wokwi-led').map((p) => p.pin)
    expect(pins[0]).toBe('9')
    expect(pins).not.toContain('13')
    expect(freePins(d, 'wokwi-led')[0].label).toBe('pin 9 · pwm')
    expect(freePins(d, 'wokwi-potentiometer').map((p) => p.pin)).toEqual(['A0', 'A1', 'A2', 'A3'])
    const a = connect(d, 'wokwi-led', { left: 0, top: 0 }, { pin: '5' })
    expect(a.pins.A).toBe('5')
    // a pin already taken falls back to a free one
    expect(connect(d, 'wokwi-led', { left: 0, top: 0 }, { pin: '13' }).pins.A).toBe('9')
  })

  it('says so when the pins run out', () => {
    let d = load('blink')
    let error = ''
    for (let i = 0; i < 20 && !error; i++) {
      const a = connect(d, 'wokwi-led', { left: 0, top: 0 })
      if (a.error) error = a.error
      else d = { ...d, parts: [...d.parts, ...a.parts], connections: [...d.connections, ...a.connections] }
    }
    expect(error).toMatch(/no free pin/i)
  })
})
