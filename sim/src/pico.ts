import { PinState } from 'avr8js'
import { GPIOPinState, Simulator, USBCDC } from 'rp2040js'
import type { Board, PinEvent } from './board'
import type { I2CDevice } from './i2c'
import { bootromB1 } from './pico-bootrom'

// board time on the pico is in nanoseconds: the firmware may move clk_sys (arduino-pico runs it at 200 mhz),
// parts only need to know how long things took
export const PICO_HZ = 1_000_000_000

// gp0 to gp28, the adc on gp26, 27 and 28
const pin = (name: string) => {
  const m = name.match(/^GP(\d+)$/)
  if (!m || Number(m[1]) > 28) throw new Error(`no pin ${name} on a pico`)
  return Number(m[1])
}

const STATES: Record<number, PinState> = {
  [GPIOPinState.Low]: PinState.Low,
  [GPIOPinState.High]: PinState.High,
  [GPIOPinState.Input]: PinState.Input,
  [GPIOPinState.InputPullUp]: PinState.InputPullUp,
  [GPIOPinState.InputPullDown]: PinState.Input,
  [GPIOPinState.InputBusKeeper]: PinState.Input,
}

const TIMELINE = 20_000

// rp2040's i2c gives one set of callbacks, this hands each transfer to the device at that address
class PicoI2C {
  devices: I2CDevice[] = []
  private current: I2CDevice | null = null
  private first = false

  constructor(i2c: Simulator['rp2040']['i2c'][number]) {
    i2c.onStart = () => i2c.completeStart()
    i2c.onConnect = (address, mode) => {
      this.current = this.devices.find((d) => d.address === address) ?? null
      // mode 0 is a write
      this.first = mode === 0
      i2c.completeConnect(this.current !== null)
    }
    i2c.onWriteByte = (value) => {
      if (!this.current) return i2c.completeWrite(false)
      const ack = this.current.write(value, this.first)
      this.first = false
      i2c.completeWrite(ack)
    }
    i2c.onReadByte = () => i2c.completeRead(this.current ? this.current.read() : 0xff)
    i2c.onStop = () => {
      this.current?.stop?.()
      this.current = null
      i2c.completeStop()
    }
  }

  add(device: I2CDevice) {
    this.devices.push(device)
    return device
  }
}

// a raspberry pi pico on rp2040js running an arduino-pico uf2. Serial is usb cdc like on the real board.
// one core only: rp2040js runs core 0, so setup1() and loop1() never run
export class Pico implements Board {
  readonly hz = PICO_HZ
  sim = new Simulator()
  mcu = this.sim.rp2040
  i2c: PicoI2C
  serial = ''
  timeline: PinEvent[] = []
  private listeners: ((e: PinEvent) => void)[] = []
  private serialListeners: ((text: string) => void)[] = []
  private line = ''
  private cdc: USBCDC

  constructor(uf2: string | Uint8Array) {
    const mcu = this.mcu
    // firmware pokes registers rp2040js does not model, it says so on every write. keep the console quiet
    const quiet = () => {}
    mcu.logger = { debug: quiet, info: quiet, warn: quiet, error: quiet }
    mcu.loadBootrom(bootromB1)
    const bytes = typeof uf2 === 'string' ? Uint8Array.from(atob(uf2), (c) => c.charCodeAt(0)) : uf2
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
    // uf2: 512 byte blocks, target address at 12, payload size at 16, payload from 32
    for (let off = 0; off + 512 <= bytes.length; off += 512) {
      const addr = view.getUint32(off + 12, true)
      const size = view.getUint32(off + 16, true)
      mcu.flash.set(bytes.subarray(off + 32, off + 32 + size), addr - 0x10000000)
    }
    this.cdc = new USBCDC(mcu.usbCtrl)
    this.cdc.onSerialData = (data) => {
      for (const b of data) {
        const ch = String.fromCharCode(b)
        this.serial += ch
        if (ch === '\n') {
          for (const l of this.serialListeners) l(this.line)
          this.line = ''
        } else if (ch !== '\r') this.line += ch
      }
    }
    this.i2c = new PicoI2C(mcu.i2c[0])
    // rp2040js runs the pio on its own timer as fast as it can. we step it here instead, each state machine at
    // its divided clock, so a neopixel's pulses come out as long as on the chip
    for (const pio of mcu.pio as any[]) pio.run = () => {}
    mcu.core.PC = 0x10000000

    mcu.gpio.forEach((gpio, n) => {
      if (n > 28) return
      let last = STATES[gpio.value]
      gpio.addListener(() => {
        const state = STATES[gpio.value]
        if (state === last) return
        last = state
        const e = { pin: `GP${n}`, state, high: state === PinState.High, cycles: this.cycles, ms: this.ms }
        this.timeline.push(e)
        if (this.timeline.length > TIMELINE * 1.5) this.timeline.splice(0, this.timeline.length - TIMELINE)
        for (const l of this.listeners) l(e)
      })
    })
  }

