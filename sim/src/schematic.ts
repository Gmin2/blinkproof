import { PARTS } from './catalog'
import type { Diagram, DiagramPart } from './circuit'

// the circuit as a schematic: every part as its symbol, power and ground as symbols, and signals joined by
// name instead of by long wires. laid out from the nets every time, so it always agrees with the circuit.
// units are a 10 grid, the pin pitch

export type Pt = [number, number]
export type Dir = 'l' | 'r' | 'u' | 'd'
export type SymKind = 'board' | 'box' | 'led' | 'switch' | 'buzzer' | 'resistor'
export type Sym = { id: string; type: string; kind: SymKind; ref: string; value: string; x: number; y: number; w: number; h: number; vertical?: boolean }
// a pin: its line from the body out to where the wire starts, its name inside the body and its number outside
export type SPin = { part: string; pin: string; name: string; num: string; side: Dir; from: Pt; to: Pt; net: string }
export type SWire = { net: string; pts: Pt[] }
// a net label: the text sits above the wire, starting at `at` and running toward `side`
export type SLabel = { net: string; name: string; at: Pt; side: 'l' | 'r' }
export type SPower = { net: string; name: string; at: Pt }
export type SGround = { net: string; at: Pt }
export type NetKind = 'power' | 'ground' | 'signal' | 'local'
export type SNet = { id: string; name: string; kind: NetKind; pins: { part: string; pin: string }[] }
export type Sheet = { w: number; h: number; symbols: Sym[]; pins: SPin[]; wires: SWire[]; labels: SLabel[]; powers: SPower[]; grounds: SGround[]; nets: SNet[] }

const BOARDS = ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-pi-pico']
const POWER = ['5V', '5V.2', '3V3', '3.3V', 'VIN', 'VBUS', 'VSYS']
const GROUND = /^GND(\.\d+)?$/
// the order the legs come out of the real part, which is how its pins are numbered
const ORDER: Record<string, string[]> = {
  'wokwi-ssd1306': ['GND', 'VIN', 'CLK', 'DATA'],
  'wokwi-led-ring': ['DIN', 'VCC', 'GND', 'DOUT'],
  'wokwi-neopixel': ['DIN', 'VDD', 'VSS', 'DOUT'],
}
const TWO: Record<string, { kind: SymKind; pins: [string, string]; w: number; h: number }> = {
  'wokwi-led': { kind: 'led', pins: ['A', 'C'], w: 12, h: 12 },
  'wokwi-buzzer': { kind: 'buzzer', pins: ['2', '1'], w: 22, h: 22 },
  'wokwi-pushbutton': { kind: 'switch', pins: ['1.l', '2.l'], w: 12, h: 20 },
  'wokwi-resistor': { kind: 'resistor', pins: ['1', '2'], w: 7, h: 18 },
}
const PREFIX: Record<string, string> = {
  'wokwi-led': 'D', 'wokwi-rgb-led': 'D', 'wokwi-led-ring': 'D', 'wokwi-neopixel': 'D', 'wokwi-resistor': 'R', 'wokwi-pushbutton': 'SW',
  'wokwi-slide-switch': 'SW', 'wokwi-buzzer': 'BZ', 'wokwi-potentiometer': 'RV', 'wokwi-servo': 'M', 'wokwi-7segment': 'DS',
}
const VALUE: Record<string, string> = {
  'wokwi-arduino-uno': 'arduino uno', 'wokwi-arduino-nano': 'arduino nano', 'wokwi-pi-pico': 'pi pico', 'wokwi-led-ring': 'ws2812 ring',
  'wokwi-neopixel': 'ws2812', 'wokwi-pushbutton': 'button', 'wokwi-potentiometer': 'pot', 'wokwi-servo': 'servo', 'wokwi-pir-motion-sensor': 'pir',
  'wokwi-photoresistor-sensor': 'ldr module', 'wokwi-lcd1602': 'lcd1602 i2c', 'wokwi-7segment': '7 segment', 'wokwi-slide-switch': 'slide switch', 'wokwi-rgb-led': 'rgb led',
}
const ohms = (v: string) => (Number(v) >= 1000 ? `${Number(v) / 1000}k` : v)
const valueOf = (p: DiagramPart) => (p.type === 'wokwi-resistor' ? ohms(p.attrs?.value ?? '220') : p.type === 'wokwi-led' ? (p.attrs?.color ?? 'led') : (VALUE[p.type] ?? p.type.replace('wokwi-', '')))
// mono text at the sheet's sizes, wide enough to keep things apart
export const textW = (s: string, size = 6.2) => s.length * size * 0.6
const boardName = (pin: string) => (/^\d+$/.test(pin) ? `D${pin}` : pin.replace(/\.\d+$/, ''))
const boardRank = (pin: string) => {
  const m = pin.match(/^(?:GP)?(\d+)$/)
  if (m) return Number(m[1])
  const a = pin.match(/^A(\d+)/)
  return a ? 100 + Number(a[1]) : 200
}

