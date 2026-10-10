import { PinState } from 'avr8js'
import type { Board, PinEvent } from '../board'

export type Note = { hz: number; startMs: number; ms: number }

// a passive buzzer: it sounds while the pin toggles, a steady high is silence
export class Buzzer {
  hz = 0
  notes: Note[] = []
  private lastRise = -1
  private periods: number[] = []
  private current: Note | null = null
  private clock: number

  constructor(board: Board, pin: string) {
    this.clock = board.hz
    board.onPin((e) => e.pin === pin && this.edge(e))
  }

  private edge(e: PinEvent) {
    if (e.state !== PinState.High) return
    if (this.lastRise >= 0) {
      const period = e.cycles - this.lastRise
      // below 20 hz it is clicks, not a tone
      if (period < this.clock / 20) {
        this.periods.push(period)
        if (this.periods.length > 8) this.periods.shift()
        const avg = this.periods.reduce((a, b) => a + b, 0) / this.periods.length
        const hz = Math.round((this.clock / avg) * 10) / 10
        const ms = (e.cycles / this.clock) * 1000
        if (!this.current || Math.abs(this.current.hz - hz) > Math.max(2, hz * 0.02)) {
          this.current = { hz, startMs: ms, ms: 0 }
          this.notes.push(this.current)
          if (this.notes.length > 500) this.notes.shift()
        }
        this.current.hz = hz
        this.current.ms = ms - this.current.startMs
        this.hz = hz
      } else this.periods = []
    }
    this.lastRise = e.cycles
  }

  // silent once the pin stops toggling for a few periods
  check(cycles: number) {
    if (!this.hz || this.lastRise < 0) return
    if (cycles - this.lastRise > Math.max(3 * (this.clock / this.hz), this.clock / 100)) {
      this.hz = 0
      this.current = null
      this.periods = []
    }
  }
}
