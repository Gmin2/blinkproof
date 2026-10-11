import { PinState } from 'avr8js'
import { Circuit } from './circuit'
import { Buzzer } from './parts/buzzer'
import { DHT22 } from './parts/dht22'
import { Duty } from './parts/duty'
import { HCSR04 } from './parts/hcsr04'
import { LCD1602 } from './parts/lcd1602'
import { Servo } from './parts/servo'
import { SSD1306 } from './parts/ssd1306'
import { WS2812 } from './parts/ws2812'
import type { Board } from './board'
import { Pico } from './pico'
import { Uno, type Symbols } from './uno'

// what each part is doing, read by the canvas and by tests. a part that is not powered
// or not wired to a pin it can use has null where its model would be
export type PartState =
  | { type: 'wokwi-led'; lit: boolean; brightness: number }
  | { type: 'wokwi-ssd1306'; oled: SSD1306 | null }
  | { type: 'wokwi-lcd1602'; lcd: LCD1602 | null }
  | { type: 'wokwi-potentiometer'; position: number }
  | { type: 'wokwi-pushbutton'; pressed: boolean; presses: number }
  | { type: 'wokwi-neopixel' | 'wokwi-led-ring'; strip: WS2812 | null }
  | { type: 'wokwi-servo'; servo: Servo | null }
  | { type: 'wokwi-hc-sr04'; sensor: HCSR04 | null; distance: number }
  | { type: 'wokwi-buzzer'; buzzer: Buzzer | null }
  // volts is what AO puts out, dark is DO
  // moving is what the person in front of it does, out is what OUT says, which lags behind by the hold time
  | { type: 'wokwi-pir-motion-sensor'; moving: boolean; out: boolean; powered: boolean; triggers: number }
  | { type: 'wokwi-dht22'; sensor: DHT22 | null; temperature: number; humidity: number }
  | { type: 'wokwi-photoresistor-sensor'; lux: number; volts: number; dark: boolean; powered: boolean }
  | { type: 'wokwi-resistor' | 'wokwi-arduino-uno' | 'wokwi-arduino-nano' | 'wokwi-pi-pico' }

