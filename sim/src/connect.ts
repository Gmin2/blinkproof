import type { Connection, Diagram, DiagramPart } from './circuit'
import { PARTS } from './catalog'

// a part added by hand comes already wired: the pins it needs on the board, the ones nobody uses yet,
// with the resistor or divider it needs. what comes back is the parts and wires to add, and which pins it took

type Board = 'uno' | 'nano' | 'pico'

const AVR = {
  // 0 and 1 are the usb serial, A4 and A5 are i2c, so a plain digital part never gets them
  digital: ['2', '4', '7', '8', '12', '13', '3', '5', '6', '9', '10', '11', 'A0', 'A1', 'A2', 'A3'],
  pwm: ['9', '10', '11', '3', '5', '6'],
  analog: ['A0', 'A1', 'A2', 'A3'],
  sda: 'A4',
  scl: 'A5',
  five: '5V',
  three: '3.3V',
  grounds: ['GND.1', 'GND.2', 'GND.3'],
}

const PICO = {
  digital: ['GP15', 'GP14', 'GP13', 'GP12', 'GP11', 'GP10', 'GP9', 'GP8', 'GP7', 'GP6', 'GP3', 'GP2', 'GP16', 'GP17', 'GP18', 'GP19', 'GP20', 'GP21', 'GP22'],
  pwm: ['GP15', 'GP14', 'GP13', 'GP12', 'GP11', 'GP10', 'GP9', 'GP8', 'GP7', 'GP6', 'GP16', 'GP17', 'GP18'],
  analog: ['GP26', 'GP27', 'GP28'],
  sda: 'GP4',
  scl: 'GP5',
  five: 'VBUS',
  three: '3V3',
  grounds: ['GND.1', 'GND.2', 'GND.3', 'GND.4', 'GND.5', 'GND.6', 'GND.7', 'GND.8'],
}

const POWER = '#ef4444'
const GROUND = '#94a3b8'
const SIGNALS = ['#22c55e', '#f59e0b', '#38bdf8', '#a78bfa', '#eab308', '#ec4899']

const PREFIX: Record<string, string> = {
  'wokwi-led': 'led',
  'wokwi-resistor': 'r',
  'wokwi-pushbutton': 'btn',
  'wokwi-ssd1306': 'oled',
  'wokwi-potentiometer': 'pot',
  'wokwi-neopixel': 'pixel',
  'wokwi-led-ring': 'ring',
  'wokwi-servo': 'servo',
  'wokwi-hc-sr04': 'sonar',
  'wokwi-buzzer': 'bz',
  'wokwi-photoresistor-sensor': 'ldr',
}

export type Added = { parts: DiagramPart[]; connections: Connection[]; pins: Record<string, string>; error?: string }

export function boardOf(d: Diagram): { part: DiagramPart; kind: Board } | undefined {
  const part = d.parts.find((p) => 'board' in (PARTS[p.type as keyof typeof PARTS] ?? {}))
  if (!part) return undefined
  return { part, kind: part.type === 'wokwi-pi-pico' ? 'pico' : part.type === 'wokwi-arduino-nano' ? 'nano' : 'uno' }
}

// board pins already wired to anything, with the aliases folded in (13.2 is 13, A4.2 is A4)
function used(d: Diagram, board: string) {
  const out = new Set<string>()
  for (const [a, b] of d.connections)
    for (const ref of [a, b]) {
      const [id, pin] = ref.split(':')
      if (id === board && pin) out.add(pin.replace(/\.\d$/, ''))
    }
  return out
}

// what a part's one signal pin can go on, free pins first in the order connect would pick them
const KIND_OF: Record<string, 'pwm' | 'digital' | 'analog'> = {
  'wokwi-led': 'pwm',
  'wokwi-servo': 'pwm',
  'wokwi-pushbutton': 'digital',
  'wokwi-buzzer': 'digital',
  'wokwi-led-ring': 'digital',
  'wokwi-neopixel': 'digital',
  'wokwi-potentiometer': 'analog',
  'wokwi-photoresistor-sensor': 'analog',
}

