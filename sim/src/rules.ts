import type { Circuit } from './circuit'

// checks on the circuit (and what the sketch says about its pins) before anything runs.
// numbers and their sources: research/notes/03-rule-numbers.md
export type Finding = {
  rule: string
  severity: 'error' | 'warning' | 'info'
  parts: string[]
  message: string
}

const UNO_PWM = [3, 5, 6, 9, 10, 11]
// forward voltage at 20 mA, kingbright 5 mm leds
const VF: Record<string, number> = { red: 1.9, green: 2.0, yellow: 2.0, orange: 2.0, blue: 3.3, white: 3.3 }
// worst case draw on the 5 v rail, ma
const DRAW: Record<string, (attrs: Record<string, string>) => number> = {
  'wokwi-led-ring': (a) => 60 * Number(a.pixels ?? 16),
  'wokwi-neopixel': () => 60,
  'wokwi-servo': () => 360,
  'wokwi-hc-sr04': () => 15,
  'wokwi-ssd1306': () => 20,
}
// pins each part needs wired to work at all
const NEEDS: Record<string, { power: [string, string][]; signals: string[] }> = {
  'wokwi-ssd1306': { power: [['VIN', 'GND'], ['3V3', 'GND']], signals: ['DATA', 'CLK'] },
  'wokwi-led-ring': { power: [['VCC', 'GND']], signals: ['DIN'] },
  'wokwi-neopixel': { power: [['VDD', 'VSS']], signals: ['DIN'] },
  'wokwi-servo': { power: [['V+', 'GND']], signals: ['PWM'] },
  'wokwi-hc-sr04': { power: [['VCC', 'GND']], signals: ['TRIG', 'ECHO'] },
  'wokwi-potentiometer': { power: [['VCC', 'GND']], signals: ['SIG'] },
}

