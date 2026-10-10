import { describe, expect, it } from 'vitest'
import { Bench, Circuit, type Diagram, type SSD1306 } from '../src'
import { diagram, hex } from './build'

const load = (d: unknown) => {
  const { circuit, errors } = Circuit.parse(d)
  if (!circuit) throw new Error(errors.join('\n'))
  return circuit
}

// a copy of a diagram with some connections swapped out
function rewire(d: Diagram, from: string, to: string) {
  return { ...d, connections: d.connections.map((c) => c.map((end) => (end === from ? to : end))) }
}

const screen = (b: Bench, id = 'oled1') => (b.parts[id] as { oled: SSD1306 | null }).oled

describe('circuit file', () => {
  it('runs hello-oled from its diagram', async () => {
    const b = new Bench(load(diagram('hello-oled')), await hex('hello-oled'))
    b.run(400)
    const text = screen(b)!.text()
    expect(text).toContain('blinkproof')
    // the pot starts at value 512 like the diagram says
    expect(text).toMatch(/A0 = 51\d/)
    b.control('pot1', 'position', 1)
    b.run(300)
    expect(screen(b)!.text()).toContain('A0 = 1023')
  })

  it('leaves the screen dark when DATA is moved off A4, like a real board', async () => {
    const b = new Bench(load(rewire(diagram('hello-oled'), 'uno:A4', 'uno:A3')), await hex('hello-oled'))
    b.run(400)
    expect(b.board.serial).toContain('oled ok')
    expect(screen(b)).toBeNull()
  })

  it('counts A4.2 as A4, the header next to AREF is the same copper', async () => {
    const b = new Bench(load(rewire(diagram('hello-oled'), 'uno:A4', 'uno:A4.2')), await hex('hello-oled'))
    b.run(400)
    expect(screen(b)!.text()).toContain('blinkproof')
  })

  it('reads 0 from a pot with no power on it', async () => {
    const d = diagram('hello-oled')
    d.connections = d.connections.filter((c: string[]) => c[0] !== 'pot1:VCC')
    const b = new Bench(load(d), await hex('hello-oled'))
    b.run(400)
    expect(screen(b)!.text()).toContain('A0 = 0')
  })

  it('blinks the led through its resistor', async () => {
    const b = new Bench(load(diagram('blink')), await hex('blink'))
    const seen = new Set<boolean>()
    for (let i = 0; i < 20; i++) {
      b.run(100)
      seen.add((b.parts.led1 as { lit: boolean }).lit)
    }
    expect([...seen].sort()).toEqual([false, true])
  })

  it('keeps a led put in backwards dark', async () => {
    const d = diagram('blink')
    d.connections = [['uno:13', 'r1:1', ''], ['r1:2', 'led1:C', ''], ['led1:A', 'uno:GND.1', '']]
    const b = new Bench(load(d), await hex('blink'))
    for (let i = 0; i < 20; i++) {
      b.run(100)
      expect((b.parts.led1 as { lit: boolean }).lit).toBe(false)
    }
  })
})

describe('checking a diagram', () => {
  const base = () => diagram('blink')

  it('names the pins a part has when a wire goes to one it does not', () => {
    const { errors } = Circuit.parse(rewire(base(), 'led1:A', 'led1:anode'))
    expect(errors).toEqual(['connection 1: wokwi-led has no pin anode. pins: A C'])
  })

  it('refuses unknown parts, twin ids and missing parts', () => {
    const d = base()
    d.parts.push({ id: 'led1', type: 'wokwi-led' }, { id: 'x', type: 'wokwi-laser' })
    d.connections.push(['ghost:1', 'uno:2', ''])
    const { errors } = Circuit.parse(d)
    expect(errors).toContain('two parts are called led1')
    expect(errors.some((e) => e.startsWith('x: unknown part type wokwi-laser'))).toBe(true)
    expect(errors).toContain('connection 3: no part called ghost')
  })

  it('wants one board and string attrs', () => {
    const d = base()
    d.parts = d.parts.filter((p: { id: string }) => p.id !== 'uno')
    d.parts[0].attrs = { value: 220 }
    const { errors } = Circuit.parse(d)
    expect(errors).toContain('a circuit needs exactly one board, found 0')
    expect(errors).toContain('r1: attr value must be a string, like "220"')
  })
})
