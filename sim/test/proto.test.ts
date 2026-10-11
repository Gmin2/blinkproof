import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { bands, connect, proto, type Diagram, type Hole } from '../src'

const load = (name: string) => JSON.parse(readFileSync(new URL(`../../sketches/${name}/diagram.json`, import.meta.url), 'utf8')) as Diagram
const add = (d: Diagram, type: Parameters<typeof connect>[1]) => {
  const a = connect(d, type, { left: 500, top: 0 })
  if (a.error) throw new Error(a.error)
  return { ...d, parts: [...d.parts, ...a.parts], connections: [...d.connections, ...a.connections] }
}
const holes = (p: ReturnType<typeof proto>) => {
  const all: string[] = []
  for (const x of p!.placed) for (const l of x.legs) if (!('rail' in l.hole)) all.push(`${l.hole.row}${l.hole.col}`)
  for (const j of p!.jumpers) for (const e of [j.from, j.to]) if ('hole' in e && !('rail' in e.hole)) all.push(`${(e.hole as { row: string }).row}${e.hole.col}`)
  return all
}

describe('breadboard build', () => {
  it('reads resistor colour bands', () => {
    expect(bands(220)).toEqual(['red', 'red', 'brown', 'gold'])
    expect(bands(10000)).toEqual(['brown', 'black', 'orange', 'gold'])
    expect(bands(1000)).toEqual(['brown', 'black', 'red', 'gold'])
    expect(bands(4700)).toEqual(['yellow', 'violet', 'red', 'gold'])
  })

  it('lays out blink: an led, its resistor across the gap, the pin wired to the far side', () => {
    const p = proto(load('blink'))!
    const led = p.placed.find((x) => x.type === 'wokwi-led')!
    const r = p.placed.find((x) => x.type === 'wokwi-resistor')!
    expect(led.legs.map((l) => l.pin)).toEqual(['A', 'C'])
    // the resistor stands in the led's anode strip and crosses to the bottom half
    const anode = led.legs[0].hole as { col: number; row: string }
    expect(r.legs.some((l) => !('rail' in l.hole) && l.hole.col === anode.col && l.hole.row <= 'e')).toBe(true)
    expect(r.legs.some((l) => !('rail' in l.hole) && l.hole.row >= 'f')).toBe(true)
    expect(r.bands).toEqual(['red', 'red', 'brown', 'gold'])
    // the led's step carries its resistor and the pin's wire
    const step = p.steps.find((s) => s.title === `Add ${led.id}`)!
    expect(step.adds).toContain(r.id)
    expect(step.do.join(' ')).toMatch(/Uno pin \d+/)
    expect(p.steps[0].title).toBe('Power the rails')
  })

  it('never puts two things in one hole, on the parking sensor or a board full of parts', () => {
    let d = load('blink')
    for (const t of ['wokwi-pushbutton', 'wokwi-potentiometer', 'wokwi-photoresistor-sensor', 'wokwi-dht22', 'wokwi-rgb-led', 'wokwi-slide-switch', 'wokwi-lcd1602', 'wokwi-servo'] as const) d = add(d, t)
    for (const diagram of [load('parking'), d, load('pico-plant')]) {
      const h = holes(proto(diagram))
      expect(h.length).toBe(new Set(h).size)
    }
  })

  it('puts every wire of the circuit somewhere: each part pin that is wired reaches its net', () => {
    const p = proto(load('parking'))!
    // the lcd-like parts and the ring sit beside it and come in on jumpers
    expect(p.beside.map((b) => b.id)).toContain('ring1')
    expect(p.jumpers.some((j) => 'part' in j.from && j.from.part === 'ring1' && j.from.pin === 'DIN')).toBe(true)
    // sonar1's four legs, oled's four, the buzzer's two, all in holes
    for (const id of ['sonar1', 'oled1', 'bz1']) expect(p.placed.find((x) => x.id === id)!.legs.length).toBeGreaterThanOrEqual(2)
    // every step's adds exist
    const ids = new Set([...p.placed.map((x) => x.id), ...p.beside.map((x) => x.id), ...p.jumpers.map((j) => j.id)])
    for (const s of p.steps) for (const a of s.adds) expect(ids.has(a)).toBe(true)
    // and every jumper is in some step
    const inSteps = new Set(p.steps.flatMap((s) => s.adds))
    for (const j of p.jumpers) expect(inSteps.has(j.id)).toBe(true)
  })

  it('a button straddles the gap, its pin side and its ground side each wired once', () => {
    const p = proto(add(load('blink'), 'wokwi-pushbutton'))!
    const b = p.placed.find((x) => x.type === 'wokwi-pushbutton')!
    const rows = b.legs.map((l) => (l.hole as Hole & { row: string }).row)
    expect(rows.sort()).toEqual(['e', 'e', 'f', 'f'])
    const toGround = p.jumpers.filter((j) => 'hole' in j.to && 'rail' in j.to.hole && j.to.hole.rail.endsWith('-') && 'hole' in j.from && !('rail' in j.from.hole) && b.legs.some((l) => l.hole.col === (j.from as { hole: Hole }).hole.col))
    expect(toGround.length).toBe(1)
  })
})