const STEP = { label: 30, power: 10, ground: 8, elbow: 8, lead: 5, res: 18 }

type Tail =
  | { kind: 'power'; net: string; name: string }
  | { kind: 'ground'; net: string }
  | { kind: 'label'; net: string; name: string }
  | { kind: 'res'; part: DiagramPart; net: string; next: Tail }

class Draw {
  symbols: Sym[] = []
  pins: SPin[] = []
  wires: SWire[] = []
  labels: SLabel[] = []
  powers: SPower[] = []
  grounds: SGround[] = []
  box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }
  grow(x0: number, y0: number, x1: number, y1: number) {
    const b = this.box
    b.x0 = Math.min(b.x0, x0, x1)
    b.y0 = Math.min(b.y0, y0, y1)
    b.x1 = Math.max(b.x1, x0, x1)
    b.y1 = Math.max(b.y1, y0, y1)
  }
  wire(net: string, ...pts: Pt[]) {
    this.wires.push({ net, pts })
    for (const [x, y] of pts) this.grow(x, y, x, y)
  }
  sym(s: Sym) {
    this.symbols.push(s)
    this.grow(s.x, s.y, s.x + s.w, s.y + s.h)
    // the ref and value, above and below, or beside a standing two legged part
    if (s.vertical) this.grow(s.x + s.w + 4, s.y, s.x + s.w + 10 + Math.max(textW(s.ref), textW(s.value)), s.y + s.h)
    else this.grow(s.x, s.y - 11, s.x + Math.max(textW(s.ref), textW(s.value)), s.y + s.h + 11)
  }
  label(l: SLabel) {
    this.labels.push(l)
    const w = textW(l.name, 6.5)
    this.grow(l.at[0], l.at[1] - 9, l.at[0] + (l.side === 'r' ? w : -w), l.at[1])
  }
  power(p: SPower) {
    this.powers.push(p)
    this.grow(p.at[0] - Math.max(7, textW(p.name, 6.5) / 2), p.at[1] - 12, p.at[0] + Math.max(7, textW(p.name, 6.5) / 2), p.at[1])
  }
  ground(g: SGround) {
    this.grounds.push(g)
    this.grow(g.at[0] - 7, g.at[1], g.at[0] + 7, g.at[1] + 6)
  }
  shift(dx: number, dy: number, into: Draw) {
    const m = ([x, y]: Pt): Pt => [x + dx, y + dy]
    for (const s of this.symbols) into.symbols.push({ ...s, x: s.x + dx, y: s.y + dy })
    for (const p of this.pins) into.pins.push({ ...p, from: m(p.from), to: m(p.to) })
    for (const w of this.wires) into.wires.push({ ...w, pts: w.pts.map(m) })
    for (const l of this.labels) into.labels.push({ ...l, at: m(l.at) })
    for (const p of this.powers) into.powers.push({ ...p, at: m(p.at) })
    for (const g of this.grounds) into.grounds.push({ ...g, at: m(g.at) })
    into.grow(this.box.x0 + dx, this.box.y0 + dy, this.box.x1 + dx, this.box.y1 + dy)
  }
}

const VEC: Record<Dir, Pt> = { l: [-1, 0], r: [1, 0], u: [0, -1], d: [0, 1] }
const go = ([x, y]: Pt, d: Dir, n: number): Pt => [x + VEC[d][0] * n, y + VEC[d][1] * n]

