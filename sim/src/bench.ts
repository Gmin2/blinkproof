import { Circuit } from './circuit'
import { SSD1306 } from './parts/ssd1306'
import { Uno } from './uno'

// what the screen shows for each part, read by the canvas and by tests
export type PartState =
  | { type: 'wokwi-led'; lit: boolean }
  | { type: 'wokwi-ssd1306'; oled: SSD1306 | null }
  | { type: 'wokwi-potentiometer'; position: number }

// a circuit and a sketch on the bench: the uno runs the hex, every part behaves the way it is wired.
// a part on the wrong pin does what it would do on a real board, which is usually nothing
export class Bench {
  uno: Uno
  circuit: Circuit
  parts: Record<string, PartState> = {}
  private updates: (() => void)[] = []

  constructor(circuit: Circuit, hex: string) {
    this.circuit = circuit
    this.uno = new Uno(hex)
    for (const p of circuit.diagram.parts) {
      if (p.type === 'wokwi-led') this.led(p.id)
      if (p.type === 'wokwi-ssd1306') this.oled(p.id)
      if (p.type === 'wokwi-potentiometer') this.pot(p.id)
    }
    this.update()
  }

  // copper to a rail wins, then a pin the sketch drives, then a rail through a resistor
  private level(ref: string) {
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
    const powered = (c.supply(`${id}:VIN`) || c.supply(`${id}:3V3`)) && c.onGround(`${id}:GND`)
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

  // a person turning a knob or pressing a button
  control(id: string, name: string, value: number) {
    const part = this.parts[id]
    if (!part) throw new Error(`no part ${id}`)
    if (part.type === 'wokwi-potentiometer' && name === 'position') part.position = Math.min(1, Math.max(0, value))
    else throw new Error(`${id} has no control ${name}`)
    this.update()
  }

  update() {
    for (const u of this.updates) u()
  }

  run(ms: number) {
    // parts look at the pins every millisecond of sim time
    const end = this.uno.ms + ms
    while (this.uno.ms < end) {
      this.uno.run(Math.min(1, end - this.uno.ms))
      this.update()
    }
  }
}
