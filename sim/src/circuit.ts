import { PARTS, type PartType } from './catalog'

// the wokwi diagram.json shape, the subset we read
export type DiagramPart = {
  id: string
  type: PartType
  left?: number
  top?: number
  rotate?: number
  hide?: boolean
  attrs?: Record<string, string>
}

// [from, to, colour, routing hints]
export type Connection = [string, string, string, string[]?]

export type Diagram = {
  version: 1
  parts: DiagramPart[]
  connections: Connection[]
}

class Sets {
  private up = new Map<string, string>()
  find(a: string): string {
    const p = this.up.get(a)
    if (p === undefined || p === a) return a
    const root = this.find(p)
    this.up.set(a, root)
    return root
  }
  join(a: string, b: string) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.up.set(ra, rb)
  }
}

export class Circuit {
  diagram: Diagram
  parts = new Map<string, DiagramPart>()
  board: DiagramPart
  // copper: wires and pins that are the same metal
  private wires = new Sets()
  // copper plus resistors, for "does this led reach ground"
  private dc = new Sets()

  private constructor(diagram: Diagram) {
    this.diagram = diagram
    for (const p of diagram.parts) this.parts.set(p.id, p)
    this.board = diagram.parts.find((p) => 'board' in PARTS[p.type])!
    for (const p of diagram.parts) {
      for (const group of (PARTS[p.type] as { same?: string[][] }).same ?? []) {
        for (const pin of group.slice(1)) this.link(`${p.id}:${group[0]}`, `${p.id}:${pin}`)
      }
      if (p.type === 'wokwi-resistor') this.dc.join(`${p.id}:1`, `${p.id}:2`)
    }
    for (const [a, b] of diagram.connections) this.link(a, b)
  }

  private link(a: string, b: string) {
    this.wires.join(a, b)
    this.dc.join(a, b)
  }

  static parse(input: string | unknown): { circuit?: Circuit; errors: string[] } {
    const errors: string[] = []
    let d: any
    try {
      d = typeof input === 'string' ? JSON.parse(input) : input
    } catch (e) {
      return { errors: [`not json: ${(e as Error).message}`] }
    }
    if (d?.version !== 1) errors.push('version must be 1')
    if (!Array.isArray(d?.parts)) return { errors: [...errors, 'parts must be a list'] }
    if (!Array.isArray(d?.connections)) return { errors: [...errors, 'connections must be a list'] }

    const seen = new Map<string, PartType>()
    for (const p of d.parts) {
      if (typeof p?.id !== 'string' || !p.id) {
        errors.push('a part has no id')
        continue
      }
      if (seen.has(p.id)) errors.push(`two parts are called ${p.id}`)
      if (!(p.type in PARTS)) errors.push(`${p.id}: unknown part type ${p.type}. known: ${Object.keys(PARTS).join(', ')}`)
      else seen.set(p.id, p.type)
      for (const [k, v] of Object.entries(p.attrs ?? {})) {
        if (typeof v !== 'string') errors.push(`${p.id}: attr ${k} must be a string, like "${v}"`)
      }
    }
    const boards = [...seen.values()].filter((t) => 'board' in PARTS[t])
    if (boards.length !== 1) errors.push(`a circuit needs exactly one board, found ${boards.length}`)

    const ref = (r: unknown, where: string) => {
      if (typeof r !== 'string' || !r.includes(':')) return errors.push(`${where}: ${JSON.stringify(r)} is not partId:pin`)
      const i = r.indexOf(':')
      const id = r.slice(0, i)
      const pin = r.slice(i + 1)
      const type = seen.get(id)
      if (!type) {
        if (!d.parts.some((p: any) => p?.id === id)) errors.push(`${where}: no part called ${id}`)
        return
      }
      const pins: string[] = PARTS[type].pins
      if (!pins.includes(pin)) errors.push(`${where}: ${type} has no pin ${pin}. pins: ${pins.join(' ')}`)
    }
    d.connections.forEach((c: unknown, i: number) => {
      if (!Array.isArray(c) || c.length < 2) return errors.push(`connection ${i} must be [from, to, colour, hints]`)
      ref(c[0], `connection ${i}`)
      ref(c[1], `connection ${i}`)
    })

    if (errors.length) return { errors }
    return { circuit: new Circuit(d as Diagram), errors }
  }

  // every part pin on the same copper as this one, itself included
  peers(ref: string, throughResistors = false) {
    const sets = throughResistors ? this.dc : this.wires
    const root = sets.find(ref)
    const out: string[] = []
    for (const p of this.diagram.parts) {
      for (const pin of PARTS[p.type].pins as string[]) {
        if (sets.find(`${p.id}:${pin}`) === root) out.push(`${p.id}:${pin}`)
      }
    }
    return out
  }

  // is anything at all wired to this pin
  wired(ref: string) {
    return this.peers(ref).length > 1
  }

  attr(id: string, name: string) {
    return this.parts.get(id)?.attrs?.[name]
  }

  // board pins wired straight to this pin, e.g. ['13'] or ['GND.1', 'GND.2', 'GND.3']
  boardPins(ref: string, throughResistors = false) {
    const sets = throughResistors ? this.dc : this.wires
    const root = sets.find(ref)
    return (PARTS[this.board.type].pins as string[]).filter((pin) => sets.find(`${this.board.id}:${pin}`) === root)
  }

  // the arduino pin a part pin is driven by or reads, like D13 or A0, if any
  signal(ref: string, throughResistors = false) {
    for (const pin of this.boardPins(ref, throughResistors)) {
      if (/^\d+$/.test(pin)) return `D${pin}`
      if (/^A\d$/.test(pin)) return pin
      const alias = pin.match(/^(A\d)\.2$/)
      if (alias) return alias[1]
    }
    return undefined
  }

  onGround(ref: string, throughResistors = false) {
    return this.boardPins(ref, throughResistors).some((p) => p.startsWith('GND'))
  }

  // the rail a pin is on, 5 or 3.3, or 0 when it reaches no supply. VIN is not one: on usb
  // power the uno feeds nothing back out of it
  supply(ref: string, throughResistors = false) {
    const pins = this.boardPins(ref, throughResistors)
    if (pins.includes('5V')) return 5
    if (pins.includes('3.3V')) return 3.3
    return 0
  }
}
