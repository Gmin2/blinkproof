import { describe, expect, it } from 'vitest'
import { Circuit, checkRules } from '../src'
import { diagram, source } from './build'

type Part = { id: string; type: string; attrs?: Record<string, string> }

function circuit(parts: Part[], wires: string[][]) {
  const { circuit, errors } = Circuit.parse({
    version: 1,
    parts: [{ id: 'uno', type: 'wokwi-arduino-uno' }, ...parts],
    connections: wires.map(([a, b]) => [a, b, 'green', []]),
  })
  if (!circuit) throw new Error(errors.join('\n'))
  return circuit
}

const rules = (c: Circuit, sketch?: string) => checkRules(c, sketch)
const errors = (c: Circuit, sketch?: string) => rules(c, sketch).filter((f) => f.severity === 'error').map((f) => f.rule)
const named = (c: Circuit, sketch?: string) => rules(c, sketch).map((f) => f.rule)

describe('good circuits', () => {
  for (const name of ['blink', 'hello-oled', 'parts-tour', 'parking', 'pot-print']) {
    it(`${name} has no errors`, () => {
      const c = Circuit.parse(diagram(name)).circuit!
      expect(errors(c, source(name))).toEqual([])
    })
  }

  it('parking warns that a full white ring could trip the usb fuse', () => {
    const f = rules(Circuit.parse(diagram('parking')).circuit!, source('parking')).find((f) => f.rule === 'rail-budget')!
    expect(f.severity).toBe('warning')
    expect(f.message).toContain('995 mA')
  })
})

