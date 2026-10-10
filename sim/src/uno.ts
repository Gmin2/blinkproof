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

export function pinOf(name: string) {
  const key = /^\d+$/.test(name) ? `D${name}` : name.toUpperCase()
  const p = PINS[key]
  if (!p) throw new Error(`no pin ${name} on an uno`)
  return p
}

export interface PinEvent {
  pin: string
  high: boolean
  ms: number
}

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

  constructor(hex: string) {
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

    for (const [name, [port, bit]] of Object.entries(PINS)) {
      if (name.startsWith('D') && Number(name.slice(1)) >= 14) continue
      this.ports[port].addListener((value, old) => {
        if (((value ^ old) >> bit) & 1) this.emit(name, ((value >> bit) & 1) === 1)
      })
    }
  }

  get ms() {
    return (this.cpu.cycles / MHZ) * 1000
  }

  private emit(pin: string, high: boolean) {
    const e = { pin, high, ms: this.ms }
    this.timeline.push(e)
    for (const l of this.listeners) l(e)
  }

  onPin(fn: (e: PinEvent) => void) {
    this.listeners.push(fn)
    return () => (this.listeners = this.listeners.filter((l) => l !== fn))
  }

  onSerialLine(fn: (line: string) => void) {
    this.serialListeners.push(fn)
  }

  // the level the sketch drives on a pin
  read(name: string) {
    const [port, bit] = pinOf(name)
    return this.ports[port].pinState(bit) === PinState.High
  }

  // something outside driving a pin, a button or a sensor
  drive(name: string, high: boolean) {
    const [port, bit] = pinOf(name)
    this.ports[port].setPin(bit, high)
  }

  setVolts(name: string, volts: number) {
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
