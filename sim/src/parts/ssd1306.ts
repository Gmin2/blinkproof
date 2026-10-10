import type { I2CDevice } from '../i2c'
import { font } from '../font'

const ONE_ARG = [0x20, 0x81, 0x8d, 0xa8, 0xd3, 0xd5, 0xd9, 0xda, 0xdb]
const TWO_ARGS = [0x21, 0x22]

// 128x64 oled over i2c. keeps its ram page by page like the chip does, and can
// read text back off the screen so tests can check what a user would see
export class SSD1306 implements I2CDevice {
  fb = new Uint8Array(128 * 8)
  on = false
  frames = 0
  private col = 0
  private page = 0
  private c0 = 0
  private c1 = 127
  private p0 = 0
  private p1 = 7
  private mode: 'cmd' | 'data' = 'cmd'
  private pending: number[] = []
  private need = 0

  address: number

  constructor(address = 0x3c) {
    this.address = address
  }

  write(byte: number, first: boolean) {
    if (first) {
      this.mode = byte & 0x40 ? 'data' : 'cmd'
      return true
    }
    if (this.mode === 'data') this.data(byte)
    else this.command(byte)
    return true
  }

  read() {
    return 0xff
  }

  stop() {
    if (this.mode === 'data') this.frames++
  }

  private command(v: number) {
    if (this.need) {
      this.pending.push(v)
      if (--this.need === 0) this.exec()
      return
    }
    this.pending = [v]
    if (TWO_ARGS.includes(v)) this.need = 2
    else if (ONE_ARG.includes(v)) this.need = 1
    else this.exec()
  }

  private exec() {
    const [c, a = 0, b = 0] = this.pending
    if (c === 0x21) {
      this.c0 = this.col = a & 127
      this.c1 = b & 127
    } else if (c === 0x22) {
      this.p0 = this.page = a & 7
      this.p1 = b & 7
    } else if (c === 0xaf) this.on = true
    else if (c === 0xae) this.on = false
    else if (c >= 0xb0 && c <= 0xb7) this.page = c & 7
    else if (c <= 0x0f) this.col = (this.col & 0xf0) | c
    else if (c >= 0x10 && c <= 0x1f) this.col = (this.col & 0x0f) | ((c & 0xf) << 4)
  }

  private data(v: number) {
    this.fb[this.page * 128 + this.col] = v
    if (++this.col > this.c1) {
      this.col = this.c0
      if (++this.page > this.p1) this.page = this.p0
    }
  }

  pixel(x: number, y: number) {
    return (this.fb[(y >> 3) * 128 + x] >> (y & 7)) & 1
  }

  // rgba for a canvas or the wokwi element's imageData
  paint(rgba: Uint8ClampedArray) {
    for (let y = 0; y < 64; y++) {
      for (let x = 0; x < 128; x++) {
        const lit = this.on && this.pixel(x, y)
        const i = (y * 128 + x) * 4
        rgba[i] = rgba[i + 1] = rgba[i + 2] = lit ? 255 : 0
        rgba[i + 3] = 255
      }
    }
  }

  private glyphAt(x: number, y: number, size: number) {
    for (let ch = 32; ch < 127; ch++) {
      let match = true
      for (let cx = 0; cx < 5 && match; cx++) {
        const bits = font[ch * 5 + cx]
        for (let cy = 0; cy < 8 && match; cy++) {
          const py = y + cy * size
          if (py >= 64) continue
          if (((bits >> cy) & 1) !== this.pixel(x + cx * size, py)) match = false
        }
      }
      if (match) return String.fromCharCode(ch)
    }
    return '?'
  }

  private line(y: number, size: number) {
    let line = ''
    for (let x = 0; x + 6 * size <= 128; x += 6 * size) line += this.glyphAt(x, y, size)
    return line.trimEnd()
  }

  // what a person would read on the screen, default gfx font at text size 1 or 2,
  // on its 8px row grid. a row that reads cleaner at size 2 is taken as size 2
  text() {
    if (!this.on) return ''
    const lines: string[] = []
    const junk = (s: string) => (s.match(/\?/g) ?? []).length
    for (let y = 0; y + 8 <= 64; ) {
      const small = this.line(y, 1)
      const big = y + 16 <= 64 ? this.line(y, 2) : ''
      if (big && junk(big) < junk(small) && big.replace(/\?/g, '').length) {
        lines.push(big)
        y += 16
      } else {
        if (small) lines.push(small)
        y += 8
      }
    }
    return lines.join('\n')
  }
}
