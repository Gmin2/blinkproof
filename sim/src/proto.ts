import { PARTS } from './catalog'
import type { Diagram, DiagramPart } from './circuit'

// building the circuit for real on a breadboard: where every leg goes, which jumpers to cut, and in what order.
// the board sits beside the breadboard. wires are worked out from the nets every time, never stored, so
// they always agree with the circuit

// rows a to e are the top half, f to j the bottom, the gap runs between e and f. each column of five in a
// half is one strip of metal. the rails run the length of the board along the top and the bottom
export type Half = 'top' | 'bottom'
export type Rail = 'top+' | 'top-' | 'bottom+' | 'bottom-'
export type Hole = { col: number; row: string } | { col: number; rail: Rail }
export type End = { hole: Hole } | { board: string } | { part: string; pin: string }

export type Placed = {
  id: string
  type: string
  label: string
  legs: { pin: string; hole: Hole }[]
  // resistors only: its value and the colour bands to look for
  value?: string
  bands?: string[]
}
export type Jumper = { id: string; from: End; to: End; color: string; why: string }
export type Step = { n: number; title: string; do: string[]; adds: string[] }
export type Proto = {
  cols: number
  board: { id: string; type: string; name: string }
  placed: Placed[]
  // parts that do not go in a breadboard: a screen, a servo on its cable, a ring of leds
  beside: Placed[]
  jumpers: Jumper[]
  steps: Step[]
  power: string
}

type Leg = [pin: string, dc: number, half: Half]
// how each part sits: its legs in the order they come out of it, as a column offset and a half
const FOOT: Record<string, Leg[]> = {
  'wokwi-led': [['A', 0, 'top'], ['C', 1, 'top']],
  'wokwi-buzzer': [['2', 0, 'top'], ['1', 2, 'top']],
  'wokwi-potentiometer': [['GND', 0, 'top'], ['SIG', 1, 'top'], ['VCC', 2, 'top']],
  // across the gap: the legs facing each other over it are the same contact
  'wokwi-pushbutton': [['1.l', 0, 'top'], ['2.l', 2, 'top'], ['1.r', 0, 'bottom'], ['2.r', 2, 'bottom']],
  'wokwi-hc-sr04': [['VCC', 0, 'top'], ['TRIG', 1, 'top'], ['ECHO', 2, 'top'], ['GND', 3, 'top']],
  'wokwi-dht22': [['VCC', 0, 'top'], ['SDA', 1, 'top'], ['NC', 2, 'top'], ['GND', 3, 'top']],
  'wokwi-pir-motion-sensor': [['VCC', 0, 'top'], ['OUT', 1, 'top'], ['GND', 2, 'top']],
  'wokwi-photoresistor-sensor': [['VCC', 0, 'top'], ['GND', 1, 'top'], ['DO', 2, 'top'], ['AO', 3, 'top']],
  // the i2c module's four pins, as printed on it: GND VCC SCL SDA
  'wokwi-ssd1306': [['GND', 0, 'top'], ['VIN', 1, 'top'], ['CLK', 2, 'top'], ['DATA', 3, 'top']],
  'wokwi-slide-switch': [['1', 0, 'top'], ['2', 1, 'top'], ['3', 2, 'top']],
  'wokwi-rgb-led': [['R', 0, 'top'], ['COM', 1, 'top'], ['G', 2, 'top'], ['B', 3, 'top']],
  'wokwi-7segment': [['G', 0, 'top'], ['F', 1, 'top'], ['COM.1', 2, 'top'], ['A', 3, 'top'], ['B', 4, 'top'], ['E', 0, 'bottom'], ['D', 1, 'bottom'], ['COM.2', 2, 'bottom'], ['C', 3, 'bottom'], ['DP', 4, 'bottom']],
}
const BESIDE: Record<string, string[]> = {
  'wokwi-lcd1602': ['GND', 'VCC', 'SDA', 'SCL'],
  'wokwi-servo': ['GND', 'V+', 'PWM'],
  'wokwi-led-ring': ['GND', 'VCC', 'DIN'],
  'wokwi-neopixel': ['VSS', 'VDD', 'DIN'],
}
const STRADDLES = ['wokwi-pushbutton', 'wokwi-7segment']
const BOARDS = ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-pi-pico']
const NAME: Record<string, string> = { 'wokwi-arduino-uno': 'Uno', 'wokwi-arduino-nano': 'Nano', 'wokwi-pi-pico': 'Pico' }

