import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { connect, PARTS, schematic, type Diagram, type Sheet } from '../src'
import { textW } from '../src/schematic'

const dir = new URL('../../sketches/', import.meta.url)
const names = readdirSync(dir).filter((n) => existsSync(new URL(`${n}/diagram.json`, dir)))
const load = (name: string) => JSON.parse(readFileSync(new URL(`${name}/diagram.json`, dir), 'utf8')) as Diagram
const add = (d: Diagram, type: keyof typeof PARTS) => {
  const a = connect(d, type, { left: 500, top: 0 })
  if (a.error) throw new Error(a.error)
  return { ...d, parts: [...d.parts, ...a.parts], connections: [...d.connections, ...a.connections] }
}
const uno: Diagram = { version: 1, parts: [{ id: 'uno', type: 'wokwi-arduino-uno' }], connections: [] }
const pico: Diagram = { version: 1, parts: [{ id: 'pico', type: 'wokwi-pi-pico' }], connections: [] }
const kinds = (Object.keys(PARTS) as (keyof typeof PARTS)[]).filter((t) => !('board' in PARTS[t]) && t !== 'wokwi-resistor')

type Rect = { what: string; x0: number; y0: number; x1: number; y1: number }
// what takes room on the sheet: bodies, label text, power and ground marks
function rects(s: Sheet): Rect[] {
  const out: Rect[] = []
  for (const y of s.symbols) out.push({ what: `${y.ref} body`, x0: y.x, y0: y.y, x1: y.x + y.w, y1: y.y + y.h })
  for (const l of s.labels) {
    const w = textW(l.name, 6.5)
    out.push({ what: `label ${l.name}`, x0: l.side === 'r' ? l.at[0] : l.at[0] - w, y0: l.at[1] - 7, x1: l.side === 'r' ? l.at[0] + w : l.at[0], y1: l.at[1] - 1 })
  }
  for (const p of s.powers) out.push({ what: `power ${p.name}`, x0: p.at[0] - 6, y0: p.at[1] - 10, x1: p.at[0] + 6, y1: p.at[1] })
  for (const g of s.grounds) out.push({ what: 'ground', x0: g.at[0] - 6, y0: g.at[1], x1: g.at[0] + 6, y1: g.at[1] + 5 })
  return out
}
const hit = (a: Rect, b: Rect) => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1
function clashes(s: Sheet) {
  const r = rects(s)
  const out: string[] = []
  for (let i = 0; i < r.length; i++) for (let j = i + 1; j < r.length; j++) if (hit(r[i], r[j])) out.push(`${r[i].what} / ${r[j].what}`)
  return out
}
// every pin the circuit wires shows on the sheet, as a pin or as the end of a resistor drawn in line
function missing(d: Diagram, s: Sheet) {
  const shown = new Set(s.pins.map((p) => `${p.part}:${p.pin}`))
  const inline = new Set(s.symbols.filter((y) => y.kind === 'resistor' && !s.pins.some((p) => p.part === y.id)).map((y) => y.id))
  const same = (ref: string) => {
    const [id, pin] = ref.split(':')
    const t = d.parts.find((p) => p.id === id)?.type as keyof typeof PARTS
    const g = (PARTS[t] as { same?: string[][] }).same?.find((g) => g.includes(pin))
    return g && !('board' in PARTS[t]) ? `${id}:${g[0]}` : ref
  }
  const shownAlike = (ref: string) => shown.has(same(ref)) || s.pins.some((p) => p.part === ref.split(':')[0] && s.nets.find((n) => n.id === p.net)?.pins.some((q) => `${q.part}:${q.pin}` === same(ref)))
  return d.connections.flatMap(([a, b]) => [a, b]).filter((ref) => !inline.has(ref.split(':')[0]) && !shownAlike(ref))
}
// one name means one net, the way labels join things
function names1(s: Sheet) {
  const by = new Map<string, Set<string>>()
  for (const l of s.labels) by.set(l.name, (by.get(l.name) ?? new Set()).add(l.net))
  for (const p of s.powers) by.set(p.name, (by.get(p.name) ?? new Set()).add(p.net))
  return [...by].filter(([, v]) => v.size > 1).map(([k]) => k)
}

