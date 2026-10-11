import type { Diagram } from '@blinkproof/sim'
import { Icon } from '../icons/Icon'
import { PART_ICON } from '../icons/Status'
import { KIND } from './Sidebar'

const BOARDS = ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-pi-pico']

export type Line = { type: string; name: string; detail?: string; count: number }

const ohms = (v: string) => {
  const n = Number(v)
  return Number.isFinite(n) ? (n >= 1000 ? `${n / 1000} kΩ` : `${n} Ω`) : v
}

// one shopping line per kind of part: same type and same value go together
export function bom(d: Diagram): Line[] {
  const out = new Map<string, Line>()
  for (const p of d.parts) {
    if (p.hide) continue
    const a = p.attrs ?? {}
    const detail = p.type === 'wokwi-resistor' ? ohms(a.value ?? '220') : p.type === 'wokwi-led' ? `${a.color ?? 'red'}, 5 mm` : p.type === 'wokwi-led-ring' ? `${a.pixels ?? 16} pixels, ws2812` : p.type === 'wokwi-pushbutton' ? 'tactile, 6 mm' : p.type === 'wokwi-ssd1306' ? 'i2c, 0.96 inch' : p.type === 'wokwi-servo' ? 'sg90 or similar' : p.type === 'wokwi-buzzer' ? 'passive' : p.type === 'wokwi-potentiometer' ? '10 kΩ' : undefined
    const key = `${p.type}|${detail ?? ''}`
    const line = out.get(key) ?? { type: p.type, name: (KIND[p.type] ?? p.type).replace(/^./, (c) => c.toUpperCase()), detail, count: 0 }
    line.count++
    out.set(key, line)
  }
  const lines = [...out.values()].sort((x, y) => Number(BOARDS.includes(y.type)) - Number(BOARDS.includes(x.type)))
  const wires = d.connections.length
  if (d.parts.length > 1) lines.push({ type: 'breadboard', name: 'Breadboard', detail: 'half size is enough', count: 1 })
  if (wires) lines.push({ type: 'wire', name: 'Jumper wires', detail: 'male to male', count: wires })
  return lines
}

// a pin the way you would say it holding the part
function say(ref: string, d: Diagram) {
  const [id, pin] = ref.split(':')
  const part = d.parts.find((p) => p.id === id)
  if (!part) return ref
  if (BOARDS.includes(part.type)) {
    const name = pin.replace(/\.\d$/, '')
    return /^\d+$/.test(name) ? `pin ${name}` : name === 'GND' ? 'GND' : name
  }
  const names: Record<string, Record<string, string>> = {
    'wokwi-led': { A: 'the long leg (+)', C: 'the short leg (-)' },
    'wokwi-resistor': { '1': 'one end', '2': 'the other end' },
    'wokwi-pushbutton': { '1.l': 'a top leg', '1.r': 'a top leg', '2.l': 'a bottom leg', '2.r': 'a bottom leg' },
    'wokwi-buzzer': { '1': 'the - leg', '2': 'the + leg' },
  }
  return `${names[part.type]?.[pin] ?? pin} of ${id}`
}

// what to wire, grouped by the part you are holding, in the order a person builds it
export function steps(d: Diagram) {
  const board = d.parts.find((p) => BOARDS.includes(p.type))
  const order = d.parts.filter((p) => p !== board && !p.hide)
  const done = new Set<number>()
  const groups: { id: string; type: string; lines: { text: string; color?: string }[] }[] = []
  for (const p of order) {
    const lines: { text: string; color?: string }[] = []
    d.connections.forEach(([a, b, color], i) => {
      if (done.has(i)) return
      const mine = a.startsWith(`${p.id}:`) ? a : b.startsWith(`${p.id}:`) ? b : null
      if (!mine) return
      done.add(i)
      const other = mine === a ? b : a
      lines.push({ text: `${say(mine, d)} to ${say(other, d)}`, color })
    })
    if (lines.length) groups.push({ id: p.id, type: p.type, lines })
  }
  return groups
}

// the parts to get and the wires to make, for building the proven gadget for real
export function BuildGuide({ diagram }: { diagram: Diagram }) {
  const lines = bom(diagram)
  const groups = steps(diagram)
  // numbered straight through every part, from 1
  const start = groups.map((_, i) => groups.slice(0, i).reduce((a, g) => a + g.lines.length, 0))
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between text-[12px]">
          <span className="font-semibold text-ink">Parts</span>
          <span className="text-dim">{lines.reduce((a, l) => a + (l.type === 'wire' ? 0 : l.count), 0)} pieces</span>
        </div>
        <div className="overflow-hidden rounded-[10px] border border-sep">
          {lines.map((l, i) => (
            <div key={i} className={`flex items-center gap-2.5 px-3 py-2 ${i ? 'border-t border-sep' : ''}`}>
              <Icon name={PART_ICON[l.type] ?? (l.type === 'wire' ? 'wire' : 'box')} size={15} className="text-icon-2" />
              <span className="min-w-0 flex-1">
                <span className="block text-[12.5px] text-ink">{l.name}</span>
                {l.detail && <span className="block text-[11px] text-dim">{l.detail}</span>}
              </span>
              <span className="font-mono text-[12px] text-ink">× {l.count}</span>
            </div>
          ))}
        </div>
      </div>
      <div>
        <div className="mb-2 text-[12px] font-semibold text-ink">Wiring, step by step</div>
        <div className="space-y-3">
          {groups.map((g, gi) => (
            <div key={g.id}>
              <div className="mb-1 flex items-center gap-1.5 text-[11.5px] font-medium text-dim">
                <Icon name={PART_ICON[g.type] ?? 'box'} size={13} />
                {g.id}
              </div>
              <ol className="space-y-1">
                {g.lines.map((l, li) => (
                  <li key={li} className="flex items-start gap-2.5 text-[12px] leading-[18px] text-ink">
                    <span className="mt-[1px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-input font-mono text-[10px] text-dim">{start[gi] + li + 1}</span>
                    <span className="mt-[6px] h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: l.color || 'var(--icon-2)' }} />
                    <span>Wire {l.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