const BLACK = '#1f2937'
const RED = '#dc2626'
const SIGNALS = ['#16a34a', '#f59e0b', '#0ea5e9', '#8b5cf6', '#eab308', '#ec4899', '#14b8a6', '#f97316']

// resistor colour code: two digits, then how many zeros, then gold for 5%
const BAND = ['black', 'brown', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'grey', 'white']
export function bands(ohms: number) {
  if (!(ohms > 0)) return []
  let zeros = 0
  let n = Math.round(ohms)
  while (n >= 100) {
    n = Math.round(n / 10)
    zeros++
  }
  if (n < 10) return [BAND[0], BAND[n], BAND[zeros], 'gold']
  return [BAND[Math.floor(n / 10)], BAND[n % 10], BAND[zeros], 'gold']
}

export const holeName = (h: Hole) => ('rail' in h ? `the ${h.rail.startsWith('top') ? 'top' : 'bottom'} ${h.rail.endsWith('+') ? '+' : '-'} rail` : `${h.row}${h.col}`)
const say = (pin: string) => (/^\d+$/.test(pin.replace(/\.\d$/, '')) ? `pin ${pin.replace(/\.\d$/, '')}` : pin.replace(/\.\d$/, ''))

export function proto(d: Diagram): Proto | null {
  const board = d.parts.find((p) => BOARDS.includes(p.type))
  if (!board) return null
  const pico = board.type === 'wokwi-pi-pico'

  // nets: the wires, plus the pins each part has as one piece of metal
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
  for (const p of d.parts) for (const group of (PARTS[p.type as keyof typeof PARTS] as { same?: string[][] } | undefined)?.same ?? []) for (const pin of group.slice(1)) join(`${p.id}:${group[0]}`, `${p.id}:${pin}`)
  for (const [a, b] of d.connections) join(a, b)
  const net = (ref: string) => find(ref)
  const touched = (ref: string) => d.connections.some(([a, b]) => a === ref || b === ref) || [...up.keys()].some((k) => k !== ref && find(k) === find(ref) && d.connections.some(([a, b]) => a === k || b === k))

  const gnd = net(`${board.id}:${pico ? 'GND.1' : 'GND.1'}`)
  const powerPin = pico ? '3V3' : '5V'
  const plus = net(`${board.id}:${powerPin}`)
  const wireColor = (ref: string) => d.connections.find(([a, b]) => a === ref || b === ref)?.[2]

  // strips: which net each one carries, and which of its five holes are taken
  const owner = new Map<string, string>()
  const used = new Map<string, Set<string>>()
  const key = (half: Half, col: number) => `${half}:${col}`
  const stripOf = (h: Hole) => ('rail' in h ? undefined : key(h.row <= 'e' ? 'top' : 'bottom', h.col))
  const ROWS: Record<Half, string[]> = { top: ['a', 'b', 'c', 'd', 'e'], bottom: ['f', 'g', 'h', 'i', 'j'] }
  const take = (half: Half, col: number, prefer: string[]) => {
    const set = used.get(key(half, col)) ?? new Set<string>()
    used.set(key(half, col), set)
    const row = prefer.find((r) => !set.has(r)) ?? ROWS[half].find((r) => !set.has(r))
    if (!row) return undefined
    set.add(row)
    return { col, row }
  }
  // strips joined by a part's own metal, like the two sides of a button: one island, one connection
  const islands = new Map<string, Set<string>>()
  const island = (k: string) => islands.get(k) ?? new Set([k])

  const placed: Placed[] = []
  const beside: Placed[] = []
  let col = 2
  const parts = d.parts.filter((p) => p !== board && !p.hide && p.type !== 'wokwi-resistor')
  const legsOf = (p: DiagramPart) => (FOOT[p.type] ?? []).filter(([pin]) => p.type === 'wokwi-7segment' || p.type === 'wokwi-pushbutton' || touched(`${p.id}:${pin}`) || (FOOT[p.type]?.length ?? 0) <= 4)
  for (const p of parts) {
    if (BESIDE[p.type] || !FOOT[p.type]) {
      beside.push({ id: p.id, type: p.type, label: p.id, legs: [] })
      continue
    }
    const legs = legsOf(p)
    const width = Math.max(...legs.map(([, dc]) => dc)) + 1
    const out: Placed = { id: p.id, type: p.type, label: p.id, legs: [] }
    const straddle = STRADDLES.includes(p.type)
    for (const [pin, dc, half] of legs) {
      const row = straddle ? (half === 'top' ? 'e' : 'f') : 'c'
      const hole = take(half, col + dc, [row])!
      owner.set(key(half, col + dc), net(`${p.id}:${pin}`))
      out.legs.push({ pin, hole })
    }
    // a part's legs that are one contact join their strips into one island
    const byNet = new Map<string, string[]>()
    for (const [pin, dc, half] of legs) {
      const n = net(`${p.id}:${pin}`)
      byNet.set(n, [...(byNet.get(n) ?? []), key(half, col + dc)])
    }
    for (const ks of byNet.values()) if (ks.length > 1 && STRADDLES.includes(p.type)) for (const k of ks) islands.set(k, new Set(ks))
    placed.push(out)
    col += width + 1
  }

  // resistors: into a strip of the net they belong to, across the gap to a fresh strip, or into a rail
  const stripsOf = (n: string) => [...owner.entries()].filter(([, v]) => v === n).map(([k]) => k)
  const railFor = (n: string, half: Half): Rail | undefined => (n === gnd ? `${half}-` : n === plus ? `${half}+` : undefined)
  const freeBottom = (near: number) => {
    for (let dx = 0; dx < 60; dx++) for (const c of [near + dx, near - dx]) if (c >= 2 && !owner.has(key('bottom', c)) && !(used.get(key('bottom', c))?.size)) return c
    return near
  }
  const resistors = d.parts.filter((p) => p.type === 'wokwi-resistor')
  // the part each resistor is there for, so its wires go in that part's step
  const serves = new Map<string, string>()
  let pending = [...resistors]
  for (let round = 0; round < 4 && pending.length; round++) {
    const later: DiagramPart[] = []
    for (const r of pending) {
      const [a, b] = [net(`${r.id}:1`), net(`${r.id}:2`)]
      const sa = stripsOf(a)
      const sb = stripsOf(b)
      const value = r.attrs?.value ?? '220'
      const out: Placed = { id: r.id, type: r.type, label: `${r.id}, ${Number(value) >= 1000 ? `${Number(value) / 1000}k` : value} Ω`, legs: [], value, bands: bands(Number(value)) }
      const into = (k: string, prefer: string[]) => {
        const [half, c] = k.split(':') as [Half, string]
        return take(half, Number(c), prefer)!
      }
      const from = sa[0] ?? sb[0]
      if (!from && round < 3) {
        later.push(r)
        continue
      }
      const [here, there, hereNet, thereNet] = sa[0] ? [sa[0], sb[0], a, b] : [sb[0], sa[0], b, a]
      const [half, c] = (here ?? key('top', col)).split(':') as [Half, string]
      const hole1 = here ? into(here, half === 'top' ? ['e', 'd'] : ['f', 'g']) : take('top', col, ['e'])!
      if (!here) {
        owner.set(key('top', col), hereNet)
        col += 2
      }
      const rail = railFor(thereNet, half)
      let hole2: Hole
      if (rail) hole2 = { col: Number(c), rail }
      else if (there) hole2 = into(there, there.startsWith('top') ? ['e', 'd'] : ['f', 'g'])
      else if (half === 'top') {
        const bc = freeBottom(Number(c))
        owner.set(key('bottom', bc), thereNet)
        hole2 = take('bottom', bc, ['f'])!
      } else {
        const tc = col
        col += 2
        owner.set(key('top', tc), thereNet)
        hole2 = take('top', tc, ['e'])!
      }
      out.legs.push({ pin: hereNet === a ? '1' : '2', hole: hole1 }, { pin: hereNet === a ? '2' : '1', hole: hole2 })
      const host = here ? placed.find((q) => q.type !== 'wokwi-resistor' && q.legs.some((l) => stripOf(l.hole) === here)) : undefined
      const via = here && !host ? placed.find((q) => q.type === 'wokwi-resistor' && q.legs.some((l) => stripOf(l.hole) === here)) : undefined
      const served = host?.id ?? (via && serves.get(via.id))
      if (served) serves.set(r.id, served)
      placed.push(out)
    }
    pending = later
  }

  // jumpers: every net joined up. its islands to the rail, or to each other, the board pin to one of them,
  // and parts beside the breadboard straight to wherever their net is
  const jumpers: Jumper[] = []
  const add = (from: End, to: End, color: string, why: string) => {
    const j = { id: `w${jumpers.length + 1}`, from, to, color, why }
    jumpers.push(j)
    return j.id
  }
  const rails = [
    add({ board: `${board.id}:${powerPin}` }, { hole: { col: 1, rail: 'top+' } }, RED, `${powerPin} to the top + rail`),
    add({ board: `${board.id}:GND.1` }, { hole: { col: 1, rail: 'top-' } }, BLACK, 'GND to the top - rail'),
    add({ hole: { col: 1, rail: 'top+' } }, { hole: { col: 1, rail: 'bottom+' } }, RED, 'the top + rail to the bottom + rail'),
    add({ hole: { col: 1, rail: 'top-' } }, { hole: { col: 1, rail: 'bottom-' } }, BLACK, 'the top - rail to the bottom - rail'),
  ]
  // which jumpers belong to which step: the part whose strip the jumper lands on
  const stepOf = new Map<string, string>()
  const stripPart = (k: string) => {
    const on = placed.filter((p) => p.legs.some((l) => stripOf(l.hole) === k))
    const part = on.find((p) => p.type !== 'wokwi-resistor') ?? on[0]
    return part && (serves.get(part.id) ?? part.id)
  }
  const outer = (half: Half) => (half === 'top' ? ['a', 'b', 'd'] : ['j', 'i', 'g'])
  const nets = new Set([...owner.values()])
  let colorAt = 0
  const signalColor = (n: string, ref?: string) => (n === gnd ? BLACK : n === plus ? RED : (ref && wireColor(ref)) || SIGNALS[colorAt++ % SIGNALS.length])
  const boardPins = (n: string) => {
    const pins = new Set<string>()
    for (const k of up.keys()) if (k.startsWith(`${board.id}:`) && find(k) === n) pins.add(k)
    for (const [a, b] of d.connections) for (const r of [a, b]) if (r.startsWith(`${board.id}:`) && find(r) === n) pins.add(r)
    return [...pins]
  }
  const besideIn = (n: string) =>
    beside.flatMap((p) => (BESIDE[p.type] ?? []).filter((pin) => find(`${p.id}:${pin}`) === n && touched(`${p.id}:${pin}`)).map((pin) => ({ part: p.id, pin })))

  for (const n of nets) {
    const done = new Set<string>()
    const groups: string[][] = []
    for (const k of stripsOf(n)) {
      if (done.has(k)) continue
      const g = [...island(k)].filter((x) => owner.get(x) === n)
      g.forEach((x) => done.add(x))
      groups.push(g)
    }
    const hole = (k: string): Hole => {
      const [half, c] = k.split(':') as [Half, string]
      return take(half, Number(c), outer(half)) ?? { col: Number(c), row: half === 'top' ? 'a' : 'j' }
    }
    const rail = n === gnd || n === plus
    if (rail) {
      for (const g of groups) {
        const k = g[0]
        const [half, c] = k.split(':') as [Half, string]
        const id = add({ hole: hole(k) }, { hole: { col: Number(c), rail: railFor(n, half)! } }, n === gnd ? BLACK : RED, n === gnd ? 'to ground' : 'to power')
        stepOf.set(id, stripPart(k) ?? '')
      }
      for (const b of besideIn(n)) {
        const id = add({ part: b.part, pin: b.pin }, { hole: { col: 1 + jumpers.length, rail: n === gnd ? 'bottom-' : 'bottom+' } }, n === gnd ? BLACK : RED, n === gnd ? 'to ground' : 'to power')
        stepOf.set(id, b.part)
      }
      continue
    }
    const pins = boardPins(n)
    const hub = groups[0]?.[0]
    const color = signalColor(n, pins[0])
    for (const pin of pins) {
      if (!hub) break
      const id = add({ board: pin }, { hole: hole(hub) }, color, `${say(pin.split(':')[1])} to the ${stripPart(hub) ?? 'strip'}`)
      stepOf.set(id, stripPart(hub) ?? '')
    }
    for (const g of groups.slice(1)) {
      const id = add({ hole: hole(g[0]) }, { hole: hole(hub!) }, color, 'joins the two strips')
      stepOf.set(id, stripPart(g[0]) ?? '')
    }
    for (const b of besideIn(n)) {
      const to: End = hub ? { hole: hole(hub) } : pins[0] ? { board: pins[0] } : { part: b.part, pin: b.pin }
      const id = add({ part: b.part, pin: b.pin }, to, signalColor(n, pins[0] ?? `${b.part}:${b.pin}`), `${b.pin} of ${b.part}`)
      stepOf.set(id, b.part)
    }
  }
  // parts beside the board whose net never touched the breadboard: straight to the board
  for (const p of beside) {
    for (const pin of BESIDE[p.type] ?? []) {
      const ref = `${p.id}:${pin}`
      if (!touched(ref)) continue
      const n = find(ref)
      if (n === gnd || n === plus || stripsOf(n).length) continue
      if (jumpers.some((j) => 'part' in j.from && j.from.part === p.id && j.from.pin === pin)) continue
      const pin2 = boardPins(n)[0]
      if (!pin2) continue
      const id = add({ part: p.id, pin }, { board: pin2 }, signalColor(n, ref), `${pin} of ${p.id}`)
      stepOf.set(id, p.id)
    }
  }

  // the steps: power first, then a part at a time with its resistor and its wires, then what sits beside
  const steps: Step[] = []
  const name = NAME[board.type] ?? board.id
  steps.push({
    n: 1,
    title: 'Power the rails',
    do: [`Set the ${name} beside the breadboard, unplugged.`, `Run a red wire from ${powerPin} to the top + rail and a black one from GND to the top - rail.`, 'Join the top rails to the bottom ones at the left end, red to red and black to black.'],
    adds: rails,
  })
  const describe = (e: End) => ('hole' in e ? holeName(e.hole) : 'board' in e ? `${name} ${say(e.board.split(':')[1])}` : `${e.part} ${e.pin}`)
  const wiresFor = (id: string) => jumpers.filter((j) => stepOf.get(j.id) === id)
  const resistorsAt = (p: Placed) => placed.filter((r) => r.type === 'wokwi-resistor' && serves.get(r.id) === p.id)
  const claimed = new Set<string>()
  for (const p of placed.filter((x) => x.type !== 'wokwi-resistor')) {
    const rs = resistorsAt(p).filter((r) => !claimed.has(r.id))
    rs.forEach((r) => claimed.add(r.id))
    const legs = p.legs.map((l) => `${l.pin} in ${holeName(l.hole)}`).join(', ')
    const lines = [STRADDLES.includes(p.type) ? `Press ${p.id} in across the gap: ${legs}.` : `Push ${p.id} in: ${legs}.`]
    for (const r of rs) lines.push(`A ${r.label.split(', ')[1]} resistor (${r.bands!.slice(0, 3).join(' ')}) from ${holeName(r.legs[0].hole)} to ${holeName(r.legs[1].hole)}.`)
    const ws = wiresFor(p.id)
    for (const w of ws) lines.push(`Wire ${describe(w.from)} to ${describe(w.to)}.`)
    steps.push({ n: steps.length + 1, title: `Add ${p.id}`, do: lines, adds: [p.id, ...rs.map((r) => r.id), ...ws.map((w) => w.id)] })
  }
  const loose = placed.filter((r) => r.type === 'wokwi-resistor' && !claimed.has(r.id))
  if (loose.length)
    steps.push({ n: steps.length + 1, title: 'The other resistors', do: loose.map((r) => `A ${r.label.split(', ')[1]} resistor (${r.bands!.slice(0, 3).join(' ')}) from ${holeName(r.legs[0].hole)} to ${holeName(r.legs[1].hole)}.`), adds: loose.map((r) => r.id) })
  for (const p of beside) {
    const ws = wiresFor(p.id)
    steps.push({ n: steps.length + 1, title: `Connect ${p.id}`, do: [`${p.id} stays beside the breadboard, it connects with jumper wires.`, ...ws.map((w) => `Wire ${describe(w.from)} to ${describe(w.to)}.`)], adds: [p.id, ...ws.map((w) => w.id)] })
  }
  // anything not claimed yet goes with the last step, so nothing is left out
  const inSteps = new Set(steps.flatMap((s) => s.adds))
  const rest = jumpers.filter((j) => !inSteps.has(j.id))
  if (rest.length) steps.push({ n: steps.length + 1, title: 'The last wires', do: rest.map((w) => `Wire ${describe(w.from)} to ${describe(w.to)}.`), adds: rest.map((w) => w.id) })
  steps.push({ n: steps.length + 1, title: 'Check, then plug in', do: ['Look over every wire against the picture, then plug the board in over usb.', 'Flash the firmware that passed its test.'], adds: [] })

  return { cols: col + 1 > 30 ? 60 : 30, board: { id: board.id, type: board.type, name }, placed, beside, jumpers, steps, power: powerPin }
}
