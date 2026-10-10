import { PinState } from 'avr8js'
import type { Board, PinEvent } from '../board'

// the arduino Servo library maps 0..180 degrees to 544..2400 us, a pulse every 20 ms
const MIN_US = 544
const MAX_US = 2400

export class Servo {
  angle: number
  pulses = 0
  // the last pulse width in us, what the horn is told
  width = 0
  private rise = -1
  private hz: number

  constructor(board: Board, pin: string, start = 90) {
    this.hz = board.hz
    this.angle = start
    board.onPin((e) => e.pin === pin && this.edge(e))
  }

  private edge(e: PinEvent) {
    if (e.state === PinState.High) {
      this.rise = e.cycles
      return
    }
    if (this.rise < 0) return
    const us = ((e.cycles - this.rise) / this.hz) * 1e6
    this.rise = -1
    // a real servo ignores pulses far outside its range, like pwm on the pin
    if (us < 400 || us > 2600) return
    this.width = us
    this.pulses++
    this.angle = Math.round(Math.min(180, Math.max(0, ((us - MIN_US) / (MAX_US - MIN_US)) * 180)))
  }
}
