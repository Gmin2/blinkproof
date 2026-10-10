import { PinState } from 'avr8js'
import type { Uno } from '../uno'

// how much of the last few milliseconds a pin was high, so a pwm led looks dim and a fade looks like a fade
export class Duty {
  private edges: { cycles: number; high: boolean }[] = []
  private before: boolean

  constructor(uno: Uno, pin: string) {
    this.before = uno.read(pin)
    uno.onPin((e) => e.pin === pin && this.edges.push({ cycles: e.cycles, high: e.state === PinState.High }))
  }

  over(now: number, window: number) {
    const start = now - window
    // forget edges older than the window, remembering the level they left
    let drop = 0
    while (drop < this.edges.length && this.edges[drop].cycles <= start) this.before = this.edges[drop++].high
    if (drop) this.edges.splice(0, drop)
    let high = 0
    let level = this.before
    let t = start
    for (const e of this.edges) {
      if (level) high += e.cycles - t
      level = e.high
      t = e.cycles
    }
    if (level) high += now - t
    return high / window
  }
}