// what the sketch says, read crudely: constants, pinMode, analogWrite, Servo, tone, i2c addresses
// on a pico a bare number is a GP pin, and A0 to A2 are GP26 to GP28
export function readSketch(src = '', pico = false) {
  const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const consts = new Map<string, string>()
  for (const m of code.matchAll(/(?:const\s+)?(?:int|byte|uint8_t|short|long)\s+(\w+)\s*=\s*(A?\d+)\s*;/g)) consts.set(m[1], m[2])
  for (const m of code.matchAll(/#define\s+(\w+)\s+(A?\d+)\b/g)) consts.set(m[1], m[2])
  const pin = (expr: string) => {
    const e = expr.trim()
    const v = consts.get(e) ?? e
    if (!/^A?\d+$/.test(v)) return undefined
    if (pico) return v.startsWith('A') ? `GP${26 + Number(v.slice(1))}` : `GP${v}`
    return v.startsWith('A') ? v : `D${v}`
  }
  const modes = new Map<string, string>()
  for (const m of code.matchAll(/pinMode\s*\(\s*([^,]+?)\s*,\s*(\w+)\s*\)/g)) {
    const p = pin(m[1])
    if (p) modes.set(p, m[2])
  }
  const pwm = [...code.matchAll(/analogWrite\s*\(\s*([^,]+?)\s*,/g)].map((m) => pin(m[1])).filter(Boolean) as string[]
  const addresses = [...code.matchAll(/\.begin\s*\(\s*SSD1306_\w+\s*,\s*(0x[0-9a-fA-F]+)/g)].map((m) => Number(m[1]))
  return { modes, pwm, addresses, servo: /#include\s*<Servo\.h>/.test(code), tone: /\btone\s*\(/.test(code), given: !!src }
}

export function checkRules(c: Circuit, sketch?: string): Finding[] {
  const out: Finding[] = []
  const add = (rule: string, severity: Finding['severity'], parts: string[], message: string) => out.push({ rule, severity, parts, message })
  const pico = c.board.type === 'wokwi-pi-pico'
  const code = readSketch(sketch, pico)
  const board = c.board.id
  const boardName = pico ? 'pico' : c.board.type === 'wokwi-arduino-nano' ? 'nano' : 'uno'
  // what a gpio drives an led with
  const logic = pico ? 3.3 : 5
  const [SDA, SCL] = pico ? ['GP4', 'GP5'] : ['A4', 'A5']

  for (const p of c.diagram.parts) {
    const id = p.id
    const attrs = p.attrs ?? {}

    // parts that cannot work because something is not wired
    const need = NEEDS[p.type]
    if (need) {
      const powered = need.power.some(([v, g]) => c.supply(`${id}:${v}`) && c.onGround(`${id}:${g}`))
      if (!powered) {
        const [v, g] = need.power[0]
        add('no-power', 'error', [id], `${id} gets no power: wire ${id}:${v} to ${board}:5V and ${id}:${g} to a ${board}:GND pin`)
      }
      for (const s of need.signals) {
        // ECHO may reach its pin through a divider, the way the five volt rule asks for on a pico
        if (!c.signal(`${id}:${s}`, s === 'ECHO')) add('unwired', 'error', [id], `${id}:${s} is not wired to a ${board} pin`)
      }
    }

    if (p.type === 'wokwi-led') {
      const color = attrs.color ?? 'red'
      const anode = `${id}:A`
      const cathode = `${id}:C`
      const driven = (ref: string) => c.signal(ref) || c.supply(ref)
      if (driven(anode) && c.onGround(cathode)) {
        add('led-no-resistor', 'error', [id], `${id} has no series resistor, it will pull far over the 20 mA a pin is rated for. put a 220 ohm resistor between ${c.signal(anode) ?? '5V'} and ${id}:A`)
      } else {
        const series = c.diagram.parts.filter((r) => r.type === 'wokwi-resistor' && [anode, cathode].some((end) => c.peers(end).some((q) => q.startsWith(`${r.id}:`))))
        for (const r of series) {
          const ohms = Number(r.attrs?.value ?? 1000)
          const ma = Math.round(((logic - (VF[color] ?? 2)) / ohms) * 1000)
          // the rp2040 drives 4 ma by default, 12 at most
          const limit = pico ? 12 : 20
          if (ma > limit) add('led-resistor-small', 'warning', [id, r.id], `${r.id} is ${ohms} ohm, ${id} gets about ${ma} mA, over the ${limit} mA a ${boardName} pin is good for. use at least ${pico ? 150 : 220} ohm`)
        }
        if (pico && ['blue', 'white'].includes(color) && c.signal(anode, true)) {
          add('led-vf', 'warning', [id], `a ${color} led needs about 3.3 V forward, a 3.3 V pico pin barely lights it. use red or green, or switch it from VBUS with a transistor`)
        }
      }
      if (c.onGround(anode) && (c.signal(cathode, true) || c.supply(cathode, true))) {
        add('led-backwards', 'error', [id], `${id} is in backwards: A (the long leg) goes toward the pin, C to GND`)
      }
    }

    if (p.type === 'wokwi-pushbutton') {
      const sides = [`${id}:1.l`, `${id}:2.l`]
      const i = sides.findIndex((s) => c.signal(s))
      if (i < 0) add('unwired', 'error', [id], `${id} is not wired to a ${board} pin`)
      else {
        const pin = c.signal(sides[i])!
        const far = sides[1 - i]
        const pullUp = c.supply(sides[i], true) > 0
        const pullDown = c.onGround(sides[i], true) && !c.onGround(sides[i])
        if (c.onGround(far)) {
          if (!pullUp && code.given && code.modes.get(pin) !== 'INPUT_PULLUP') {
            add('floating-button', 'warning', [id], `${pin} floats while ${id} is not pressed and will read random values. use pinMode(${pin.replace(/^D/, '')}, INPUT_PULLUP) and read LOW as pressed`)
          }
        } else if (c.supply(far)) {
          if (!pullDown) add('floating-button', 'warning', [id], `${id} pulls ${pin} up to 5V but nothing pulls it down when released. add a 10k resistor from ${pin} to GND, or wire the button to GND and use INPUT_PULLUP`)
        } else add('unwired', 'error', [id], `the other side of ${id} goes nowhere, wire it to GND`)
        if (pin === 'D13' && code.modes.get(pin) === 'INPUT_PULLUP') add('pin13-input', 'warning', [id], 'D13 has the onboard led on it, its pull-up only reaches about 1.7 V. use another pin for the button')
      }
    }

    if (p.type === 'wokwi-ssd1306') {
      const sda = c.signal(`${id}:DATA`)
      const scl = c.signal(`${id}:CLK`)
      if ((sda && sda !== SDA) || (scl && scl !== SCL)) {
        add('i2c-pins', 'error', [id], `Wire on the ${boardName} is ${SDA} and ${SCL}: ${id}:DATA (SDA) to ${SDA} and ${id}:CLK (SCL) to ${SCL}. now DATA is on ${sda ?? 'nothing'}, CLK on ${scl ?? 'nothing'}`)
      }
      const address = Number(attrs.i2cAddress ?? '0x3c')
      for (const a of code.addresses) {
        if (a !== address) add('i2c-address', 'error', [id], `the sketch talks to 0x${a.toString(16)}, ${id} answers at 0x${address.toString(16)}. use display.begin(SSD1306_SWITCHCAPVCC, 0x${address.toString(16).toUpperCase()})`)
      }
    }

    if (p.type === 'wokwi-hc-sr04' && c.supply(`${id}:VCC`) && c.supply(`${id}:VCC`) < 5) {
      add('sonar-5v', 'error', [id], `${id} is a 5 V part and does not range at 3.3 V. wire ${id}:VCC to ${pico ? 'VBUS' : '5V'}`)
    }

    if ((p.type === 'wokwi-led-ring' || p.type === 'wokwi-neopixel') && c.signal(`${id}:DIN`)) {
      add('neopixel-resistor', 'info', [id], `adafruit advises a 300 to 500 ohm resistor on ${id}:DIN near the first pixel`)
    }
  }

  // two oleds at one address
  const oleds = c.diagram.parts.filter((p) => p.type === 'wokwi-ssd1306')
  const seen = new Map<number, string>()
  for (const o of oleds) {
    const a = Number(o.attrs?.i2cAddress ?? '0x3c')
    if (seen.has(a)) add('i2c-address', 'error', [seen.get(a)!, o.id], `${seen.get(a)} and ${o.id} both answer at 0x${a.toString(16)}, set one to 0x3d`)
    seen.set(a, o.id)
  }

  // board pins: shorts, serial pins, sharing, pwm
  const users = new Map<string, string[]>()
  for (const p of c.diagram.parts) {
    if (p.id === board || p.type === 'wokwi-resistor') continue
    const pins = new Set<string>()
    for (const conn of c.diagram.connections) {
      for (const end of [conn[0], conn[1]]) {
        if (!end.startsWith(`${p.id}:`)) continue
        const pin = c.signal(end)
        if (pin) pins.add(pin)
      }
    }
    for (const pin of pins) users.set(pin, [...(users.get(pin) ?? []), p.id])
  }
  for (const [pin, ids] of users) {
    const n = pin.replace(/^D/, '')
    const pins = c.boardPins(`${board}:${n}`)
    if (pins.some((q) => q.startsWith('GND')) || pins.includes('5V') || pins.includes('3.3V')) {
      add('short', 'error', ids, `${pin} is wired straight to ${pins.find((q) => !/^(\d+|A\d(\.2)?)$/.test(q))}, writing it high or low shorts the pin`)
    }
    if (/^A[67]$/.test(pin) && ids.some((id) => c.parts.get(id)?.type !== 'wokwi-potentiometer')) {
      add('analog-only', 'error', ids, `${pin} on the nano is analog input only, it cannot drive or read a digital part. move ${ids.join(', ')} to a digital pin`)
    }
    if (!pico && (pin === 'D0' || pin === 'D1')) add('serial-pins', 'warning', ids, `${pin} is the usb serial line, using it breaks Serial and can fail uploads. move ${ids.join(', ')} to another pin`)
    if (ids.length > 1 && !(pin === 'A4' || pin === 'A5')) add('shared-pin', 'warning', ids, `${ids.join(' and ')} share ${pin}, give each its own pin`)
  }

  if (pico) {
    for (const p of c.diagram.parts) {
      // the rp2040 is not 5 v tolerant, a pin holds IOVDD + 0.5 = 3.8 V at most
      const outputs: [string, string][] =
        p.type === 'wokwi-hc-sr04' ? [['ECHO', 'VCC']] : p.type === 'wokwi-ssd1306' ? [['DATA', 'VIN'], ['CLK', 'VIN']] : []
      for (const [out, vcc] of outputs) {
        const gp = c.signal(`${p.id}:${out}`)
        if (gp && c.supply(`${p.id}:${vcc}`) === 5) {
          const why = p.type === 'wokwi-hc-sr04' ? 'its ECHO swings to 5 V' : 'the module pulls SDA and SCL up to its VIN'
          add('five-volt-pin', 'error', [p.id], `${p.id} is on 5 V and ${why}, straight into ${gp}. the rp2040 takes 3.8 V at most. ${p.type === 'wokwi-hc-sr04' ? `put a divider on ECHO (1k from ECHO to ${gp}, 2k from ${gp} to GND)` : `power ${p.id} from 3V3`}`)
        }
      }
      if (p.type === 'wokwi-potentiometer') {
        const sig = c.signal(`${p.id}:SIG`)
        if (sig && !/^GP2[678]$/.test(sig)) add('adc-pin', 'error', [p.id], `${p.id}:SIG is on ${sig}, the pico reads analog only on GP26, GP27 and GP28`)
      }
    }
    for (const [pin, ids] of users) {
      if (pin === 'GP25') add('onboard-led', 'warning', ids, 'GP25 drives the onboard led on a pico, pick another pin for parts')
    }
  }

  for (const [pin, mode] of code.modes) {
    if (/^A[67]$/.test(pin)) add('analog-only', 'error', [board], `pinMode(${pin}, ${mode}) does nothing, A6 and A7 on the nano are analog input only. use analogRead(${pin})`)
  }

  // every pico gpio has pwm
  for (const pin of pico ? [] : code.pwm) {
    const n = Number(pin.replace(/^D/, ''))
    if (!pin.startsWith('D') || !UNO_PWM.includes(n)) add('pwm-pin', 'error', [board], `analogWrite on ${pin} does not fade, the ${boardName} has pwm on ${UNO_PWM.join(', ')} only`)
    else if (code.servo && (n === 9 || n === 10)) add('pwm-pin', 'warning', [board], `the Servo library takes timer1, analogWrite on ${pin} stops working. use pin 3, 5, 6 or 11`)
    else if (code.tone && (n === 3 || n === 11)) add('pwm-pin', 'warning', [board], `tone() takes timer2, analogWrite on ${pin} stops working while a tone plays. use 5, 6, 9 or 10`)
  }

  // the 5 v rail from usb, worst case
  let ma = 0
  const loads: string[] = []
  for (const p of c.diagram.parts) {
    const draw = DRAW[p.type]
    const vcc = NEEDS[p.type]?.power[0][0]
    if (draw && vcc && c.supply(`${p.id}:${vcc}`) === 5) {
      ma += draw(p.attrs ?? {})
      loads.push(p.id)
    }
  }
  if (ma > 400) {
    add('rail-budget', 'warning', loads, `the 5V rail could draw ${ma} mA at worst (${loads.join(', ')}), usb gives 500 mA before the fuse trips. keep pixels dim with setBrightness or power them separately`)
  }

  const order = { error: 0, warning: 1, info: 2 }
  return out.sort((a, b) => order[a.severity] - order[b.severity])
}
