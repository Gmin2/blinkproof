import { PinState } from 'avr8js'
import { Circuit } from './circuit'
import { Buzzer } from './parts/buzzer'
import { HCSR04 } from './parts/hcsr04'
import { Servo } from './parts/servo'
import { SSD1306 } from './parts/ssd1306'
import { WS2812 } from './parts/ws2812'
import { MHZ, Uno, type Symbols } from './uno'

// what each part is doing, read by the canvas and by tests. a part that is not powered
// or not wired to a pin it can use has null where its model would be
export type PartState =
  | { type: 'wokwi-led'; lit: boolean }
  | { type: 'wokwi-ssd1306'; oled: SSD1306 | null }
  | { type: 'wokwi-potentiometer'; position: number }
  | { type: 'wokwi-pushbutton'; pressed: boolean; presses: number }
  | { type: 'wokwi-neopixel' | 'wokwi-led-ring'; strip: WS2812 | null }
  | { type: 'wokwi-servo'; servo: Servo | null }
  | { type: 'wokwi-hc-sr04'; sensor: HCSR04 | null; distance: number }
  | { type: 'wokwi-buzzer'; buzzer: Buzzer | null }
  | { type: 'wokwi-resistor' | 'wokwi-arduino-uno' }

// same seed every run, so a floating pin or a bouncing button reads the same in every test
function noise(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

// a circuit and a sketch on the bench: the uno runs the hex, every part behaves the way it is wired.
// a part on the wrong pin does what it would do on a real board, which is usually nothing
export class Bench {
  uno: Uno
  circuit: Circuit
  parts: Record<string, PartState> = {}
  private updates: (() => void)[] = []
  private random = noise(7)

  constructor(circuit: Circuit, hex: string, symbols?: Symbols) {
    this.circuit = circuit
    this.uno = new Uno(hex, symbols)
    for (const p of circuit.diagram.parts) {
      const id = p.id
      switch (p.type) {
        case 'wokwi-led': this.led(id); break
        case 'wokwi-ssd1306': this.oled(id); break
        case 'wokwi-potentiometer': this.pot(id); break
        case 'wokwi-pushbutton': this.button(id); break
        case 'wokwi-neopixel': this.strip(id, p.type, 'VDD', 'VSS', 1); break
        case 'wokwi-led-ring': this.strip(id, p.type, 'VCC', 'GND', Number(p.attrs?.pixels ?? 16)); break
        case 'wokwi-servo': this.servo(id); break
        case 'wokwi-hc-sr04': this.sonar(id); break
        case 'wokwi-buzzer': this.buzzer(id); break
        default: this.parts[id] = { type: p.type }
      }
    }
    this.update()
  }

  private powered(id: string, vcc: string, gnd: string, volts = 3.3) {
    return this.circuit.supply(`${id}:${vcc}`) >= volts && this.circuit.onGround(`${id}:${gnd}`)
  }

  // copper to a rail wins, then a pin the sketch drives, then a rail through a resistor
  level(ref: string) {
    const c = this.circuit
    if (c.supply(ref)) return true
    if (c.onGround(ref)) return false
    const pin = c.signal(ref, true)
    if (pin) return this.uno.read(pin)
    if (c.onGround(ref, true)) return false
    return undefined
  }

  private led(id: string) {
    const state = { type: 'wokwi-led' as const, lit: false }
    this.parts[id] = state
    // lit when current can flow from A to C, so a led put in backwards stays dark
    this.updates.push(() => {
      state.lit = this.level(`${id}:A`) === true && this.level(`${id}:C`) === false
    })
  }

  private oled(id: string) {
    const c = this.circuit
    const powered = this.powered(id, 'VIN', 'GND') || this.powered(id, '3V3', 'GND')
    const sda = c.signal(`${id}:DATA`) === 'A4'
    const scl = c.signal(`${id}:CLK`) === 'A5'
    const address = Number(c.attr(id, 'i2cAddress') ?? '0x3c')
    const oled = powered && sda && scl ? (this.uno.i2c.add(new SSD1306(address)) as SSD1306) : null
    this.parts[id] = { type: 'wokwi-ssd1306', oled }
  }

  private pot(id: string) {
    const c = this.circuit
    const start = Number(c.attr(id, 'value') ?? 0) / 1023
    const state = { type: 'wokwi-potentiometer' as const, position: start }
    this.parts[id] = state
    const pin = c.signal(`${id}:SIG`)
    if (!pin?.startsWith('A')) return
    const vcc = c.supply(`${id}:VCC`)
    const grounded = c.onGround(`${id}:GND`)
    this.updates.push(() => {
      this.uno.setVolts(pin, vcc && grounded ? state.position * vcc : 0)
    })
  }

  // a button joins its two sides while pressed. the pin side reads the other side then, and
  // otherwise its pull-up, a resistor, or nothing at all, which on a real board is noise
  private button(id: string) {
    const c = this.circuit
    const state = { type: 'wokwi-pushbutton' as const, pressed: false, presses: 0 }
    this.parts[id] = state
    const sides = [`${id}:1.l`, `${id}:2.l`]
    const i = sides.findIndex((s) => c.signal(s))
    if (i < 0) return
    const pin = c.signal(sides[i])!
    const other = sides[1 - i]
    const far = c.supply(other) ? true : c.onGround(other) ? false : undefined
    const pull = c.supply(sides[i], true) ? true : c.onGround(sides[i], true) ? false : undefined
    const bounces = c.attr(id, 'bounce') !== '0'
    let was = false
    let settle = 0
    let driven: boolean | undefined

    this.updates.push(() => {
      if (state.pressed !== was) {
        was = state.pressed
        if (state.pressed) state.presses++
        // contacts chatter for a millisecond or two after they move
        if (bounces) settle = this.uno.cpu.cycles + (1 + this.random() * 2) * (MHZ / 1000)
      }
      const mode = this.uno.state(pin)
      if (mode === PinState.High || mode === PinState.Low) return
      const resting = pull ?? (mode === PinState.InputPullUp ? true : this.random() < 0.5)
      let level = state.pressed && far !== undefined ? far : resting
      if (this.uno.cpu.cycles < settle && this.random() < 0.5) level = !level
      if (level !== driven) {
        driven = level
        this.uno.drive(pin, level)
      }
    })
  }

  private strip(id: string, type: 'wokwi-neopixel' | 'wokwi-led-ring', vcc: string, gnd: string, count: number) {
    const pin = this.circuit.signal(`${id}:DIN`)
    const strip = pin?.startsWith('D') && this.powered(id, vcc, gnd) ? new WS2812(this.uno, pin, count) : null
    this.parts[id] = { type, strip }
    if (strip) this.updates.push(() => strip.check(this.uno.cpu.cycles))
  }

  private servo(id: string) {
    const pin = this.circuit.signal(`${id}:PWM`)
    const servo = pin && this.powered(id, 'V+', 'GND', 4.8) ? new Servo(this.uno, pin) : null
    this.parts[id] = { type: 'wokwi-servo', servo }
  }

  // it needs 5 v, at 3.3 v it does not range
  private sonar(id: string) {
    const c = this.circuit
    const trig = c.signal(`${id}:TRIG`)
    const echo = c.signal(`${id}:ECHO`)
    const distance = Number(c.attr(id, 'distance') ?? 400)
    const sensor = trig && echo && this.powered(id, 'VCC', 'GND', 5) ? new HCSR04(this.uno, trig, echo, distance) : null
    this.parts[id] = { type: 'wokwi-hc-sr04', sensor, distance }
  }

  private buzzer(id: string) {
    const c = this.circuit
    const [pin, gnd] = c.signal(`${id}:2`) ? [`${id}:2`, `${id}:1`] : [`${id}:1`, `${id}:2`]
    const signal = c.signal(pin)
    const buzzer = signal && c.onGround(gnd) ? new Buzzer(this.uno, signal) : null
    this.parts[id] = { type: 'wokwi-buzzer', buzzer }
    if (buzzer) this.updates.push(() => buzzer.check(this.uno.cpu.cycles))
  }

  // a person turning a knob, pressing a button, or moving the car closer
  control(id: string, name: string, value: number) {
    const part = this.parts[id]
    if (!part) throw new Error(`no part ${id}`)
    if (part.type === 'wokwi-potentiometer' && name === 'position') part.position = Math.min(1, Math.max(0, value))
    else if (part.type === 'wokwi-pushbutton' && name === 'pressed') part.pressed = !!value
    else if (part.type === 'wokwi-hc-sr04' && name === 'distance') {
      part.distance = value
      if (part.sensor) part.sensor.distance = value
    } else throw new Error(`${id} has no control ${name}`)
    this.update()
  }

  update() {
    for (const u of this.updates) u()
  }

  // one line per part, what a person looking at the bench would say. goes into test failures
  describe() {
    const out: string[] = []
    for (const [id, p] of Object.entries(this.parts)) {
      if (p.type === 'wokwi-led') out.push(`${id}: ${p.lit ? 'lit' : 'dark'}`)
      if (p.type === 'wokwi-ssd1306') {
        const text = p.oled?.text()
        out.push(`${id}: ${!p.oled ? 'not on the i2c bus (check DATA on A4, CLK on A5, power)' : !p.oled.on ? 'screen off' : text ? JSON.stringify(text) : 'on, blank'}`)
      }
      if (p.type === 'wokwi-potentiometer') out.push(`${id}: at ${Math.round(p.position * 100)}%`)
      if (p.type === 'wokwi-pushbutton') out.push(`${id}: ${p.pressed ? 'pressed' : 'released'}, ${p.presses} presses`)
      if (p.type === 'wokwi-neopixel' || p.type === 'wokwi-led-ring') {
        if (!p.strip) out.push(`${id}: not powered or DIN not on a digital pin`)
        else {
          const lit = p.strip.pixels.filter((c) => c.some((v) => v > 0)).length
          out.push(`${id}: ${lit} of ${p.strip.pixels.length} lit, ${p.strip.frames} frames${p.strip.bad ? `, ${p.strip.bad} bad pulses` : ''}`)
        }
      }
      if (p.type === 'wokwi-servo') out.push(`${id}: ${!p.servo ? 'not powered or PWM not on a pin' : p.servo.pulses ? `${p.servo.angle} degrees` : 'no pulses yet'}`)
      if (p.type === 'wokwi-hc-sr04') out.push(`${id}: ${!p.sensor ? 'not working (needs 5V, GND, TRIG and ECHO on pins)' : `${p.distance} cm away, ${p.sensor.pings} pings${p.sensor.short ? `, ${p.sensor.short} triggers too short` : ''}`}`)
      if (p.type === 'wokwi-buzzer') out.push(`${id}: ${!p.buzzer ? 'not wired to a pin and GND' : p.buzzer.hz ? `${p.buzzer.hz} hz` : 'silent'}`)
    }
    const mem = this.uno.memory()
    if (mem) {
      out.push(this.uno.collidedAtMs !== undefined
        ? `ram: the stack ran into the heap at ${Math.round(this.uno.collidedAtMs)}ms, memory is corrupted`
        : `ram: ${mem.leastFree} bytes free at the tightest moment, heap ${mem.heapBytes} bytes`)
    }
    return out.join('\n')
  }

  run(ms: number) {
    // parts look at the pins every millisecond of sim time, timed parts act on exact cycles
    const end = this.uno.ms + ms
    while (this.uno.ms < end) {
      this.uno.run(Math.min(1, end - this.uno.ms))
      this.update()
    }
  }
}