export function schematic(d: Diagram): Sheet | null {
  const board = d.parts.find((p) => BOARDS.includes(p.type))
  if (!board) return null

  // nets, with each part's own joined pins as one
  const up = new Map<string, string>()
  const find = (a: string): string => {
    const p = up.get(a)
    if (!p || p === a) return a
    const r = find(p)
    up.set(a, r)
    return r
  }
  const join = (a: string, b: string) => {
    const [x, y] = [find(a), find(b)]
    if (x !== y) up.set(x, y)
  }
  const sameOf = (p: DiagramPart) => (PARTS[p.type as keyof typeof PARTS] as { same?: string[][] } | undefined)?.same ?? []
  for (const p of d.parts) for (const g of sameOf(p)) for (const pin of g.slice(1)) join(`${p.id}:${g[0]}`, `${p.id}:${pin}`)
  for (const [a, b] of d.connections) join(a, b)
  // the pins wired on each net, one per piece of metal
  const canon = (ref: string) => {
    const [id, pin] = ref.split(':')
    const p = d.parts.find((q) => q.id === id)
    const g = p && sameOf(p).find((g) => g.includes(pin))
    return g && p.type !== board.type ? `${id}:${g[0]}` : ref
  }
  const members = new Map<string, Set<string>>()
  for (const [a, b] of d.connections) for (const r of [a, b]) {
    const n = find(r)
    members.set(n, (members.get(n) ?? new Set()).add(canon(r)))
  }
  const on = (n: string) => [...(members.get(n) ?? [])]
  const partOf = (ref: string) => d.parts.find((p) => p.id === ref.split(':')[0])
  const pinOf = (ref: string) => ref.split(':')[1]
  const isBoard = (ref: string) => ref.split(':')[0] === board.id

  const boardPins = (n: string) => on(n).filter(isBoard).map(pinOf)
  const gnd = new Set(d.parts.length ? [...members.keys()].filter((n) => boardPins(n).some((p) => GROUND.test(p))) : [])
  const powerName = (n: string) => boardPins(n).find((p) => POWER.includes(p))?.replace(/\.\d+$/, '').replace('3.3V', '3V3')
  const kindOf = (n: string): NetKind => (gnd.has(n) ? 'ground' : powerName(n) ? 'power' : boardPins(n).length ? 'signal' : 'local')

  // a resistor that only links one pin to the next thing is drawn in line, on that pin's wire
  const resistors = d.parts.filter((p) => p.type === 'wokwi-resistor')
  const inline = new Set<string>()
  const other = (r: DiagramPart, pin: string) => `${r.id}:${pin === '1' ? '2' : '1'}`
  // which side of each resistor faces the part it belongs to
  const hostOf = new Map<string, string>()
  for (const r of resistors) {
    for (const pin of ['1', '2']) {
      const near = on(find(`${r.id}:${pin}`)).filter((x) => x !== `${r.id}:${pin}`)
      const far = find(other(r, pin))
      // its near side touches exactly one pin of a part that is not a resistor, and its far side is a named net or another resistor
      if (near.length === 1 && !isBoard(near[0]) && partOf(near[0])?.type !== 'wokwi-resistor' && (kindOf(far) !== 'local' || on(far).length === 2)) {
        inline.add(r.id)
        hostOf.set(r.id, near[0])
        break
      }
    }
  }

  // names: power and ground by their pin, signals by the part they reach, the rest numbered
  const served = (n: string, seen = new Set<string>()): DiagramPart[] => {
    const out: DiagramPart[] = []
    for (const ref of on(n)) {
      if (isBoard(ref)) continue
      const p = partOf(ref)!
      if (p.type === 'wokwi-resistor') {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        out.push(...served(find(other(p, pinOf(ref))), seen))
      } else if (!out.includes(p)) out.push(p)
    }
    return out
  }
  const names = new Map<string, string>()
  const signalNets = [...members.keys()].filter((n) => kindOf(n) === 'signal').sort((a, b) => Math.min(...boardPins(a).map(boardRank)) - Math.min(...boardPins(b).map(boardRank)))
  const signalsOf = (p: DiagramPart) => signalNets.filter((n) => served(n).includes(p))
  const taken = new Set<string>()
  const claim = (name: string) => {
    let s = name
    for (let i = 2; taken.has(s); i++) s = `${name}_${i}`
    taken.add(s)
    return s
  }
  for (const n of signalNets) {
    const ps = served(n)
    const ends = on(n).filter((r) => !isBoard(r))
    const i2c = ends.map((r) => [partOf(r)?.type, pinOf(r)]).find(([t]) => t === 'wokwi-ssd1306' || t === 'wokwi-lcd1602')
    let name: string
    if (i2c) name = i2c[1] === 'DATA' || i2c[1] === 'SDA' ? 'SDA' : 'SCL'
    else if (!ps.length) name = boardName(boardPins(n)[0])
    else if (ps.length === 1 && signalsOf(ps[0]).length === 1) name = ps[0].id.toUpperCase()
    else {
      const pin = ends.find((r) => partOf(r) === ps[0])
      const pn = pin ? pinOf(pin).replace(/\.\w+$/, '').toUpperCase() : ''
      name = pn.length >= 3 && ps.length === 1 ? pn : `${ps.map((p) => p.id.toUpperCase()).join('_')}${pn ? `_${pn}` : ''}`
    }
    names.set(n, claim(name))
  }
  let local = 0
  const nameOf = (n: string) => {
    const k = kindOf(n)
    if (k === 'ground') return 'GND'
    if (k === 'power') return powerName(n)!
    if (!names.has(n)) names.set(n, claim(`N${++local}`))
    return names.get(n)!
  }

  // what a pin's wire ends in, following resistors drawn in line
  const tail = (ref: string): Tail => {
    const n = find(ref)
    const k = kindOf(n)
    if (k === 'ground') return { kind: 'ground', net: n }
    if (k === 'power') return { kind: 'power', net: n, name: nameOf(n) }
    const rest = on(n).filter((x) => x !== ref)
    const r = rest.length === 1 && partOf(rest[0])
    if (r && r.type === 'wokwi-resistor' && inline.has(r.id) && k === 'local') return { kind: 'res', part: r, net: n, next: tail(other(r, pinOf(rest[0]))) }
    return { kind: 'label', net: n, name: nameOf(n) }
  }

  // refs in the order the parts come
  const count = new Map<string, number>()
  const refs = new Map<string, string>()
  for (const p of [board, ...d.parts.filter((p) => p !== board)]) {
    const pre = p === board ? 'U' : (PREFIX[p.type] ?? 'U')
    count.set(pre, (count.get(pre) ?? 0) + 1)
    refs.set(p.id, `${pre}${count.get(pre)}`)
  }

  // a wire's end: walk out from a pin in one direction and finish it the way its net says
  const run = (g: Draw, start: Pt, dir: Dir, t: Tail, len = STEP.label, elbow = STEP.elbow) => {
    if (t.kind === 'res') {
      const a = go(start, dir, 4)
      g.wire(t.net, start, a)
      const vertical = dir === 'u' || dir === 'd'
      const b = go(a, dir, STEP.res)
      const [x0, y0] = [Math.min(a[0], b[0]), Math.min(a[1], b[1])]
      g.sym({ id: t.part.id, type: t.part.type, kind: 'resistor', ref: refs.get(t.part.id)!, value: valueOf(t.part), x: vertical ? x0 - 3.5 : x0, y: vertical ? y0 : y0 - 3.5, w: vertical ? 7 : STEP.res, h: vertical ? STEP.res : 7, vertical })
      return run(g, b, dir, t.next, len, elbow)
    }
    if (t.kind === 'power' && dir !== 'd') {
      const bend = dir === 'u' ? start : go(start, dir, elbow)
      const top = go(bend, 'u', STEP.power)
      g.wire(t.net, ...(dir === 'u' ? [start, top] : [start, bend, top]))
      g.power({ net: t.net, name: t.name, at: top })
      return
    }
    if (t.kind === 'ground' && dir !== 'u') {
      const bend = dir === 'd' ? start : go(start, dir, STEP.elbow)
      const foot = go(bend, 'd', STEP.ground)
      g.wire(t.net, ...(dir === 'd' ? [start, foot] : [start, bend, foot]))
      g.ground({ net: t.net, at: foot })
      return
    }
    // a label, or power and ground that would point the wrong way, named instead
    const name = t.kind === 'label' || t.kind === 'power' ? t.name : 'GND'
    const w = Math.max(len, textW(name, 6.5) + 10)
    if (dir === 'l' || dir === 'r') {
      g.wire(t.net, start, go(start, dir, w))
      g.label({ net: t.net, name, at: go(start, dir, 4), side: dir })
    } else {
      const bend = go(start, dir, STEP.elbow)
      g.wire(t.net, start, bend, go(bend, 'l', w))
      g.label({ net: t.net, name, at: go(bend, 'l', 4), side: 'l' })
    }
  }

  // the board: signals down the right in pin order, power on the left at the top, ground at the bottom
  const main = new Draw()
  const used = [...members.keys()].filter((n) => boardPins(n).length)
  const right = used.filter((n) => kindOf(n) === 'signal').map((n) => ({ n, pin: boardPins(n).sort((a, b) => boardRank(a) - boardRank(b))[0] })).sort((a, b) => boardRank(a.pin) - boardRank(b.pin))
  const powers = used.filter((n) => kindOf(n) === 'power').map((n) => ({ n, pin: boardPins(n).find((p) => POWER.includes(p))! }))
  const grounds = used.filter((n) => kindOf(n) === 'ground').map((n) => ({ n, pin: boardPins(n).find((p) => GROUND.test(p))! }))
  const rows = Math.max(right.length, powers.length + grounds.length + (powers.length && grounds.length ? 1 : 0), 3)
  const bw = Math.max(64, Math.ceil((Math.max(0, ...right.map((r) => textW(boardName(r.pin)))) + Math.max(0, ...[...powers, ...grounds].map((r) => textW(boardName(r.pin)))) + 20) / 10) * 10)
  const bh = rows * 10 + 10
  main.sym({ id: board.id, type: board.type, kind: 'board', ref: refs.get(board.id)!, value: valueOf(board), x: 0, y: 0, w: bw, h: bh })
  const signalLen = Math.max(STEP.label, ...right.map((r) => textW(nameOf(r.n), 6.5) + 10))
  right.forEach(({ n, pin }, i) => {
    const y = 10 + i * 10
    main.pins.push({ part: board.id, pin, name: boardName(pin), num: '', side: 'r', from: [bw, y], to: [bw + 10, y], net: n })
    run(main, [bw + 10, y], 'r', tail(`${board.id}:${pin}`), signalLen)
  })
  const leftPins = [...powers.map((p, i) => ({ ...p, y: 10 + i * 10 })), ...grounds.map((p, i) => ({ ...p, y: bh - 10 - (grounds.length - 1 - i) * 10 }))]
  // each rail a step further out than the one above it, so their wires never cross
  leftPins.forEach(({ n, pin, y }, i) => {
    main.pins.push({ part: board.id, pin, name: boardName(pin), num: '', side: 'l', from: [0, y], to: [-10, y], net: n })
    run(main, [-10, y], 'l', tail(`${board.id}:${pin}`), STEP.label, STEP.elbow + (i < powers.length ? i * 20 : 0))
  })

  // every other part, its wires ending in labels, power and ground
  const clusters: { g: Draw; rank: number }[] = []
  for (const p of d.parts) {
    if (p === board || p.hide || inline.has(p.id)) continue
    const g = new Draw()
    const all = (PARTS[p.type as keyof typeof PARTS]?.pins ?? []) as string[]
    const wired = (pin: string) => members.get(find(`${p.id}:${pin}`))?.has(`${p.id}:${pin}`) ?? false
    const two = TWO[p.type]
    if (two) {
      // standing up, the end nearer power on top and ground at the bottom
      const score = (pin: string) => ({ power: 0, signal: 1, local: 1, ground: 2 })[kindOf(find(`${p.id}:${pin}`))]
      const [a, b] = score(two.pins[1]) < score(two.pins[0]) ? [two.pins[1], two.pins[0]] : two.pins
      const s: Sym = { id: p.id, type: p.type, kind: two.kind, ref: refs.get(p.id)!, value: valueOf(p), x: -two.w / 2, y: 0, w: two.w, h: two.h, vertical: true }
      g.sym(s)
      for (const [pin, side, y0, y1] of [[a, 'u', 0, -STEP.lead], [b, 'd', two.h, two.h + STEP.lead]] as const) {
        if (!wired(pin)) continue
        g.pins.push({ part: p.id, pin, name: '', num: pin === a ? '1' : '2', side, from: [0, y0], to: [0, y1], net: find(`${p.id}:${pin}`) })
        run(g, [0, y1], side, tail(`${p.id}:${pin}`))
      }
    } else {
      const order = ORDER[p.type] ?? all
      const pins = order.filter((pin) => all.includes(pin) && wired(pin))
      const num = (pin: string) => String(order.indexOf(pin) + 1)
      const top = pins.filter((pin) => kindOf(find(`${p.id}:${pin}`)) === 'power')
      const bottom = pins.filter((pin) => kindOf(find(`${p.id}:${pin}`)) === 'ground')
      const left = pins.filter((pin) => !top.includes(pin) && !bottom.includes(pin))
      const pitch = left.some((pin) => tail(`${p.id}:${pin}`).kind === 'res') ? 20 : 10
      const across = Math.max(top.length, bottom.length)
      const nameW = Math.max(0, ...left.map((pin) => textW(pin)))
      const tall = (xs: string[]) => (xs.length ? Math.max(...xs.map((pin) => textW(pin, 6))) + 6 : 0)
      const value = valueOf(p)
      const w = Math.ceil(Math.max(44, nameW + 10 + across * 12 + 4, bottom.length ? textW(value) + 16 : 0) / 2) * 2
      const h = Math.ceil(Math.max(30, left.length * pitch + 10 - (pitch - 10), tall(top) + tall(bottom) + 6) / 2) * 2
      g.sym({ id: p.id, type: p.type, kind: 'box', ref: refs.get(p.id)!, value, x: 0, y: 0, w, h })
      left.forEach((pin, i) => {
        const y = 10 + i * pitch
        g.pins.push({ part: p.id, pin, name: pin, num: num(pin), side: 'l', from: [0, y], to: [-10, y], net: find(`${p.id}:${pin}`) })
        run(g, [-10, y], 'l', tail(`${p.id}:${pin}`))
      })
      top.forEach((pin, i) => {
        const x = w - 10 - i * 12
        g.pins.push({ part: p.id, pin, name: pin, num: num(pin), side: 'u', from: [x, 0], to: [x, -10], net: find(`${p.id}:${pin}`) })
        run(g, [x, -10], 'u', tail(`${p.id}:${pin}`))
      })
      bottom.forEach((pin, i) => {
        const x = w - 10 - i * 12
        g.pins.push({ part: p.id, pin, name: pin, num: num(pin), side: 'd', from: [x, h], to: [x, h + 10], net: find(`${p.id}:${pin}`) })
        run(g, [x, h + 10], 'd', tail(`${p.id}:${pin}`))
      })
    }
    if (!g.symbols.length) continue
    const rank = Math.min(200, ...signalNets.filter((n) => on(n).some((r) => partOf(r) === p) || g.labels.some((l) => l.net === n)).map((n) => Math.min(...boardPins(n).map(boardRank))))
    clusters.push({ g, rank })
  }
  clusters.sort((a, b) => a.rank - b.rank)

  // stack them in columns beside the board, as many as make the sheet about the shape of the stage
  const out = new Draw()
  const pad = 30
  main.shift(pad - main.box.x0, pad - main.box.y0, out)
  const size = (g: Draw) => [g.box.x1 - g.box.x0, g.box.y1 - g.box.y0]
  const pack = (limit: number) => {
    const at: Pt[] = []
    let [x, y, colW, w, h] = [out.box.x1 + 60, 0, 0, 0, out.box.y1 - pad]
    for (const { g } of clusters) {
      const [cw, ch] = size(g)
      if (y && y + ch > limit) {
        x += colW + 50
        y = 0
        colW = 0
      }
      at.push([x, y])
      y += ch + 30
      colW = Math.max(colW, cw)
      w = x + colW
      h = Math.max(h, y - 30)
    }
    return { at, ratio: (w + pad) / (h + pad * 2) }
  }
  const tallest = Math.max(out.box.y1 - pad, ...clusters.map(({ g }) => size(g)[1]))
  const total = clusters.reduce((t, { g }) => t + size(g)[1] + 30, 0)
  let best = pack(tallest)
  for (let limit = tallest; limit <= total; limit += 10) {
    const p = pack(limit)
    if (Math.abs(Math.log(p.ratio / 1.5)) < Math.abs(Math.log(best.ratio / 1.5))) best = p
  }
  clusters.forEach(({ g }, i) => g.shift(best.at[i][0] - g.box.x0, pad + best.at[i][1] - g.box.y0, out))

  const nets: SNet[] = [...members.keys()]
    .filter((n) => !(kindOf(n) === 'local' && !out.labels.some((l) => l.net === n) && on(n).length <= 2 && !out.wires.some((w) => w.net === n)))
    .map((n) => ({ id: n, name: nameOf(n), kind: kindOf(n), pins: on(n).map((r) => ({ part: r.split(':')[0], pin: pinOf(r) })) }))
    .sort((a, b) => ['power', 'ground', 'signal', 'local'].indexOf(a.kind) - ['power', 'ground', 'signal', 'local'].indexOf(b.kind) || (a.kind === 'signal' ? Math.min(...a.pins.filter((p) => p.part === board.id).map((p) => boardRank(p.pin))) - Math.min(...b.pins.filter((p) => p.part === board.id).map((p) => boardRank(p.pin))) : 0))
  return { w: Math.ceil(out.box.x1 + pad), h: Math.ceil(out.box.y1 + pad), symbols: out.symbols, pins: out.pins, wires: out.wires, labels: out.labels, powers: out.powers, grounds: out.grounds, nets }
}
