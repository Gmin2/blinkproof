import { PinState } from 'avr8js'
import type { Board, PinEvent } from '../board'

// one wire, both ways. the board pulls SDA low for at least a millisecond and lets go, the module answers
// 80 us low, 80 us high, then 40 bits, each 50 us low and then 26 us high for a 0 or 70 us for a 1:
// humidity times ten, temperature times ten with the top bit for below zero, and a checksum
export class DHT22 {
  temperature: number
  humidity: number
  reads = 0
  // starts that were too short for it to notice
  short = 0
  private fell = -1
  private busy = false
  private board: Board
  private pin: string

  constructor(board: Board, pin: string, temperature = 24, humidity = 40) {
    this.board = board
    this.pin = pin
    this.temperature = temperature
    this.humidity = humidity
    // the module's pull up holds the line high while nobody talks
    board.drive(pin, true)
    board.onPin((e) => e.pin === pin && this.edge(e))
  }

  private edge(e: PinEvent) {
    if (this.busy) return
    if (e.state === PinState.Low) {
      this.fell = e.cycles
      return
    }
    // let go: back to an input, or driven high, after holding it low
    if (this.fell < 0) return
    const us = (n: number) => (n * this.board.hz) / 1e6
    const held = e.cycles - this.fell
    this.fell = -1
    if (held < us(800)) {
      this.short++
      return
    }
    this.busy = true
    this.reads++
    let t = e.cycles + us(30)
    const at = (high: boolean, after: number) => {
      this.board.at(t, () => this.board.drive(this.pin, high))
      t += us(after)
    }
    at(false, 80)
    at(true, 80)
    for (const bit of this.bits()) {
      at(false, 50)
      at(true, bit ? 70 : 26)
    }
    at(false, 50)
    this.board.at(t, () => {
      this.board.drive(this.pin, true)
      this.busy = false
    })
  }

  private bits() {
    const h = Math.round(Math.min(100, Math.max(0, this.humidity)) * 10)
    const c = Math.round(Math.min(80, Math.max(-40, this.temperature)) * 10)
    const t = c < 0 ? 0x8000 | -c : c
    const bytes = [h >> 8, h & 0xff, t >> 8, t & 0xff]
    bytes.push(bytes.reduce((a, b) => a + b, 0) & 0xff)
    return bytes.flatMap((b) => [7, 6, 5, 4, 3, 2, 1, 0].map((i) => (b >> i) & 1))
  }
}
