import { PinState } from 'avr8js'
import type { Board, PinEvent } from '../board'

// the datasheet: a 0 is high 0.4 us, a 1 is 0.8 us, +-150 ns. adafruit on a 16 mhz avr sends 312 and 812 ns,
// the pico's pio about the same. widths in ns
const ZERO = [200, 600]
const ONE = [601, 1000]
// more than 50 us low latches the colours
const LATCH_NS = 50_000

// a chain of ws2812b pixels on one data pin, a single neopixel or a ring
export class WS2812 {
  pixels: [number, number, number][]
  frames = 0
  // pulses that were neither a 0 nor a 1, a sign of the wrong library or interrupts in the middle
  bad = 0
  private bits: number[] = []
  private rise = -1
  private fall = 0
  private ns: number

  constructor(board: Board, pin: string, count: number) {
    this.ns = 1e9 / board.hz
    this.pixels = Array.from({ length: count }, () => [0, 0, 0])
    board.onPin((e) => e.pin === pin && this.edge(e))
  }

  private edge(e: PinEvent) {
    // only a pin set as an output drives the strip. show() before begin() just flips the pull-up
    const high = e.state === PinState.High
    if (high) {
      if (this.bits.length && (e.cycles - this.fall) * this.ns > LATCH_NS) this.latch()
      this.rise = e.cycles
      return
    }
    if (this.rise < 0) return
    const width = (e.cycles - this.rise) * this.ns
    this.rise = -1
    this.fall = e.cycles
    if (width >= ZERO[0] && width <= ZERO[1]) this.bits.push(0)
    else if (width >= ONE[0] && width <= ONE[1]) this.bits.push(1)
    else this.bad++
  }

  // the bench calls this as time passes, so a frame shows without waiting for the next one
  check(cycles: number) {
    if (this.bits.length && this.rise < 0 && (cycles - this.fall) * this.ns > LATCH_NS) this.latch()
  }

  private latch() {
    // green, red, blue, high bit first. bits past the last pixel go out of DOUT
    const n = Math.min(this.pixels.length, Math.floor(this.bits.length / 24))
    for (let i = 0; i < n; i++) {
      const byte = (k: number) => this.bits.slice(i * 24 + k * 8, i * 24 + k * 8 + 8).reduce((a, b) => (a << 1) | b, 0)
      this.pixels[i] = [byte(1), byte(0), byte(2)]
    }
    this.bits = []
    this.frames++
  }
}
