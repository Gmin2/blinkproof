import type { I2CDevice } from '../i2c'

// a 16x2 character lcd behind a pcf8574 backpack. every byte on i2c sets the expander's eight pins:
// P0 RS, P1 RW, P2 E, P3 the backlight, P4..P7 the lcd's D4..D7. the hd44780 takes the data lines when
// E falls, a nibble at a time once it is in 4 bit mode. it starts in 8 bit mode, the way the chip powers up
export class LCD1602 implements I2CDevice {
  address: number
  // display ram, 40 places a row, row two starts at 0x40
  ram = new Uint8Array(0x68).fill(0x20)
  backlight = false
  on = false
  cursor = false
  blink = false
  frames = 0
  private addr = 0
  private step = 1
  private eight = true
  private high: number | null = null
  private pins = 0
  private cgram = false

  constructor(address = 0x27) {
    this.address = address
  }

  write(byte: number) {
    const fell = this.pins & 0x04 && !(byte & 0x04)
    this.pins = byte
    this.backlight = !!(byte & 0x08)
    if (fell) this.latch(byte >> 4, !!(byte & 0x01))
    return true
  }

  read() {
    return this.pins
  }

  private latch(nibble: number, data: boolean) {
    if (this.eight) return this.run(nibble << 4, data)
    if (this.high === null) {
      this.high = nibble
      return
    }
    const b = (this.high << 4) | nibble
    this.high = null
    this.run(b, data)
  }

  private run(b: number, data: boolean) {
    if (data) {
      if (!this.cgram) {
        this.ram[this.addr] = b
        this.move(this.step)
        this.frames++
      }
      return
    }
    if (b & 0x80) {
      const a = b & 0x7f
      this.addr = a >= 0x40 ? Math.min(0x67, a) : Math.min(0x27, a)
      this.cgram = false
    } else if (b & 0x40) this.cgram = true
    else if (b & 0x20) {
      this.eight = !!(b & 0x10)
      this.high = null
    } else if (b & 0x10) {
      // cursor or display shift: only the cursor move matters for what shows
      if (!(b & 0x08)) this.move(b & 0x04 ? 1 : -1)
    } else if (b & 0x08) {
      this.on = !!(b & 0x04)
      this.cursor = !!(b & 0x02)
      this.blink = !!(b & 0x01)
    } else if (b & 0x04) this.step = b & 0x02 ? 1 : -1
    else if (b & 0x02) this.addr = 0
    else if (b & 0x01) {
      this.ram.fill(0x20)
      this.addr = 0
      this.step = 1
      this.frames++
    }
  }

  private move(by: number) {
    const row = this.addr >= 0x40 ? 0x40 : 0
    this.addr = row + ((this.addr - row + by + 40) % 40)
  }

  // what the two visible rows show, 16 characters each
  rows() {
    const row = (start: number) => String.fromCharCode(...this.ram.slice(start, start + 16)).replace(/[^\x20-\x7e]/g, '?')
    return [row(0), row(0x40)]
  }

  // the 32 characters for the canvas
  characters() {
    return Uint8Array.from([...this.ram.slice(0, 16), ...this.ram.slice(0x40, 0x50)])
  }

  // what someone reading it would say it says
  text() {
    return this.on ? this.rows().map((r) => r.trimEnd()).join('\n').trim() : ''
  }

  get cursorAt() {
    return this.addr >= 0x40 ? { x: this.addr - 0x40, y: 1 } : { x: this.addr, y: 0 }
  }
}