  get cycles() {
    return this.sim.clock.nanos
  }

  // length of one clk_sys cycle, as the firmware set it up
  private get cycleNs() {
    return 1e9 / this.mcu.clkSys
  }

  get ms() {
    return this.sim.clock.nanos / 1e6
  }

  onPin(fn: (e: PinEvent) => void) {
    this.listeners.push(fn)
    return () => (this.listeners = this.listeners.filter((l) => l !== fn))
  }

  onSerialLine(fn: (line: string) => void) {
    this.serialListeners.push(fn)
  }

  state(name: string) {
    return STATES[this.mcu.gpio[pin(name)].value]
  }

  read(name: string) {
    return this.mcu.gpio[pin(name)].value === GPIOPinState.High
  }

  drive(name: string, high: boolean) {
    this.mcu.gpio[pin(name)].setInputValue(high)
  }

  // the adc is 12 bit across 3.3 v; arduino-pico's analogRead scales it to 10 bit
  setVolts(name: string, volts: number) {
    const n = pin(name)
    if (n < 26 || n > 28) throw new Error(`${name} is not an adc pin, the pico has GP26, GP27 and GP28`)
    this.mcu.adc.channelValues[n - 26] = Math.round((Math.min(3.3, Math.max(0, volts)) / 3.3) * 4095)
  }

  at(cycles: number, fn: () => void) {
    const alarm = this.sim.clock.createAlarm(fn)
    alarm.schedule(Math.max(1, cycles - this.cycles))
  }

  writeSerial(byte: number) {
    this.cdc.sendSerialByte(byte)
  }

  // 264 kb of ram, nothing a gadget gets near
  memory() {
    return undefined
  }

  // a state machine that is running and not stalled on its fifo
  private pioBusy() {
    for (const pio of this.mcu.pio as any[]) {
      if (pio.stopped) continue
      for (const m of pio.machines) if (m.enabled && !m.waiting) return true
    }
    return false
  }

  private stepPio(sysCycles: number) {
    for (const pio of this.mcu.pio as any[]) {
      if (pio.stopped) continue
      for (const m of pio.machines) {
        if (!m.enabled) continue
        const div = m.clockDivInt + m.clockDivFrac / 256 || 65536
        m.blinkproofAcc = (m.blinkproofAcc ?? 0) + sysCycles / div
        // an instruction costs one cycle plus its delay, rp2040js counts them in m.cycles
        while (m.blinkproofAcc >= 1) {
          const before = m.cycles
          m.step()
          pio.checkChangedPins()
          m.blinkproofAcc -= Math.max(1, m.cycles - before)
        }
      }
    }
  }

  run(ms: number) {
    const clock = this.sim.clock
    const core = this.mcu.core
    const end = clock.nanos + ms * 1e6
    while (clock.nanos < end) {
      if (core.waiting) {
        // the core sleeps in wfe and wfi: skip to the next timer, unless the pio is still sending
        if (this.pioBusy()) {
          clock.tick(8 * this.cycleNs)
          this.stepPio(8)
        } else clock.tick(Math.min(clock.nanosToNextAlarm, end - clock.nanos))
      } else {
        const cycles = core.executeInstruction()
        clock.tick(cycles * this.cycleNs)
        this.stepPio(cycles)
      }
    }
  }
}