const cases: [string, Diagram][] = [
  ...names.map((n) => [n, load(n)] as [string, Diagram]),
  ...kinds.map((t) => [`uno + ${t}`, add(uno, t)] as [string, Diagram]),
  // as many parts as the pins go round
  ['uno + everything', kinds.reduce((d, t) => (connect(d, t, { left: 0, top: 0 }).error ? d : add(d, t)), uno)],
  ['pico + a few', ['wokwi-led', 'wokwi-pushbutton', 'wokwi-ssd1306', 'wokwi-neopixel', 'wokwi-potentiometer'].reduce((d, t) => add(d, t as keyof typeof PARTS), pico)],
  [
    'a button with a pull up',
    {
      version: 1,
      parts: [{ id: 'uno', type: 'wokwi-arduino-uno' }, { id: 'btn1', type: 'wokwi-pushbutton' }, { id: 'r1', type: 'wokwi-resistor', attrs: { value: '10000' } }],
      connections: [['btn1:1.l', 'uno:2', 'green'], ['btn1:2.l', 'uno:GND.1', 'black'], ['r1:1', 'uno:5V', 'red'], ['r1:2', 'uno:2', 'green']],
    },
  ],
]

describe('schematic', () => {
  it.each(cases)('%s draws every pin, nothing on top of anything', (_, d) => {
    const s = schematic(d)!
    expect(s).not.toBeNull()
    expect(missing(d, s)).toEqual([])
    expect(clashes(s)).toEqual([])
    expect(names1(s)).toEqual([])
  })

  it('names blink the way it reads: the led on D13, through r1 to ground', () => {
    const s = schematic(load('blink'))!
    const led = s.nets.find((n) => n.name === 'LED1')!
    expect(led.kind).toBe('signal')
    expect(led.pins).toContainEqual({ part: 'uno', pin: '13' })
    // r1 is drawn in line on the led's wire, not as its own block
    expect(s.pins.some((p) => p.part === 'r1')).toBe(false)
    expect(s.symbols.find((y) => y.id === 'r1')).toMatchObject({ kind: 'resistor', ref: 'R1', value: '220', vertical: true })
    expect(s.grounds.length).toBe(2)
  })

  it('calls i2c lines SDA and SCL and the sonar pins by name', () => {
    const s = schematic(load('parking'))!
    expect(s.nets.map((n) => n.name)).toEqual(['5V', 'GND', 'RING1', 'BZ1', 'TRIG', 'ECHO', 'SDA', 'SCL'])
    expect(s.labels.filter((l) => l.name === 'SDA').length).toBe(2)
  })

  it('keeps a pull up resistor as its own block, 5V on top and the button net below', () => {
    const s = schematic(cases.at(-1)![1])!
    const r = s.pins.filter((p) => p.part === 'r1')
    expect(r.map((p) => p.side).sort()).toEqual(['d', 'u'])
    expect(s.powers.some((p) => p.name === '5V')).toBe(true)
    expect(s.labels.filter((l) => l.name === 'BTN1').length).toBe(3)
  })

  it('the overlap check does catch things on top of each other', () => {
    const s = schematic(load('parking'))!
    const moved = { ...s, labels: s.labels.map((l, i) => (i === 1 ? { ...l, at: s.labels[0].at } : l)) }
    expect(clashes(moved).length).toBeGreaterThan(0)
    const big = schematic(cases.find(([n]) => n === 'uno + everything')![1])!
    expect(big.symbols.length).toBeGreaterThan(12)
  })

  it('has no schematic without a board', () => {
    expect(schematic({ version: 1, parts: [{ id: 'led1', type: 'wokwi-led' }], connections: [] })).toBeNull()
  })
})