const isDigital = (pin: string) => /^(D\d+|GP\d+)$/.test(pin)
const isAnalog = (pin: string) => /^(A\d|GP2[678])$/.test(pin)

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
  board: Board
  circuit: Circuit
  parts: Record<string, PartState> = {}
  private updates: (() => void)[] = []
  private random = noise(7)
  private pico: boolean

  // firmware is an intel hex for the uno and nano, a base64 uf2 for the pico
  constructor(circuit: Circuit, firmware: string, symbols?: Symbols) {
    this.circuit = circuit
    this.pico = circuit.board.type === 'wokwi-pi-pico'
    this.board = this.pico ? new Pico(firmware) : new Uno(firmware, symbols)
    for (const p of circuit.diagram.parts) {
      const id = p.id
      switch (p.type) {
        case 'wokwi-led': this.led(id); break
        case 'wokwi-ssd1306': this.oled(id); break
        case 'wokwi-lcd1602': this.lcd(id); break
        case 'wokwi-potentiometer': this.pot(id); break
        case 'wokwi-pushbutton': this.button(id); break
        case 'wokwi-neopixel': this.strip(id, p.type, 'VDD', 'VSS', 1); break
        case 'wokwi-led-ring': this.strip(id, p.type, 'VCC', 'GND', Number(p.attrs?.pixels ?? 16)); break
        case 'wokwi-servo': this.servo(id); break
        case 'wokwi-hc-sr04': this.sonar(id); break
        case 'wokwi-buzzer': this.buzzer(id); break
        case 'wokwi-photoresistor-sensor': this.light(id); break
        case 'wokwi-dht22': this.dht(id); break
        case 'wokwi-pir-motion-sensor': this.pir(id); break
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
    if (pin) return this.board.read(pin)
    if (c.onGround(ref, true)) return false
    return undefined
  }

  private led(id: string) {
    const c = this.circuit
    const state = { type: 'wokwi-led' as const, lit: false, brightness: 0 }
    this.parts[id] = state
    const anode = `${id}:A`
    const cathode = `${id}:C`
    // a pin driving the led, high to light it (A side) or low to light it (C side, A on a rail)
    const high = c.onGround(cathode, true) ? c.signal(anode, true) : undefined
    const low = c.supply(anode, true) ? c.signal(cathode, true) : undefined
    const pin = high ?? low
    const duty = pin ? new Duty(this.board, pin) : undefined
    const window = this.board.hz / 50
    this.updates.push(() => {
      if (duty) {
        const d = duty.over(this.board.cycles, window)
        state.brightness = Math.round((high ? d : 1 - d) * 100) / 100
      } else {
        // lit when current can flow from A to C, so a led put in backwards stays dark
        state.brightness = this.level(anode) === true && this.level(cathode) === false ? 1 : 0
      }
      state.lit = state.brightness > 0.02
    })
  }

  private oled(id: string) {
    const c = this.circuit
    const powered = this.powered(id, 'VIN', 'GND') || this.powered(id, '3V3', 'GND')
    // Wire is on A4 and A5 on the arduinos, GP4 and GP5 on the pico
    const sda = c.signal(`${id}:DATA`) === (this.pico ? 'GP4' : 'A4')
    const scl = c.signal(`${id}:CLK`) === (this.pico ? 'GP5' : 'A5')
    const address = Number(c.attr(id, 'i2cAddress') ?? '0x3c')
    const oled = powered && sda && scl ? (this.board.i2c.add(new SSD1306(address)) as SSD1306) : null
    this.parts[id] = { type: 'wokwi-ssd1306', oled }
  }

  private lcd(id: string) {
    const c = this.circuit
    const sda = c.signal(`${id}:SDA`) === (this.pico ? 'GP4' : 'A4')
    const scl = c.signal(`${id}:SCL`) === (this.pico ? 'GP5' : 'A5')
    const address = Number(c.attr(id, 'i2cAddress') ?? '0x27')
    const lcd = this.powered(id, 'VCC', 'GND', 4.5) && sda && scl ? (this.board.i2c.add(new LCD1602(address)) as LCD1602) : null
    this.parts[id] = { type: 'wokwi-lcd1602', lcd }
  }

  private pot(id: string) {
    const c = this.circuit
    const start = Number(c.attr(id, 'value') ?? 0) / 1023
    const state = { type: 'wokwi-potentiometer' as const, position: start }
    this.parts[id] = state
    const pin = c.signal(`${id}:SIG`)
    if (!pin || !isAnalog(pin)) return
    const vcc = c.supply(`${id}:VCC`)
    const grounded = c.onGround(`${id}:GND`)
    this.updates.push(() => {
      this.board.setVolts(pin, vcc && grounded ? state.position * vcc : 0)
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
        if (bounces) settle = this.board.cycles + (1 + this.random() * 2) * (this.board.hz / 1000)
      }
      const mode = this.board.state(pin)
      if (mode === PinState.High || mode === PinState.Low) return
      const resting = pull ?? (mode === PinState.InputPullUp ? true : this.random() < 0.5)
      let level = state.pressed && far !== undefined ? far : resting
      if (this.board.cycles < settle && this.random() < 0.5) level = !level
      if (level !== driven) {
        driven = level
        this.board.drive(pin, level)
      }
    })
  }

  private strip(id: string, type: 'wokwi-neopixel' | 'wokwi-led-ring', vcc: string, gnd: string, count: number) {
    const pin = this.circuit.signal(`${id}:DIN`)
    const strip = pin && isDigital(pin) && this.powered(id, vcc, gnd) ? new WS2812(this.board, pin, count) : null
    this.parts[id] = { type, strip }
    if (strip) this.updates.push(() => strip.check(this.board.cycles))
  }

  private servo(id: string) {
    const pin = this.circuit.signal(`${id}:PWM`)
    const servo = pin && this.powered(id, 'V+', 'GND', 4.8) ? new Servo(this.board, pin) : null
    this.parts[id] = { type: 'wokwi-servo', servo }
  }

  // it needs 5 v, at 3.3 v it does not range
  private sonar(id: string) {
    const c = this.circuit
    const trig = c.signal(`${id}:TRIG`)
    // through resistors too: on a pico ECHO goes through a divider
    const echo = c.signal(`${id}:ECHO`, true)
    const distance = Number(c.attr(id, 'distance') ?? 400)
    const sensor = trig && echo && this.powered(id, 'VCC', 'GND', 5) ? new HCSR04(this.board, trig, echo, distance) : null
    this.parts[id] = { type: 'wokwi-hc-sr04', sensor, distance }
  }

  private buzzer(id: string) {
    const c = this.circuit
    const [pin, gnd] = c.signal(`${id}:2`) ? [`${id}:2`, `${id}:1`] : [`${id}:1`, `${id}:2`]
    const signal = c.signal(pin)
    const buzzer = signal && c.onGround(gnd) ? new Buzzer(this.board, signal) : null
    this.parts[id] = { type: 'wokwi-buzzer', buzzer }
    if (buzzer) this.updates.push(() => buzzer.check(this.board.cycles))
  }

  // the module as wokwi models it: an ldr of 50k at 10 lux, gamma 0.7, over a 10k resistor, so more light
  // is a lower AO. DO goes high once AO passes half the supply, which is the trim pot in the middle, about 100 lux
  private light(id: string) {
    const c = this.circuit
    const state = { type: 'wokwi-photoresistor-sensor' as const, lux: Number(c.attr(id, 'lux') ?? 500), volts: 0, dark: false, powered: false }
    this.parts[id] = state
    const vcc = c.supply(`${id}:VCC`)
    state.powered = !!vcc && c.onGround(`${id}:GND`)
    const ao = c.signal(`${id}:AO`)
    const dout = c.signal(`${id}:DO`)
    this.updates.push(() => {
      if (!state.powered || !vcc) return
      const ohms = 50_000 * Math.pow(10 / Math.max(0.1, state.lux), 0.7)
      state.volts = (vcc * ohms) / (ohms + 10_000)
      state.dark = state.volts > vcc / 2
      if (ao && isAnalog(ao)) this.board.setVolts(ao, state.volts)
      if (dout && isDigital(dout)) this.board.drive(dout, state.dark)
    })
  }

  private dht(id: string) {
    const c = this.circuit
    const temperature = Number(c.attr(id, 'temperature') ?? 24)
    const humidity = Number(c.attr(id, 'humidity') ?? 40)
    const pin = c.signal(`${id}:SDA`)
    // it runs on 3.3 to 6 volts
    const sensor = pin && isDigital(pin) && this.powered(id, 'VCC', 'GND', 3.3) ? new DHT22(this.board, pin, temperature, humidity) : null
    this.parts[id] = { type: 'wokwi-dht22', sensor, temperature, humidity }
  }

  // an hc-sr501: OUT goes high while something moves and holds high for delayTime seconds after it stops
  private pir(id: string) {
    const c = this.circuit
    const state = { type: 'wokwi-pir-motion-sensor' as const, moving: false, out: false, powered: this.powered(id, 'VCC', 'GND', 4.5), triggers: 0 }
    this.parts[id] = state
    const pin = c.signal(`${id}:OUT`)
    const hold = Number(c.attr(id, 'delayTime') ?? 5) * 1000
    let until = 0
    let was = false
    const out = (high: boolean) => {
      state.out = high
      if (pin && isDigital(pin)) this.board.drive(pin, high)
    }
    if (state.powered) out(false)
    this.updates.push(() => {
      if (!state.powered) return
      if (state.moving && !was) state.triggers++
      if (state.moving) out(true)
      if (was && !state.moving) {
        until = this.board.ms + hold
        const end = this.board.cycles + (hold / 1000) * this.board.hz
        this.board.at(end, () => !state.moving && this.board.ms >= until - 1 && out(false))
      }
      was = state.moving
    })
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
    } else if (part.type === 'wokwi-pir-motion-sensor' && name === 'motion') part.moving = !!value
    else if (part.type === 'wokwi-dht22' && (name === 'temperature' || name === 'humidity')) {
      const v = name === 'temperature' ? Math.min(80, Math.max(-40, value)) : Math.min(100, Math.max(0, value))
      part[name] = v
      if (part.sensor) part.sensor[name] = v
    } else if (part.type === 'wokwi-photoresistor-sensor' && name === 'lux') part.lux = Math.min(100_000, Math.max(0.1, value))
    else throw new Error(`${id} has no control ${name}`)
    this.update()
  }

  update() {
    for (const u of this.updates) u()
  }

  // one line per part, what a person looking at the bench would say. goes into test failures
  describe() {
    const out: string[] = []
    for (const [id, p] of Object.entries(this.parts)) {
      if (p.type === 'wokwi-led') out.push(`${id}: ${p.lit ? `lit ${Math.round(p.brightness * 100)}%` : 'dark'}`)
      if (p.type === 'wokwi-ssd1306') {
        const text = p.oled?.text()
        out.push(`${id}: ${!p.oled ? 'not on the i2c bus (check DATA on A4, CLK on A5, power)' : !p.oled.on ? 'screen off' : text ? JSON.stringify(text) : 'on, blank'}`)
      }
      if (p.type === 'wokwi-lcd1602') out.push(`${id}: ${!p.lcd ? 'not on the i2c bus (check SDA on A4, SCL on A5, VCC on 5V)' : !p.lcd.on ? 'display off' : `${JSON.stringify(p.lcd.rows().map((r) => r.trimEnd()))}${p.lcd.backlight ? '' : ', backlight off'}`}`)
      if (p.type === 'wokwi-potentiometer') out.push(`${id}: at ${Math.round(p.position * 100)}%`)
      if (p.type === 'wokwi-pir-motion-sensor') out.push(`${id}: ${!p.powered ? 'not powered, it needs 5V' : `${p.moving ? 'something moving' : 'nothing moving'}, OUT ${p.out ? 'high' : 'low'}, ${p.triggers} triggers`}`)
      if (p.type === 'wokwi-dht22') out.push(`${id}: ${!p.sensor ? 'not powered or SDA not on a digital pin' : `${p.temperature} C, ${p.humidity}% humidity, read ${p.sensor.reads} times${p.sensor.short ? `, ${p.sensor.short} starts too short` : ''}`}`)
      if (p.type === 'wokwi-photoresistor-sensor') out.push(`${id}: ${!p.powered ? 'not powered' : `${p.lux} lux, AO ${p.volts.toFixed(2)} V, DO ${p.dark ? 'high (dark)' : 'low (light)'}`}`)
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
    const mem = this.board.memory()
    if (mem) {
      out.push(this.board.collidedAtMs !== undefined
        ? `ram: the stack ran into the heap at ${Math.round(this.board.collidedAtMs)}ms, memory is corrupted`
        : `ram: ${mem.leastFree} bytes free at the tightest moment, heap ${mem.heapBytes} bytes`)
    }
    return out.join('\n')
  }

  run(ms: number) {
    // parts look at the pins every millisecond of sim time, timed parts act on exact cycles
    const end = this.board.ms + ms
    while (this.board.ms < end) {
      this.board.run(Math.min(1, end - this.board.ms))
      this.update()
    }
  }
}
