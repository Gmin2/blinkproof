// a passive buzzer through the speakers, quiet, a square wave like the real thing
export class Speaker {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  on = false
  play(hz: number) {
    if (!this.on || !hz) return this.stop()
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.gain.value = 0.04
      this.gain.connect(this.ctx.destination)
    }
    if (!this.osc) {
      this.osc = this.ctx.createOscillator()
      this.osc.type = 'square'
      this.osc.connect(this.gain!)
      this.osc.start()
    }
    this.osc.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.005)
  }
  stop() {
    this.osc?.stop()
    this.osc?.disconnect()
    this.osc = null
  }
}
