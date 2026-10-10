import {
  AVRADC,
  AVRIOPort,
  AVRTimer,
  AVRTWI,
  AVRUSART,
  CPU,
  PinState,
  adcConfig,
  avrInstruction,
  portBConfig,
  portCConfig,
  portDConfig,
  timer0Config,
  timer1Config,
  timer2Config,
  twiConfig,
  usart0Config,
} from 'avr8js'
import { loadHex } from './hex'
import { I2CBus } from './i2c'

export const MHZ = 16_000_000

type Port = 'B' | 'C' | 'D'

// arduino pin names to the 328p port and bit
const PINS: Record<string, [Port, number]> = {}
for (let i = 0; i <= 7; i++) PINS[`D${i}`] = ['D', i]
for (let i = 8; i <= 13; i++) PINS[`D${i}`] = ['B', i - 8]
for (let i = 0; i <= 5; i++) {
  PINS[`A${i}`] = ['C', i]
  PINS[`D${14 + i}`] = ['C', i]
}

export const unoPins = Object.keys(PINS)

// on the nano A6 and A7 reach the adc and nothing else
const ANALOG_ONLY = /^A[67]$/

export function pinOf(name: string) {
  const key = /^\d+$/.test(name) ? `D${name}` : name.toUpperCase()
  const p = PINS[key]
  if (!p) throw new Error(`no pin ${name} on an uno`)
  return p
}

export interface PinEvent {
  pin: string
  // what the pin does now: driven low or high, or an input with or without its pull-up
  state: PinState
  high: boolean
  cycles: number
  ms: number
}

// where avr-libc keeps its heap pointer, from the compiler's symbol table
export type Symbols = { brkval?: number; heapStart?: number }

const RAMEND = 0x8ff

// enough history for a test to look back a few seconds without the browser filling up
const TIMELINE = 20_000

export class Uno {
  cpu: CPU
  ports: Record<Port, AVRIOPort>
  usart: AVRUSART
  adc: AVRADC
  i2c: I2CBus
  serial = ''
  timeline: PinEvent[] = []
  private listeners: ((e: PinEvent) => void)[] = []
  private serialListeners: ((text: string) => void)[] = []
  private line = ''
  private symbols: Symbols
  // the lowest the stack pointer has been
  minSp = RAMEND
  // when the stack first grew down into the heap, the moment memory got corrupted
  collidedAtMs?: number

  constructor(hex: string, symbols: Symbols = {}) {
    this.symbols = symbols
    // 2k of ram like the real chip, avr8js defaults to 8k which hides out of memory bugs
    this.cpu = new CPU(loadHex(hex), 2048)
    new AVRTimer(this.cpu, timer0Config)
    new AVRTimer(this.cpu, timer1Config)
    new AVRTimer(this.cpu, timer2Config)
    this.ports = {
      B: new AVRIOPort(this.cpu, portBConfig),
      C: new AVRIOPort(this.cpu, portCConfig),
      D: new AVRIOPort(this.cpu, portDConfig),
    }
    this.usart = new AVRUSART(this.cpu, usart0Config, MHZ)
    this.usart.onByteTransmit = (b) => {
      const ch = String.fromCharCode(b)
      this.serial += ch
      if (ch === '\n') {
        for (const l of this.serialListeners) l(this.line)
        this.line = ''
      } else if (ch !== '\r') this.line += ch
    }
    this.adc = new AVRADC(this.cpu, adcConfig)
    this.i2c = new I2CBus(new AVRTWI(this.cpu, twiConfig, MHZ))

    // the port tells us when PORT or DDR is written, we report the pins whose state changed
    for (const port of ['B', 'C', 'D'] as Port[]) {
      const pins = Object.entries(PINS).filter(([n, [p]]) => p === port && !(n.startsWith('D') && Number(n.slice(1)) >= 14))
      const last = pins.map(([, [, bit]]) => this.ports[port].pinState(bit))
      this.ports[port].addListener(() => {
        pins.forEach(([name, [, bit]], i) => {
          const state = this.ports[port].pinState(bit)
          if (state !== last[i]) {
            last[i] = state
            this.emit(name, state)
          }
        })
      })
    }
  }

  // the top of the heap: what malloc has handed out so far
  heapEnd() {
    const { brkval, heapStart } = this.symbols
    if (brkval === undefined || heapStart === undefined) return undefined
    const v = this.cpu.data[brkval] | (this.cpu.data[brkval + 1] << 8)
    return v || heapStart
  }

  // bytes between the heap and the stack, now and at the tightest moment so far
  memory() {
    const heap = this.heapEnd()
    if (heap === undefined) return undefined
    return { free: this.cpu.SP - heap, leastFree: this.minSp - heap, heapBytes: heap - this.symbols.heapStart! }
  }

  get ms() {
    return (this.cpu.cycles / MHZ) * 1000
  }

  private emit(pin: string, state: PinState) {
    const e = { pin, state, high: state === PinState.High, cycles: this.cpu.cycles, ms: this.ms }
    this.timeline.push(e)
    if (this.timeline.length > TIMELINE * 1.5) this.timeline.splice(0, this.timeline.length - TIMELINE)
    for (const l of this.listeners) l(e)
  }

  onPin(fn: (e: PinEvent) => void) {
    this.listeners.push(fn)
    return () => (this.listeners = this.listeners.filter((l) => l !== fn))
  }

  // something outside the chip, at an exact cycle, like an echo coming back
  at(cycles: number, fn: () => void) {
    this.cpu.addClockEvent(fn, Math.max(1, Math.round(cycles - this.cpu.cycles)))
  }

  onSerialLine(fn: (line: string) => void) {
    this.serialListeners.push(fn)
  }

  state(name: string) {
    if (ANALOG_ONLY.test(name)) return PinState.Input
    const [port, bit] = pinOf(name)
    return this.ports[port].pinState(bit)
  }

  // the level the sketch drives on a pin
  read(name: string) {
    if (ANALOG_ONLY.test(name)) return false
    const [port, bit] = pinOf(name)
    return this.ports[port].pinState(bit) === PinState.High
  }

  // something outside driving a pin, a button or a sensor
  drive(name: string, high: boolean) {
    if (ANALOG_ONLY.test(name)) return
    const [port, bit] = pinOf(name)
    this.ports[port].setPin(bit, high)
  }

  setVolts(name: string, volts: number) {
    // the nano's A6 and A7 go to the adc only, no port behind them
    const only = name.match(/^A([67])$/)
    if (only) {
      this.adc.channelValues[Number(only[1])] = volts
      return
    }
    const [port, bit] = pinOf(name)
    if (port !== 'C') throw new Error(`${name} is not an analog pin`)
    this.adc.channelValues[bit] = volts
  }

  run(ms: number) {
    const end = this.cpu.cycles + (ms * MHZ) / 1000
    const cpu = this.cpu
    while (cpu.cycles < end) {
      avrInstruction(cpu)
      cpu.tick()
      const sp = cpu.SP
      if (sp < this.minSp) {
        this.minSp = sp
        if (this.collidedAtMs === undefined) {
          const heap = this.heapEnd()
          if (heap !== undefined && sp < heap) this.collidedAtMs = this.ms
        }
      }
    }
  }

  runUntil(check: () => boolean, maxMs: number, stepMs = 1) {
    const end = this.ms + maxMs
    while (this.ms < end) {
      if (check()) return true
      this.run(stepMs)
    }
    return check()
  }
}
