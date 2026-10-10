import type { PinState } from 'avr8js'
import type { I2CDevice } from './i2c'

export interface PinEvent {
  pin: string
  // what the pin does now: driven low or high, or an input with or without its pull-up
  state: PinState
  high: boolean
  cycles: number
  ms: number
}

// what the parts and the tests need from a chip, the same for the uno, the nano and the pico.
// pins are named the way the board names them: D13 and A0 on an arduino, GP15 on a pico
export interface Board {
  // clock ticks a second, cycles counts them
  readonly hz: number
  readonly cycles: number
  readonly ms: number
  serial: string
  timeline: PinEvent[]
  i2c: { add(device: I2CDevice): I2CDevice }
  onPin(fn: (e: PinEvent) => void): () => void
  onSerialLine(fn: (line: string) => void): void
  state(pin: string): PinState
  read(pin: string): boolean
  drive(pin: string, high: boolean): void
  setVolts(pin: string, volts: number): void
  // something outside the chip, at an exact tick, like an echo coming back
  at(cycles: number, fn: () => void): void
  writeSerial(byte: number): void
  run(ms: number): void
  memory(): { free: number; leastFree: number; heapBytes: number } | undefined
  collidedAtMs?: number
}