describe('broken circuits fail on the right rule', () => {
  const led = (color = 'red') => ({ id: 'led1', type: 'wokwi-led', attrs: { color } })
  const r = (value: string) => ({ id: 'r1', type: 'wokwi-resistor', attrs: { value } })

  it('led straight on a pin', () => {
    const f = rules(circuit([led()], [['uno:13', 'led1:A'], ['led1:C', 'uno:GND.1']]))
    expect(f[0]).toMatchObject({ rule: 'led-no-resistor', severity: 'error' })
    expect(f[0].message).toContain('220 ohm')
  })

  it('a 47 ohm resistor on a blue led', () => {
    const f = rules(circuit([led('blue'), r('47')], [['uno:13', 'r1:1'], ['r1:2', 'led1:A'], ['led1:C', 'uno:GND.1']]))
    expect(f.map((x) => x.rule)).toEqual(['led-resistor-small'])
    expect(f[0].message).toContain('36 mA')
  })

  it('a led in backwards', () => {
    expect(errors(circuit([led(), r('220')], [['uno:13', 'r1:1'], ['r1:2', 'led1:C'], ['led1:A', 'uno:GND.1']]))).toEqual(['led-backwards'])
  })

  it('oled on the wrong pins, and a sketch at the wrong address', () => {
    const d = diagram('hello-oled')
    d.connections = d.connections.map((c: string[]) => (c[1] === 'uno:A4' ? [c[0], 'uno:A2', c[2], c[3]] : c))
    expect(errors(Circuit.parse(d).circuit!)).toEqual(['i2c-pins'])
    const wrongAddress = source('hello-oled').replace('0x3C', '0x3D')
    expect(errors(Circuit.parse(diagram('hello-oled')).circuit!, wrongAddress)).toEqual(['i2c-address'])
  })

  it('two oleds at one address', () => {
    const oled = (id: string) => ({ id, type: 'wokwi-ssd1306' })
    const wires = (id: string) => [[`${id}:DATA`, 'uno:A4'], [`${id}:CLK`, 'uno:A5'], [`${id}:VIN`, 'uno:5V'], [`${id}:GND`, 'uno:GND.1']]
    expect(errors(circuit([oled('a'), oled('b')], [...wires('a'), ...wires('b')]))).toEqual(['i2c-address'])
  })

  it('sonar on 3.3 v', () => {
    const c = circuit([{ id: 's', type: 'wokwi-hc-sr04' }], [['s:TRIG', 'uno:9'], ['s:ECHO', 'uno:10'], ['s:VCC', 'uno:3.3V'], ['s:GND', 'uno:GND.1']])
    expect(errors(c)).toEqual(['sonar-5v'])
  })

  it('a button with nothing holding the pin', () => {
    const c = circuit([{ id: 'b', type: 'wokwi-pushbutton' }], [['b:1.l', 'uno:2'], ['b:2.l', 'uno:GND.1']])
    expect(named(c, source('parts-button'))).toEqual([])
    const f = rules(c, source('parts-button').replace('INPUT_PULLUP', 'INPUT'))
    expect(f.map((x) => x.rule)).toEqual(['floating-button'])
    expect(f[0].message).toContain('INPUT_PULLUP')
    const toFive = circuit([{ id: 'b', type: 'wokwi-pushbutton' }], [['b:1.l', 'uno:2'], ['b:2.l', 'uno:5V']])
    expect(named(toFive, source('parts-button'))).toEqual(['floating-button'])
  })

  it('a ring with no power, a servo with no signal', () => {
    const c = circuit(
      [{ id: 'ring', type: 'wokwi-led-ring' }, { id: 'arm', type: 'wokwi-servo' }],
      [['ring:DIN', 'uno:6'], ['arm:V+', 'uno:5V'], ['arm:GND', 'uno:GND.1']],
    )
    const f = rules(c)
    expect(f.filter((x) => x.severity === 'error').map((x) => `${x.rule} ${x.parts}`)).toEqual(['no-power ring', 'unwired arm'])
  })

  it('a pin wired to ground, a part on the serial pins, two parts on one pin', () => {
    const shorted = circuit([led(), r('220')], [['uno:13', 'r1:1'], ['r1:2', 'led1:A'], ['led1:C', 'uno:GND.1'], ['uno:13', 'uno:GND.2']])
    expect(errors(shorted)).toContain('short')
    const serial = circuit([{ id: 'b', type: 'wokwi-pushbutton' }], [['b:1.l', 'uno:1'], ['b:2.l', 'uno:GND.1']])
    expect(named(serial, 'void setup(){ pinMode(1, INPUT_PULLUP); }')).toEqual(['serial-pins'])
    const shared = circuit(
      [{ id: 'b', type: 'wokwi-pushbutton' }, { id: 'arm', type: 'wokwi-servo' }],
      [['b:1.l', 'uno:3'], ['b:2.l', 'uno:GND.1'], ['arm:PWM', 'uno:3'], ['arm:V+', 'uno:5V'], ['arm:GND', 'uno:GND.1']],
    )
    expect(named(shared, 'void setup(){ pinMode(3, INPUT_PULLUP); }')).toEqual(['shared-pin'])
  })

  it('analogWrite where the uno has no pwm, or where Servo and tone took the timer', () => {
    const c = circuit([], [])
    expect(rules(c, 'const int LED = 7;\nvoid loop(){ analogWrite(LED, 128); }')[0]).toMatchObject({ rule: 'pwm-pin', severity: 'error' })
    expect(rules(c, '#include <Servo.h>\nvoid loop(){ analogWrite(9, 128); }')[0]).toMatchObject({ rule: 'pwm-pin', severity: 'warning' })
    expect(rules(c, 'void loop(){ tone(8, 440); analogWrite(11, 1); }')[0]).toMatchObject({ rule: 'pwm-pin', severity: 'warning' })
    expect(rules(c, 'void loop(){ analogWrite(5, 1); }')).toEqual([])
  })
})
describe('light sensor rules', () => {
  const ldr = { id: 'ldr1', type: 'wokwi-photoresistor-sensor' }
  const power = [['ldr1:VCC', 'uno:5V'], ['ldr1:GND', 'uno:GND.1']]
  it('is fine with AO on an analog pin', () => {
    expect(errors(circuit([ldr], [...power, ['ldr1:AO', 'uno:A0']]))).toEqual([])
  })
  it('is fine with only DO on a digital pin', () => {
    expect(errors(circuit([ldr], [...power, ['ldr1:DO', 'uno:7']]))).toEqual([])
  })
  it('says when it reaches no pin at all', () => {
    expect(errors(circuit([ldr], power))).toContain('unwired')
  })
  it('says when AO is on a pin that cannot read a voltage', () => {
    expect(errors(circuit([ldr], [...power, ['ldr1:AO', 'uno:7']]))).toContain('adc-pin')
  })
  it('says when it has no power', () => {
    expect(errors(circuit([ldr], [['ldr1:AO', 'uno:A0']]))).toContain('no-power')
  })
})

describe('lights behind a common pin', () => {
  it('wants a resistor somewhere on an rgb led', () => {
    const c = circuit([{ id: 'rgb1', type: 'wokwi-rgb-led' }], [['rgb1:R', 'uno:9'], ['rgb1:COM', 'uno:GND.1']])
    expect(errors(c)).toContain('led-no-resistor')
  })
  it('takes one resistor on the common pin of a digit', () => {
    const c = circuit([{ id: 'seg1', type: 'wokwi-7segment' }, { id: 'r1', type: 'wokwi-resistor', attrs: { value: '220' } }], [['seg1:A', 'uno:2'], ['seg1:COM.1', 'r1:1'], ['r1:2', 'uno:GND.1']])
    expect(errors(c)).toEqual([])
  })
  it('says when the common pin goes nowhere', () => {
    expect(errors(circuit([{ id: 'seg1', type: 'wokwi-7segment' }], [['seg1:A', 'uno:2']]))).toContain('unwired')
  })
})
