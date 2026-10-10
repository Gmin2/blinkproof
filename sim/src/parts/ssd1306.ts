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
      for (let cx = 0; cx < 6 && match; cx++) {
        const bits = cx < 5 ? font[ch * 5 + cx] : 0
        for (let cy = 0; cy < 8 && match; cy++) {
          const want = (bits >> cy) & 1
          for (let sx = 0; sx < size && match; sx++) {
            for (let sy = 0; sy < size && match; sy++) {
              const px = x + cx * size + sx
              const py = y + cy * size + sy
              const lit = px < 128 && py < 64 && px >= 0 && py >= 0 ? this.pixel(px, py) : 0
              if (lit !== want) match = false
            }
          }
        }
      }
      if (match) return String.fromCharCode(ch)
    }
    return undefined
  }

  private litColumn(from: number, y0: number, y1: number) {
    for (let x = from; x < 128; x++) {
      for (let y = Math.max(0, y0); y < Math.min(64, y1); y++) if (this.pixel(x, y)) return x
    }
    return -1
  }

  // one line of text in rows y.. at this size, wherever it starts. each glyph is found on its own,
  // so text printed at another x later on the same line still reads
  private readLine(y: number, size: number) {
    let text = ''
    let pos = 0
    let junk = 0
    for (;;) {
      const c = this.litColumn(pos, y, y + 8 * size)
      if (c < 0) break
      let found: { ch: string; at: number } | undefined
      for (let dx = 0; dx <= 2 * size && !found; dx++) {
        const at = c - dx
        if (at < pos - size || at < 0) break
        const ch = this.glyphAt(at, y, size)
        if (ch && ch !== ' ') found = { ch, at }
      }
      if (text && found) text += ' '.repeat(Math.max(0, Math.round((found.at - pos) / (6 * size))))
      if (found) {
        text += found.ch
        pos = found.at + 6 * size
      } else {
        text += '?'
        junk++
        pos = c + size
      }
    }
    return { text: text.trimEnd(), junk }
  }

  private rowLit(y: number) {
    for (let x = 0; x < 128; x++) if (this.pixel(x, y)) return true
    return false
  }

  // what a person would read on the screen: lines of the default gfx font at any size from 1 to 4,
  // at any x and y
  text() {
    if (!this.on) return ''
    const lines: string[] = []
    let y = 0
    while (y < 64) {
      if (!this.rowLit(y)) {
        y++
        continue
      }
      let best: { text: string; junk: number; top: number; size: number } | undefined
      for (const size of [1, 2, 3, 4]) {
        // lowercase letters start a row or two below the top of the glyph box
        for (let dy = 0; dy <= 2 * size; dy++) {
          const top = y - dy
          if (top < 0) break
          const r = this.readLine(top, size)
          const score = r.text.replace(/[? ]/g, '').length - 3 * r.junk
          const bestScore = best ? best.text.replace(/[? ]/g, '').length - 3 * best.junk : -Infinity
          if (r.text && score > bestScore) best = { ...r, top, size }
        }
      }
      if (!best) {
        y++
        continue
      }
      lines.push(best.text)
      y = best.top + 8 * best.size
    }
    return lines.join('\n')
  }
}
