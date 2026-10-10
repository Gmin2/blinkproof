import { PinState } from 'avr8js'
import type { Board, PinEvent } from '../board'


// trigger high for 10 us, it sends 8 pulses at 40 khz, then holds ECHO high for 58 us per cm.
// nothing in range holds it for 38 ms
export class HCSR04 {
  distance: number
  pings = 0
  // triggers that were too short to start a ping
  short = 0
  private rise = -1
  private busy = false
  private board: Board
  private echo: string

  constructor(board: Board, trig: string, echo: string, distance = 400) {
    this.board = board
    this.echo = echo
    this.distance = distance
    board.onPin((e) => e.pin === trig && this.edge(e))
  }

  private edge(e: PinEvent) {
    if (e.state === PinState.High) {
      this.rise = e.cycles
      return
    }
    if (this.rise < 0) return
    const us = (n: number) => (n * this.board.hz) / 1e6
    const width = e.cycles - this.rise
    this.rise = -1
    if (this.busy) return
    if (width < us(10)) {
      this.short++
      return
    }
    this.busy = true
    this.pings++
    // the burst takes 200 us before the echo pin rises
    const start = e.cycles + us(200)
    const cm = this.distance
    const high = cm >= 2 && cm <= 400 ? cm * 58 : 38_000
    this.board.at(start, () => this.board.drive(this.echo, true))
    this.board.at(start + us(high), () => {
      this.board.drive(this.echo, false)
      this.busy = false
    })
  }
}
