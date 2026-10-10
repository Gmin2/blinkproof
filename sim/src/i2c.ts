import type { AVRTWI, TWIEventHandler } from 'avr8js'

export interface I2CDevice {
  address: number
  // first byte after the address is a control byte for some chips, so they get told
  write(byte: number, first: boolean): boolean
  read(): number
  stop?(): void
}

// avr8js gives the twi one handler, this fans it out to every device by address
export class I2CBus implements TWIEventHandler {
  devices: I2CDevice[] = []
  private twi: AVRTWI
  private current: I2CDevice | null = null
  private first = false

  constructor(twi: AVRTWI) {
    this.twi = twi
    twi.eventHandler = this
  }

  add(device: I2CDevice) {
    this.devices.push(device)
    return device
  }

  start() {
    this.twi.completeStart()
  }

  stop() {
    this.current?.stop?.()
    this.current = null
    this.twi.completeStop()
  }

  connectToSlave(addr: number, write: boolean) {
    this.current = this.devices.find((d) => d.address === addr) ?? null
    this.first = write
    this.twi.completeConnect(this.current !== null)
  }

  writeByte(value: number) {
    if (!this.current) return this.twi.completeWrite(false)
    const ack = this.current.write(value, this.first)
    this.first = false
    this.twi.completeWrite(ack)
  }

  readByte(_ack: boolean) {
    this.twi.completeRead(this.current ? this.current.read() : 0xff)
  }
}