export function freePins(d: Diagram, type: keyof typeof PARTS): { pin: string; label: string }[] {
  const b = boardOf(d)
  const kind = KIND_OF[type]
  if (!b || !kind) return []
  const pins = b.kind === 'pico' ? PICO : AVR
  const taken = used(d, b.part.id)
  const list = kind === 'pwm' ? [...pins.pwm, ...pins.digital.filter((p) => !pins.pwm.includes(p))] : pins[kind]
  return list
    .filter((p) => !taken.has(p))
    .map((p) => ({ pin: p, label: `${/^\d+$/.test(p) ? `pin ${p}` : p}${pins.pwm.includes(p) ? ' · pwm' : pins.analog.includes(p) ? ' · analog' : ''}` }))
}

export function connect(d: Diagram, type: keyof typeof PARTS, at: { left: number; top: number }, opts: { pin?: string } = {}): Added {
  const b = boardOf(d)
  if (!b) return { parts: [], connections: [], pins: {}, error: 'There is no board to wire it to' }
  if ('board' in PARTS[type]) return { parts: [], connections: [], pins: {}, error: 'A circuit has one board' }
  const pins = b.kind === 'pico' ? PICO : AVR
  const taken = used(d, b.part.id)
  const B = (pin: string) => `${b.part.id}:${pin}`
  const ids = new Set(d.parts.map((p) => p.id))
  const idFor = (t: string) => {
    const prefix = PREFIX[t] ?? t.replace('wokwi-', '')
    let n = 1
    while (ids.has(`${prefix}${n}`)) n++
    ids.add(`${prefix}${n}`)
    return `${prefix}${n}`
  }
  let signal = d.connections.length
  const color = () => SIGNALS[signal++ % SIGNALS.length]
  // a pin asked for wins when it is free and the right kind
  const take = (list: string[]) => {
    const pin = opts.pin && list.includes(opts.pin) && !taken.has(opts.pin) ? opts.pin : list.find((p) => !taken.has(p))
    if (pin) taken.add(pin)
    return pin
  }
  // grounds and power are shared, any ground pin does, the least used one keeps the drawing tidy
  const ground = () => {
    const count = (g: string) => d.connections.filter(([x, y]) => x === B(g) || y === B(g)).length
    return [...pins.grounds].sort((x, y) => count(x) - count(y))[0]
  }
  const fail = (error: string): Added => ({ parts: [], connections: [], pins: {}, error })

  const id = idFor(type)
  const part: DiagramPart = { type, id, left: at.left, top: at.top, attrs: {} }
  const parts: DiagramPart[] = [part]
  const wires: Connection[] = []
  const got: Record<string, string> = {}
  const wire = (a: string, z: string, c: string) => wires.push([a, z, c, []])
  const five = pins.five
  const logic = b.kind === 'pico' ? pins.three : pins.five

  switch (type) {
    case 'wokwi-led': {
      const pin = take(pins.pwm) ?? take(pins.digital)
      if (!pin) return fail('No free pin left for an led')
      part.attrs = { color: 'red' }
      const r = idFor('wokwi-resistor')
      parts.unshift({ type: 'wokwi-resistor', id: r, left: at.left, top: at.top + 10, attrs: { value: '220' } })
      part.left = at.left + 110
      const c = color()
      wire(B(pin), `${r}:1`, c)
      wire(`${r}:2`, `${id}:A`, c)
      wire(`${id}:C`, B(ground()), GROUND)
      got.A = pin
      break
    }
    case 'wokwi-pushbutton': {
      const pin = take(pins.digital)
      if (!pin) return fail('No free pin left for a button')
      part.attrs = { color: 'green' }
      wire(`${id}:1.l`, B(pin), color())
      wire(`${id}:2.l`, B(ground()), GROUND)
      got['1.l'] = pin
      break
    }
    case 'wokwi-potentiometer': {
      const pin = take(pins.analog)
      if (!pin) return fail('No free analog pin left for a knob')
      wire(`${id}:VCC`, B(logic), POWER)
      wire(`${id}:GND`, B(ground()), GROUND)
      wire(`${id}:SIG`, B(pin), color())
      got.SIG = pin
      break
    }
    case 'wokwi-photoresistor-sensor': {
      const pin = take(pins.analog)
      if (!pin) return fail('No free analog pin left for a light sensor')
      wire(`${id}:VCC`, B(logic), POWER)
      wire(`${id}:GND`, B(ground()), GROUND)
      wire(`${id}:AO`, B(pin), color())
      got.AO = pin
      break
    }
    case 'wokwi-ssd1306': {
      // i2c is a bus, a second screen shares the same two pins at the other address the module offers
      const screens = d.parts.filter((p) => p.type === 'wokwi-ssd1306')
      if (screens.length >= 2) return fail('An ssd1306 has two addresses, both are taken')
      if (screens.some((p) => (p.attrs?.i2cAddress ?? '0x3c') === '0x3c')) part.attrs = { i2cAddress: '0x3d' }
      wire(`${id}:VIN`, B(b.kind === 'pico' ? pins.three : pins.five), POWER)
      wire(`${id}:GND`, B(ground()), GROUND)
      wire(`${id}:DATA`, B(pins.sda), '#38bdf8')
      wire(`${id}:CLK`, B(pins.scl), '#818cf8')
      taken.add(pins.sda).add(pins.scl)
      got.DATA = pins.sda
      got.CLK = pins.scl
      break
    }
    case 'wokwi-servo': {
      const pin = take(pins.pwm)
      if (!pin) return fail('No free pwm pin left for a servo')
      wire(`${id}:V+`, B(five), POWER)
      wire(`${id}:GND`, B(ground()), GROUND)
      wire(`${id}:PWM`, B(pin), color())
      got.PWM = pin
      break
    }
    case 'wokwi-hc-sr04': {
      const trig = take(pins.digital)
      const echo = take(pins.digital)
      if (!trig || !echo) return fail('Not enough free pins for an ultrasonic sensor')
      part.attrs = { distance: '200' }
      wire(`${id}:VCC`, B(five), POWER)
      wire(`${id}:GND`, B(ground()), GROUND)
      wire(`${id}:TRIG`, B(trig), color())
      if (b.kind === 'pico') {
        // its echo swings to 5 v, a pico pin takes 3.3: 1k from ECHO to the pin, 2k from the pin to ground
        const r1 = idFor('wokwi-resistor')
        const r2 = idFor('wokwi-resistor')
        parts.push({ type: 'wokwi-resistor', id: r1, left: at.left, top: at.top + 120, attrs: { value: '1000' } }, { type: 'wokwi-resistor', id: r2, left: at.left + 100, top: at.top + 120, attrs: { value: '2000' } })
        const c = color()
        wire(`${id}:ECHO`, `${r1}:1`, c)
        wire(`${r1}:2`, B(echo), c)
        wire(`${r2}:1`, B(echo), c)
        wire(`${r2}:2`, B(ground()), GROUND)
      } else wire(`${id}:ECHO`, B(echo), color())
      got.TRIG = trig
      got.ECHO = echo
      break
    }
    case 'wokwi-buzzer': {
      const pin = take(pins.digital)
      if (!pin) return fail('No free pin left for a buzzer')
      wire(`${id}:2`, B(pin), color())
      wire(`${id}:1`, B(ground()), GROUND)
      got['2'] = pin
      break
    }
    case 'wokwi-led-ring':
    case 'wokwi-neopixel': {
      const pin = take(pins.digital)
      if (!pin) return fail('No free pin left for the pixels')
      if (type === 'wokwi-led-ring') part.attrs = { pixels: '16' }
      const [vcc, gnd, din] = type === 'wokwi-led-ring' ? ['VCC', 'GND', 'DIN'] : ['VDD', 'VSS', 'DIN']
      wire(`${id}:${vcc}`, B(five), POWER)
      wire(`${id}:${gnd}`, B(ground()), GROUND)
      wire(`${id}:${din}`, B(pin), color())
      got[din] = pin
      break
    }
    case 'wokwi-resistor': {
      part.attrs = { value: '220' }
      break
    }
  }
  return { parts, connections: wires, pins: got }
}
