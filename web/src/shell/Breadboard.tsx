import { FACTS, holeName, proto, type Diagram, type End, type Hole, type Placed, type Proto } from '@blinkproof/sim'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'
import { PART_ICON } from '../icons/Status'
import { KIND } from './Sidebar'

const P = 12
const BAND_HEX: Record<string, string> = { black: '#111827', brown: '#7c2d12', red: '#dc2626', orange: '#f97316', yellow: '#facc15', green: '#16a34a', blue: '#2563eb', violet: '#7c3aed', grey: '#9ca3af', white: '#f9fafb', gold: '#c9a227' }
const LED_HEX: Record<string, string> = { red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#facc15', white: '#f1f5f9', orange: '#fb923c' }
const INK = '#2c4f9e'

export type Look = 'real' | 'blueprint'

// the order parts come in, which is the number on their callout, in the steps and on their card
function numbered(p: Proto) {
  const order: string[] = []
  const ids = new Set([...p.placed.map((x) => x.id), ...p.beside.map((x) => x.id)])
  for (const s of p.steps) for (const a of s.adds) if (ids.has(a) && !order.includes(a)) order.push(a)
  return order
}

// what a net is, in words: ground, the power rail, or the board pin it starts from
function netName(p: Proto, color: string, why: string) {
  if (color === '#1f2937') return 'ground'
  if (color === '#dc2626') return `${p.power} from the ${p.board.name}`
  return why
}

type DrawProps = { p: Proto; diagram: Diagram; look: Look; upTo: number; focus?: number; picked?: string | null; onPick?: (id: string | null) => void; callouts?: boolean; fill?: boolean }

// the breadboard seen from above with the board beside it, drawn to the hole. two looks of one drawing:
// real, in the colours of the bench, and blueprint, see through with numbered callouts
export function Drawing({ p, diagram, look, upTo, focus, picked, onPick, callouts = false, fill = false }: DrawProps) {
  const blue = look === 'blueprint'
  const shown = new Set(p.steps.slice(0, upTo + 1).flatMap((s) => s.adds))
  const hot = new Set(focus === undefined ? [] : (p.steps[focus]?.adds ?? []))
  // a picked part lights with its wires
  const pickedWires = new Set(
    picked
      ? p.jumpers
          .filter((j) => [j.from, j.to].some((e) => ('part' in e && e.part === picked) || ('hole' in e && !('rail' in e.hole) && p.placed.find((x) => x.id === picked)?.legs.some((l) => !('rail' in l.hole) && l.hole.col === e.hole.col && (l.hole.row <= 'e') === ((e.hole as { row: string }).row <= 'e')))))
          .map((j) => j.id)
      : [],
  )
  if (picked) {
    hot.clear()
    hot.add(picked)
    pickedWires.forEach((w) => hot.add(w))
  }

  const boardPins = [...new Set(p.jumpers.flatMap((j) => [j.from, j.to]).filter((e): e is { board: string } => 'board' in e).map((e) => e.board))]
  const BW = 92
  const x0 = BW + 34
  const bbW = p.cols * P + 16
  const rowY: Record<string, number> = { a: 3, b: 4, c: 5, d: 6, e: 7, f: 9.6, g: 10.6, h: 11.6, i: 12.6, j: 13.6 }
  const railY: Record<string, number> = { 'top+': 0.6, 'top-': 1.6, 'bottom-': 15.6, 'bottom+': 16.6 }
  const top = 14
  const bbH = 17.6 * P
  const trayTop = top + bbH + 30
  const BX = 112
  const besideAt = (i: number) => ({ x: x0 + i * (BX + 12), y: trayTop })
  const order = numbered(p)
  const calloutX = x0 + bbW + 40
  const W = callouts ? calloutX + 170 : x0 + bbW + 6
  const H = trayTop + (p.beside.length ? 66 : 0) + 8
  const at = (h: Hole) => ({ x: x0 + (h.col - 0.5) * P, y: top + ('rail' in h ? railY[h.rail] : rowY[h.row]) * P })
  const boardPinAt = (pin: string) => ({ x: BW - 6, y: top + 30 + boardPins.indexOf(pin) * Math.min(16, (bbH - 46) / Math.max(1, boardPins.length - 1)) })
  const besidePins = (b: Placed) => [...new Set(p.jumpers.flatMap((j) => [j.from, j.to]).filter((e): e is { part: string; pin: string } => 'part' in e && e.part === b.id).map((e) => e.pin))]
  const endAt = (e: End) => {
    if ('hole' in e) return at(e.hole)
    if ('board' in e) return boardPinAt(e.board)
    const i = p.beside.findIndex((b) => b.id === e.part)
    const o = besideAt(i)
    return { x: o.x + 14 + besidePins(p.beside[i]).indexOf(e.pin) * 24, y: o.y + 4 }
  }
  const state = (id: string) => (!shown.has(id) ? 'hidden' : hot.size && !hot.has(id) ? 'dim' : 'on')
  const op = (id: string) => (state(id) === 'hidden' ? 0 : state(id) === 'dim' ? 0.3 : 1)
  const centre = (id: string) => {
    const x = p.placed.find((q) => q.id === id)
    if (x) {
      const legs = x.legs.map((l) => at(l.hole))
      return { x: legs.reduce((a, l) => a + l.x, 0) / legs.length, y: Math.min(...legs.map((l) => l.y)) - (x.type === 'wokwi-resistor' ? 0 : 8) }
    }
    const i = p.beside.findIndex((b) => b.id === id)
    const o = besideAt(i)
    return { x: o.x + 40, y: o.y + 22 }
  }
  const click = (id: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    onPick?.(picked === id ? null : id)
  }

  const holeFill = blue ? '#b7c3e3' : '#cfcfcf'
  const label = { fontFamily: 'Geist Mono, monospace' }
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={fill ? 'block h-full w-full' : 'block h-auto w-full'} preserveAspectRatio="xMidYMid meet" role="img" aria-label="the circuit on a breadboard" onClick={() => onPick?.(null)}>
      {/* the board, its used pins down the edge */}
      <g>
        <rect x={0} y={top} width={BW} height={bbH} rx={8} fill={blue ? 'rgba(44,79,158,.07)' : '#0f5c8a'} stroke={blue ? INK : 'none'} strokeWidth={1.2} />
        <text x={10} y={top + 18} fontSize={11} fontWeight={600} fill={blue ? INK : '#fff'} fontFamily="Geist, sans-serif">
          {p.board.name}
        </text>
        {boardPins.map((pin) => {
          const o = boardPinAt(pin)
          const name = pin.split(':')[1].replace(/\.\d$/, '')
          return (
            <g key={pin}>
              <text x={o.x - 8} y={o.y + 3} textAnchor="end" fontSize={8.5} fill={blue ? INK : '#e0f2fe'} {...label}>
                {/^\d+$/.test(name) ? `D${name}` : name}
              </text>
              <rect x={o.x - 3} y={o.y - 3} width={6} height={6} fill={blue ? '#fff' : '#111827'} stroke={blue ? INK : '#9ca3af'} strokeWidth={0.6} />
            </g>
          )
        })}
      </g>

      {/* the breadboard */}
      <rect x={x0 - 8} y={top} width={bbW} height={bbH} rx={6} fill={blue ? 'rgba(255,255,255,.55)' : '#fafafa'} stroke={blue ? INK : '#dcdcdc'} strokeWidth={blue ? 1.4 : 1} />
      {(['top+', 'top-', 'bottom-', 'bottom+'] as const).map((r) => (
        <g key={r}>
          <line x1={x0} x2={x0 + p.cols * P} y1={top + railY[r] * P + (r === 'top+' || r === 'bottom-' ? -5 : 5)} y2={top + railY[r] * P + (r === 'top+' || r === 'bottom-' ? -5 : 5)} stroke={r.endsWith('+') ? '#ef4444' : '#3b82f6'} strokeWidth={1} opacity={0.6} />
          <text x={x0 - 5} y={top + railY[r] * P + 3} textAnchor="end" fontSize={8} fill={r.endsWith('+') ? '#ef4444' : '#3b82f6'} {...label}>
            {r.endsWith('+') ? '+' : '−'}
          </text>
          {Array.from({ length: p.cols }, (_, i) => (i % 6 === 5 ? null : <rect key={i} x={x0 + i * P + P / 2 - 1.6} y={top + railY[r] * P - 1.6} width={3.2} height={3.2} rx={0.6} fill={holeFill} />))}
        </g>
      ))}
      <rect x={x0} y={top + 8.05 * P} width={p.cols * P} height={0.9 * P} fill={blue ? 'rgba(44,79,158,.06)' : '#f0f0f0'} />
      {Object.entries(rowY).map(([row, y]) => (
        <g key={row}>
          <text x={x0 - 5} y={top + y * P + 3} textAnchor="end" fontSize={7.5} fill="#a3a3a3" {...label}>
            {row}
          </text>
          {Array.from({ length: p.cols }, (_, i) => (
            <rect key={i} x={x0 + i * P + P / 2 - 1.6} y={top + y * P - 1.6} width={3.2} height={3.2} rx={0.6} fill={holeFill} />
          ))}
        </g>
      ))}
      {Array.from({ length: p.cols }, (_, i) =>
        (i + 1) % 5 === 0 || i === 0 ? (
          <text key={i} x={x0 + i * P + P / 2} y={top + 2.35 * P} textAnchor="middle" fontSize={7} fill="#a3a3a3" {...label}>
            {i + 1}
          </text>
        ) : null,
      )}

      {/* the tray: parts with no breadboard form, dashed to their holes */}
      {p.beside.length > 0 && (
        <text x={x0} y={trayTop - 8} fontSize={8.5} fill={blue ? INK : '#8c8c8c'} {...label}>
          beside the board: these connect with jumper wires
        </text>
      )}
      {p.beside.map((b, i) => {
        const o = besideAt(i)
        const pins = besidePins(b)
        const w = Math.max(BX, 28 + pins.length * 24)
        return (
          <g key={b.id} opacity={op(b.id)} onClick={click(b.id)} className="cursor-pointer">
            <rect x={o.x} y={o.y} width={w} height={44} rx={6} fill={blue ? 'rgba(44,79,158,.06)' : '#1f2937'} stroke={blue || hot.has(b.id) ? INK : 'none'} strokeWidth={hot.has(b.id) ? 2 : 1} strokeDasharray={blue ? '4 3' : undefined} />
            <text x={o.x + 10} y={o.y + 33} fontSize={10} fill={blue ? INK : '#e5e7eb'} fontFamily="Geist, sans-serif">
              {b.id}
            </text>
            {pins.map((pin, k) => (
              <g key={pin}>
                <circle cx={o.x + 14 + k * 24} cy={o.y + 4} r={2.4} fill={blue ? INK : '#e5e7eb'} />
                <text x={o.x + 14 + k * 24} y={o.y + 16} textAnchor="middle" fontSize={6.5} fill={blue ? INK : '#9ca3af'} {...label}>
                  {pin}
                </text>
              </g>
            ))}
          </g>
        )
      })}

      {/* parts in the breadboard */}
      {p.placed.map((x) => (
        <g key={x.id} opacity={op(x.id)} onClick={click(x.id)} className="cursor-pointer">
          <PartBody x={x} legs={x.legs.map((l) => at(l.hole))} look={look} ring={hot.has(x.id) ? '#2563eb' : undefined} color={diagram.parts.find((q) => q.id === x.id)?.attrs?.color} />
        </g>
      ))}

      {/* jumpers on top, bowed so they do not hide each other. blueprint draws them thin and dashed */}
      {p.jumpers.map((j, k) => {
        const a = endAt(j.from)
        const b = endAt(j.to)
        const bow = Math.min(26, Math.hypot(b.x - a.x, b.y - a.y) * 0.25)
        const d = `M${a.x} ${a.y} Q${(a.x + b.x) / 2 + (k % 2 ? 4 : -4)} ${(a.y + b.y) / 2 - bow} ${b.x} ${b.y}`
        return (
          <g key={j.id} opacity={op(j.id)}>
            {hot.has(j.id) && <path d={d} stroke="#2563eb" strokeOpacity={0.3} strokeWidth={6} fill="none" strokeLinecap="round" />}
            <path d={d} stroke={j.color} strokeWidth={blue ? 1.2 : 2} fill="none" strokeLinecap="round" strokeDasharray={blue ? '4 3' : undefined} />
            <circle cx={a.x} cy={a.y} r={hot.has(j.id) ? 3.2 : 1.8} fill={hot.has(j.id) ? 'none' : j.color} stroke={hot.has(j.id) ? '#2563eb' : 'none'} strokeWidth={1.2} />
            <circle cx={b.x} cy={b.y} r={hot.has(j.id) ? 3.2 : 1.8} fill={hot.has(j.id) ? 'none' : j.color} stroke={hot.has(j.id) ? '#2563eb' : 'none'} strokeWidth={1.2} />
            {/* the holes this step uses, named on the board the way the steps name them */}
            {hot.has(j.id) &&
              [j.from, j.to].map((e, k) =>
                'hole' in e && !('rail' in e.hole) ? (
                  <text key={k} x={(k ? b : a).x + 4} y={(k ? b : a).y - 4} fontSize={7} fontWeight={600} fill="#1d4ed8" fontFamily="Geist Mono, monospace" paintOrder="stroke" stroke="#ffffff" strokeWidth={2.4}>
                    {holeName(e.hole)}
                  </text>
                ) : null,
              )}
          </g>
        )
      })}

      {/* callouts: the same number as in the steps and on the part's card */}
      {callouts &&
        order
          .filter((id) => shown.has(id))
          .map((id, i, all) => {
            const c = centre(id)
            const y = top + 10 + i * Math.min(26, (H - top - 20) / Math.max(1, all.length))
            const n = String(order.indexOf(id) + 1).padStart(2, '0')
            const type = [...p.placed, ...p.beside].find((q) => q.id === id)?.type ?? ''
            return (
              <g key={id} opacity={hot.size && !hot.has(id) ? 0.35 : 1} onClick={click(id)} className="cursor-pointer">
                <path d={`M${c.x} ${c.y} L${calloutX - 10} ${y}`} stroke={INK} strokeWidth={0.8} fill="none" />
                <circle cx={c.x} cy={c.y} r={2} fill={INK} />
                <rect x={calloutX - 10} y={y - 9} width={170} height={18} rx={9} fill="#fff" stroke={INK} strokeWidth={hot.has(id) ? 1.8 : 1} />
                <text x={calloutX} y={y + 3.5} fontSize={9} fill={INK} {...label}>
                  {n} {id} <tspan fill="#6b7aa6">{(KIND[type] ?? '').slice(0, 16)}</tspan>
                </text>
              </g>
            )
          })}
    </svg>
  )
}

// a part as it looks on the bench, or as an outline in blueprint
function PartBody({ x, legs, look, ring, color }: { x: Placed; legs: { x: number; y: number }[]; look: Look; ring?: string; color?: string }) {
  const blue = look === 'blueprint'
  const xs = legs.map((l) => l.x)
  const ys = legs.map((l) => l.y)
  const left = Math.min(...xs)
  const right = Math.max(...xs)
  const mid = (left + right) / 2
  const y0 = Math.min(...ys)
  const stroke = ring ?? (blue ? INK : 'none')
  const sw = ring ? 1.8 : 1.1
  const fill = (real: string) => (blue ? 'rgba(44,79,158,.08)' : real)
  const legDots = legs.map((l, k) => <rect key={k} x={l.x - 1.8} y={l.y - 1.8} width={3.6} height={3.6} rx={0.6} fill={blue ? INK : '#6b7280'} />)
  if (x.type === 'wokwi-resistor') {
    const [a, b] = legs
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
    return (
      <g transform={`translate(${a.x} ${a.y}) rotate(${ang})`}>
        <line x1={0} x2={len} y1={0} y2={0} stroke={blue ? INK : '#9ca3af'} strokeWidth={1.2} />
        <rect x={len / 2 - 11} y={-3.6} width={22} height={7.2} rx={3.4} fill={fill('#e8d3a8')} stroke={stroke} strokeWidth={sw} />
        {!blue && (x.bands ?? []).map((c, k) => <rect key={k} x={len / 2 - 8 + k * 4.4 + (k === 3 ? 1.6 : 0)} y={-3.6} width={2.2} height={7.2} fill={BAND_HEX[c]} />)}
      </g>
    )
  }
  const box = (w: number, h: number, real: string, dy = -h - 3) => <rect x={mid - w / 2} y={y0 + dy} width={w} height={h} rx={3} fill={fill(real)} stroke={stroke} strokeWidth={sw} />
  const span = right - left + 10
  let art: React.ReactNode
  switch (x.type) {
    case 'wokwi-led':
      art = <circle cx={mid} cy={y0 - 7} r={6.2} fill={blue ? 'none' : (LED_HEX[color ?? 'red'] ?? '#ef4444')} stroke={ring ?? (blue ? INK : '#00000030')} strokeWidth={sw} />
      break
    case 'wokwi-rgb-led':
      art = <circle cx={mid} cy={y0 - 8} r={7.5} fill={blue ? 'none' : '#f8fafc'} stroke={ring ?? (blue ? INK : '#cbd5e1')} strokeWidth={sw} />
      break
    case 'wokwi-pushbutton':
      art = (
        <g>
          <rect x={left - 4} y={y0 - 4} width={right - left + 8} height={Math.max(...ys) - y0 + 8} rx={3} fill={fill('#374151')} stroke={stroke} strokeWidth={sw} />
          <circle cx={mid} cy={(y0 + Math.max(...ys)) / 2} r={6} fill={blue ? 'none' : '#111827'} stroke={blue ? INK : 'none'} />
        </g>
      )
      break
    case 'wokwi-7segment':
      art = (
        <g>
          <rect x={left - 5} y={y0 - 5} width={span} height={Math.max(...ys) - y0 + 10} rx={3} fill={fill('#111827')} stroke={stroke} strokeWidth={sw} />
          <text x={mid} y={(y0 + Math.max(...ys)) / 2 + 6} textAnchor="middle" fontSize={18} fill={blue ? INK : '#dc2626'} fontFamily="Geist Mono, monospace">
            8
          </text>
        </g>
      )
      break
    case 'wokwi-hc-sr04':
      art = (
        <g>
          {box(Math.max(span, 60), 30, '#1d5fa8')}
          <circle cx={mid - 14} cy={y0 - 18} r={10} fill={blue ? 'none' : '#d9dee4'} stroke={blue ? INK : '#8c96a3'} strokeWidth={2} />
          <circle cx={mid + 14} cy={y0 - 18} r={10} fill={blue ? 'none' : '#d9dee4'} stroke={blue ? INK : '#8c96a3'} strokeWidth={2} />
        </g>
      )
      break
    case 'wokwi-ssd1306':
      art = (
        <g>
          {box(Math.max(span, 52), 36, '#1e3a8a')}
          <rect x={mid - 21} y={y0 - 34} width={42} height={22} rx={1.5} fill={blue ? 'none' : '#0b0f19'} stroke={blue ? INK : 'none'} />
        </g>
      )
      break
    case 'wokwi-dht22':
      art = (
        <g>
          {box(Math.max(span, 34), 38, '#f8fafc')}
          {!blue && Array.from({ length: 4 }, (_, r) => <rect key={r} x={mid - 11} y={y0 - 36 + r * 7} width={22} height={3.5} rx={1} fill="#cbd5e1" />)}
        </g>
      )
      break
    case 'wokwi-pir-motion-sensor':
      art = (
        <g>
          {box(Math.max(span, 40), 14, '#14532d', -14)}
          <circle cx={mid} cy={y0 - 22} r={14} fill={blue ? 'none' : '#f1f5f9'} stroke={blue ? INK : '#cbd5e1'} strokeWidth={sw} />
        </g>
      )
      break
    case 'wokwi-photoresistor-sensor':
      art = (
        <g>
          {box(Math.max(span, 44), 22, '#1e40af')}
          <circle cx={mid - 10} cy={y0 - 14} r={5} fill={blue ? 'none' : '#f59e0b'} stroke={blue ? INK : '#92400e'} />
        </g>
      )
      break
    case 'wokwi-potentiometer':
      art = (
        <g>
          {box(Math.max(span, 30), 26, '#1e40af')}
          <circle cx={mid} cy={y0 - 16} r={8} fill={blue ? 'none' : '#e5e7eb'} stroke={blue ? INK : '#6b7280'} />
        </g>
      )
      break
    case 'wokwi-buzzer':
      art = <circle cx={mid} cy={y0 - 12} r={11} fill={fill('#1f2937')} stroke={stroke} strokeWidth={sw} />
      break
    case 'wokwi-slide-switch':
      art = (
        <g>
          {box(Math.max(span, 30), 12, '#1f2937')}
          <rect x={mid - 4} y={y0 - 19} width={8} height={7} rx={1} fill={blue ? 'none' : '#9ca3af'} stroke={blue ? INK : 'none'} />
        </g>
      )
      break
    default:
      art = (
        <g>
          {box(Math.max(span, 30), 18, '#1e3a5f')}
          <text x={mid} y={y0 - 9} textAnchor="middle" fontSize={7.5} fill={blue ? INK : '#e5e7eb'} fontFamily="Geist Mono, monospace">
            {x.id}
          </text>
        </g>
      )
  }
  return (
    <g>
      {art}
      {legDots}
    </g>
  )
}

// a build's guide state, shared by the canvas and the drawer: the step, the ticks, the part picked, the look
export function useGuide(diagram: Diagram | null, key: string) {
  const p = useMemo(() => (diagram ? proto(diagram) : null), [diagram])
  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)
  const [look, setLook] = useState<Look>('real')
  const [list, setList] = useState<'steps' | 'shopping'>('steps')
  const store = `bp-ticks-${key}`
  const [ticks, setTicks] = useState<Set<number>>(new Set())
  useEffect(() => {
    try {
      setTicks(new Set(JSON.parse(localStorage.getItem(store) ?? '[]')))
    } catch {
      setTicks(new Set())
    }
    setStep(0)
    setPicked(null)
  }, [store])
  const tick = (n: number, on: boolean) =>
    setTicks((t) => {
      const next = new Set(t)
      if (on) next.add(n)
      else next.delete(n)
      try {
        localStorage.setItem(store, JSON.stringify([...next]))
      } catch {}
      return next
    })
  const last = p ? p.steps.length - 1 : 0
  return { p, step: Math.min(step, last), setStep, picked, setPicked, look, setLook, list, setList, ticks, tick, last }
}
export type Guide = ReturnType<typeof useGuide>

// the main area while building: the drawing big, its look switch, the notice about what sits beside, the legend
export function BuildView({ guide, diagram, title }: { guide: Guide; diagram: Diagram; title: string }) {
  const { p, step, picked, setPicked } = guide
  const [zoom, setZoom] = useState(1)
  const box = useRef<HTMLDivElement>(null)
  if (!p) return <div className="flex h-full items-center justify-center text-[13px] text-dim">There is no board in this circuit yet, add one to build it.</div>
  const nets = [...new Map(p.jumpers.map((j) => [j.color, netName(p, j.color, j.why)])).entries()].slice(0, 6)
  return (
    <div className="relative flex h-full flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-5 pb-2 pt-16">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        <span className="text-[12px] text-dim">on a {p.cols > 30 ? 'full' : 'half'} size breadboard</span>
        <div className="flex-1" />
      </div>
      {p.beside.length > 0 && (
        <div className="mx-5 mb-2 flex items-start gap-2 rounded-[10px] border border-warn/30 bg-warn/10 px-3 py-2 text-[12px] leading-[18px] text-ink">
          <Icon name="circle-info" size={14} className="mt-0.5 shrink-0 text-warn" />
          <span>
            <b className="font-semibold">{p.beside.map((b) => b.id).join(', ')}</b> {p.beside.length > 1 ? 'have' : 'has'} no breadboard form: {p.beside.length > 1 ? 'they sit' : 'it sits'} beside it in the tray and {p.beside.length > 1 ? 'connect' : 'connects'} with jumper wires.
          </span>
        </div>
      )}
      <div ref={box} className="relative min-h-0 flex-1 overflow-auto px-5">
        {!picked && (
          <div className="pointer-events-none sticky top-2 z-10 flex justify-center">
            <div className="pill pointer-events-auto flex items-center gap-1 py-1 pl-1 pr-1">
              <button onClick={() => guide.setStep(Math.max(0, step - 1))} disabled={step === 0} title="the step before" className="flex h-7 w-7 items-center justify-center rounded-[7px] text-icon hover:bg-hover disabled:opacity-30">
                <Icon name="chevron-left" size={12} />
              </button>
              <span className="px-2 text-[12.5px] text-ink">
                <span className="font-mono text-dim">{step + 1}/{p.steps.length}</span> <span className="font-medium">{p.steps[step].title}</span>
              </span>
              <button onClick={() => guide.setStep(Math.min(guide.last, step + 1))} disabled={step === guide.last} title="the next step" className="flex h-7 w-7 items-center justify-center rounded-[7px] text-icon hover:bg-hover disabled:opacity-30">
                <Icon name="chevron-right" size={12} />
              </button>
            </div>
          </div>
        )}
        <div className="mx-auto h-full py-4" style={{ width: `${Math.round(zoom * 100)}%`, height: `${Math.round(zoom * 100)}%` }}>
          <Drawing p={p} diagram={diagram} look="real" upTo={picked ? guide.last : step} focus={picked ? undefined : step} picked={picked} onPick={setPicked} callouts fill />
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-3 border-t border-sep px-5 py-2 text-[11.5px] text-dim">
        {nets.map(([c, n]) => (
          <span key={c} className="flex items-center gap-1.5">
            <span className="h-[3px] w-3.5 rounded-full" style={{ background: c }} />
            {n}
          </span>
        ))}
        <span>
          {p.jumpers.length} wires · {p.placed.length} on the board · {p.beside.length} beside it
        </span>
        <div className="flex-1" />
        <div className="flex items-center rounded-[8px] border border-line bg-panel">
          <button title="zoom out" onClick={() => setZoom((z) => Math.max(0.6, z - 0.2))} className="flex h-7 w-7 items-center justify-center text-icon hover:text-ink">
            <Icon name="minus" size={12} />
          </button>
          <button title="fit" onClick={() => setZoom(1)} className="flex h-7 items-center px-1.5 font-mono text-[11px] text-ink">
            {Math.round(zoom * 100)}%
          </button>
          <button title="zoom in" onClick={() => setZoom((z) => Math.min(3, z + 0.2))} className="flex h-7 w-7 items-center justify-center text-icon hover:text-ink">
            <Icon name="plus" size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// what a step adds, as rows to show rather than sentences: a part and the holes its legs go in, a resistor and its
// bands, a wire from where to where
type Row =
  | { kind: 'part'; id: string; type: string; legs: { pin: string; hole: string }[]; straddle: boolean }
  | { kind: 'resistor'; id: string; value: string; bands: string[]; from: string; to: string }
  | { kind: 'wire'; id: string; color: string; from: string; to: string }
  | { kind: 'beside'; id: string; type: string }
function rowsOf(p: Proto, adds: string[]): Row[] {
  const say = (pin: string) => {
    const n = pin.replace(/\.\d$/, '')
    return /^\d+$/.test(n) ? `D${n}` : n
  }
  const end = (e: End) => ('hole' in e ? holeName(e.hole).replace(/^the /, '') : 'board' in e ? `${p.board.name} ${say(e.board.split(':')[1])}` : `${e.part} ${e.pin}`)
  const out: Row[] = []
  for (const id of adds) {
    const x = p.placed.find((q) => q.id === id)
    if (x?.type === 'wokwi-resistor') out.push({ kind: 'resistor', id, value: x.label.split(', ')[1], bands: x.bands ?? [], from: holeName(x.legs[0].hole), to: holeName(x.legs[1].hole) })
    else if (x) out.push({ kind: 'part', id, type: x.type, legs: x.legs.map((l) => ({ pin: l.pin, hole: holeName(l.hole) })), straddle: x.type === 'wokwi-pushbutton' || x.type === 'wokwi-7segment' })
    const b = p.beside.find((q) => q.id === id)
    if (b) out.push({ kind: 'beside', id, type: b.type })
    const j = p.jumpers.find((q) => q.id === id)
    if (j) out.push({ kind: 'wire', id, color: j.color, from: end(j.from), to: end(j.to) })
  }
  return out
}

const Chip = ({ children, strong }: { children: React.ReactNode; strong?: boolean }) => (
  <span className={`inline-flex h-[22px] items-center rounded-[6px] border px-1.5 font-mono text-[11px] ${strong ? 'border-line bg-panel text-ink' : 'border-transparent bg-input text-dim'}`}>{children}</span>
)

function Resistor({ bands }: { bands: string[] }) {
  return (
    <svg width="46" height="14" viewBox="0 0 46 14" aria-hidden="true" className="shrink-0">
      <line x1="0" x2="46" y1="7" y2="7" stroke="#9ca3af" strokeWidth="1.4" />
      <rect x="10" y="1.5" width="26" height="11" rx="5" fill="#e8d3a8" />
      {bands.map((c, k) => (
        <rect key={k} x={13.5 + k * 5 + (k === 3 ? 2 : 0)} y="1.5" width="2.6" height="11" fill={BAND_HEX[c]} />
      ))}
    </svg>
  )
}

function StepRows({ rows, lead }: { rows: Row[]; lead: string[] }) {
  return (
    <div className="space-y-2.5">
      {lead.map((l, i) => (
        <p key={i} className="text-[12px] leading-[18px] text-ink">
          {l}
        </p>
      ))}
      {rows.map((r) => {
        if (r.kind === 'part')
          return (
            <div key={r.id} className="rounded-[10px] border border-sep bg-panel p-2.5">
              <div className="mb-2 flex items-center gap-2 text-[12.5px] text-ink">
                <Icon name={PART_ICON[r.type] ?? 'box'} size={14} className="text-icon" />
                <span>
                  {r.straddle ? 'Press' : 'Push'} <b className="font-semibold">{r.id}</b> in{r.straddle ? ' across the gap' : ''}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {r.legs.map((l, i) => (
                  <span key={i} className="inline-flex items-center gap-1">
                    <Chip>{l.pin}</Chip>
                    <Chip strong>{l.hole}</Chip>
                  </span>
                ))}
              </div>
            </div>
          )
        if (r.kind === 'resistor')
          return (
            <div key={r.id} className="flex items-center gap-2.5 rounded-[10px] border border-sep bg-panel px-2.5 py-2 text-[12px] text-ink">
              <Resistor bands={r.bands} />
              <span className="min-w-0 flex-1">
                <b className="font-semibold">{r.value}</b> <span className="text-dim">{r.bands.slice(0, 3).join(' ')}</span>
              </span>
              <Chip strong>{r.from}</Chip>
              <Icon name="chevron-right" size={10} className="text-icon-2" />
              <Chip strong>{r.to}</Chip>
            </div>
          )
        if (r.kind === 'beside')
          return (
            <div key={r.id} className="flex items-center gap-2 rounded-[10px] border border-dashed border-line px-2.5 py-2 text-[12px] text-ink">
              <Icon name={PART_ICON[r.type] ?? 'box'} size={14} className="text-icon" />
              <span>
                <b className="font-semibold">{r.id}</b> stays beside the breadboard, on jumper wires
              </span>
            </div>
          )
        return (
          <div key={r.id} className="flex items-center gap-2 px-0.5 text-[12px]">
            <span className="h-[3px] w-4 shrink-0 rounded-full" style={{ background: r.color }} />
            <Chip strong>{r.from}</Chip>
            <Icon name="chevron-right" size={10} className="shrink-0 text-icon-2" />
            <Chip strong>{r.to}</Chip>
          </div>
        )
      })}
    </div>
  )
}

const summary = (rows: Row[]) => {
  const parts = rows.filter((r) => r.kind === 'part' || r.kind === 'beside').length
  const res = rows.filter((r) => r.kind === 'resistor').length
  const wires = rows.filter((r) => r.kind === 'wire').length
  return [parts && `${parts} part${parts > 1 ? 's' : ''}`, res && `${res} resistor${res > 1 ? 's' : ''}`, wires && `${wires} wire${wires > 1 ? 's' : ''}`].filter(Boolean).join(' · ')
}

// the sidebar while building: where you are, the steps, each opening into what it adds, the shopping list,
// or the card of the part picked
export function BuildDrawer({ guide, diagram }: { guide: Guide; diagram: Diagram }) {
  const { p, step, setStep, ticks, tick, picked, setPicked, list, setList } = guide
  // keep the open step in view by scrolling its own list, never scrollIntoView, which drags the tab track along
  const current = useRef<HTMLLIElement>(null)
  useEffect(() => {
    const el = current.current
    const box = el?.closest('ol')
    if (!el || !box) return
    const top = el.offsetTop - box.offsetTop
    if (top < box.scrollTop || top > box.scrollTop + box.clientHeight - 80) box.scrollTop = top - 12
  }, [step])
  if (!p) return <p className="px-4 text-[12px] text-dim">Add a board to see how to build it.</p>
  const order = numbered(p)
  if (picked) return <PartCard p={p} diagram={diagram} id={picked} n={order.indexOf(picked) + 1} onClose={() => setPicked(null)} onStep={(i) => (setPicked(null), setStep(i))} />
  const done = p.steps.filter((s) => ticks.has(s.n)).length
  return (
    <div className="flex h-full flex-col">
      <div className="mx-4 mb-3 flex shrink-0 rounded-[9px] bg-input p-0.5">
        {(['steps', 'shopping'] as const).map((l) => (
          <button key={l} onClick={() => setList(l)} className={`flex h-7 flex-1 items-center justify-center gap-1.5 rounded-[7px] text-[12px] font-medium ${list === l ? 'bg-panel text-ink shadow-[0_1px_2px_rgba(0,0,0,.08)]' : 'text-dim hover:text-ink'}`}>
            <Icon name={l === 'steps' ? 'unordered-list' : 'box'} size={12} />
            {l === 'steps' ? 'Build it' : 'Shopping list'}
          </button>
        ))}
      </div>
      {list === 'shopping' ? (
        <Shopping p={p} diagram={diagram} />
      ) : (
        <>
          <div className="shrink-0 px-4 pb-3">
            <div className="flex items-baseline justify-between">
              <span className="text-[15px] font-semibold text-ink">
                Step {step + 1} <span className="font-normal text-dim">of {p.steps.length}</span>
              </span>
              <span className="text-[11.5px] text-dim">{done} done</span>
            </div>
            <div className="mt-2 flex gap-1">
              {p.steps.map((s, i) => (
                <button key={s.n} onClick={() => setStep(i)} title={s.title} className={`h-1.5 flex-1 rounded-full transition-colors ${ticks.has(s.n) ? 'bg-ok/70' : i === step ? 'bg-accent-line' : 'bg-input'}`} />
              ))}
            </div>
          </div>
          <ol className="min-h-0 flex-1 space-y-1.5 overflow-auto px-3 pb-3">
            {p.steps.map((s, i) => {
              const open = i === step
              const isDone = ticks.has(s.n)
              const rows = rowsOf(p, s.adds)
              const lead = s.adds.length === 0 || s.n === 1 ? (s.n === 1 ? s.do.slice(0, 1) : s.do) : []
              return (
                <li key={s.n} ref={open ? current : undefined} className={`rounded-[12px] border transition-colors ${open ? 'border-line bg-accent/5 shadow-[0_1px_2px_rgba(0,0,0,.04)]' : 'border-transparent hover:bg-hover'}`}>
                  <div className="flex items-start gap-2.5 px-2.5 py-2">
                    <button onClick={() => tick(s.n, !isDone)} title={isDone ? 'mark as not done' : 'mark as done'} className={`mt-px flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border text-[10.5px] font-semibold transition-colors ${isDone ? 'border-ok bg-ok text-white' : open ? 'border-accent-line text-ink' : 'border-line text-dim'}`}>
                      {isDone ? <Icon name="check" size={11} /> : s.n}
                    </button>
                    <button onClick={() => setStep(i)} className="min-w-0 flex-1 text-left">
                      <span className={`block text-[13px] font-medium ${isDone && !open ? 'text-dim' : 'text-ink'}`}>{s.title}</span>
                      {!open && summary(rows) && <span className="block text-[11px] text-dim">{summary(rows)}</span>}
                    </button>
                  </div>
                  {open && (
                    <div className="px-2.5 pb-3 pl-[42px]">
                      <StepRows rows={rows} lead={lead} />
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
          <div className="flex shrink-0 items-center gap-2 border-t border-sep px-4 py-3">
            <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="flex h-9 w-9 items-center justify-center rounded-[9px] border border-line text-icon hover:bg-hover disabled:opacity-40" title="the step before">
              <Icon name="chevron-left" size={12} />
            </button>
            <button onClick={() => (tick(p.steps[step].n, true), setStep(Math.min(guide.last, step + 1)))} className="flex h-9 flex-1 items-center justify-center gap-1.5 rounded-[9px] bg-accent text-[12.5px] font-semibold text-on-accent hover:bg-accent-hover">
              <Icon name="check" size={12} />
              {step === guide.last ? 'Done, all built' : 'Done, next step'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}

function Shopping({ p, diagram }: { p: Proto; diagram: Diagram }) {
  const lines = new Map<string, { name: string; note?: string; count: number }>()
  for (const x of [...p.placed, ...p.beside]) {
    const value = x.type === 'wokwi-resistor' ? `${x.label.split(', ')[1]}, ${x.bands?.slice(0, 3).join(' ')}` : undefined
    const key = `${x.type}|${value ?? diagram.parts.find((q) => q.id === x.id)?.attrs?.color ?? ''}`
    const line = lines.get(key) ?? { name: (KIND[x.type] ?? x.type).replace(/^./, (c) => c.toUpperCase()), note: value ?? FACTS[x.type]?.supply, count: 0 }
    line.count++
    lines.set(key, line)
  }
  return (
    <ul className="min-h-0 flex-1 space-y-px overflow-auto px-4 pb-4">
      <li className="flex justify-between py-1.5 text-[12.5px] text-ink">
        <span>{p.board.name}</span>
        <span className="font-mono">× 1</span>
      </li>
      {[...lines.values()].map((l, i) => (
        <li key={i} className="flex justify-between gap-3 border-t border-sep py-1.5 text-[12.5px] text-ink">
          <span className="min-w-0">
            {l.name}
            {l.note && <span className="block text-[11px] text-dim">{l.note}</span>}
          </span>
          <span className="font-mono">× {l.count}</span>
        </li>
      ))}
      <li className="flex justify-between border-t border-sep py-1.5 text-[12.5px] text-ink">
        <span>
          Breadboard<span className="block text-[11px] text-dim">{p.cols > 30 ? 'full size' : 'half size'}</span>
        </span>
        <span className="font-mono">× 1</span>
      </li>
      <li className="flex justify-between border-t border-sep py-1.5 text-[12.5px] text-ink">
        <span>
          Jumper wires<span className="block text-[11px] text-dim">male to male, a kit of 65 is plenty</span>
        </span>
        <span className="font-mono">× {p.jumpers.length}</span>
      </li>
    </ul>
  )
}

// a part picked on the canvas: what it is, the step that places it, every pin with its hole and where it goes
function PartCard({ p, diagram, id, n, onClose, onStep }: { p: Proto; diagram: Diagram; id: string; n: number; onClose: () => void; onStep: (i: number) => void }) {
  const x = [...p.placed, ...p.beside].find((q) => q.id === id)
  if (!x) return null
  const facts = FACTS[x.type]
  const stepAt = p.steps.findIndex((s) => s.adds.includes(id))
  const goes = (pin: string) =>
    diagram.connections
      .filter(([a, b]) => a === `${id}:${pin}` || b === `${id}:${pin}`)
      .map(([a, b]) => (a === `${id}:${pin}` ? b : a))
      .join(', ')
  const pins = 'legs' in x && x.legs.length ? x.legs.map((l) => ({ pin: l.pin, hole: holeName(l.hole) })) : (p.jumpers.flatMap((j) => [j.from]).filter((e): e is { part: string; pin: string } => 'part' in e && e.part === id).map((e) => ({ pin: e.pin, hole: 'jumper' })))
  return (
    <div className="flex h-full flex-col overflow-auto px-4 pb-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full border border-line px-1.5 font-mono text-[11px] text-dim">{String(n).padStart(2, '0')}</span>
        <Icon name={PART_ICON[x.type] ?? 'box'} size={14} className="text-icon" />
        <span className="flex-1 truncate text-[13px] font-semibold text-ink">{id}</span>
        <button onClick={onClose} title="back to the steps" className="flex h-6 w-6 items-center justify-center rounded-full text-icon-2 hover:bg-hover hover:text-ink">
          <Icon name="xmark" size={11} />
        </button>
      </div>
      <dl className="space-y-1.5 text-[12px]">
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-dim">what it does</dt>
          <dd className="text-ink">{facts?.what ?? KIND[x.type] ?? x.type}</dd>
        </div>
        {x.type === 'wokwi-resistor' && (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-dim">bands</dt>
            <dd className="text-ink">{x.bands?.join(' ')}</dd>
          </div>
        )}
        {facts?.supply && (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-dim">runs on</dt>
            <dd className="text-ink">{facts.supply}</dd>
          </div>
        )}
        <div className="flex gap-3">
          <dt className="w-20 shrink-0 text-dim">placed in</dt>
          <dd>
            {stepAt >= 0 ? (
              <button onClick={() => onStep(stepAt)} className="text-accent-line underline-offset-2 hover:underline">
                step {stepAt + 1}, {p.steps[stepAt].title.toLowerCase()}
              </button>
            ) : (
              '-'
            )}
          </dd>
        </div>
        {p.beside.some((b) => b.id === id) && (
          <div className="flex gap-3">
            <dt className="w-20 shrink-0 text-dim">why beside</dt>
            <dd className="text-ink">it has no breadboard form, it connects with jumper wires</dd>
          </div>
        )}
      </dl>
      <div className="mb-1.5 mt-4 text-[10.5px] font-medium uppercase tracking-[.06em] text-dim">its pins and holes</div>
      <div className="divide-y divide-sep rounded-[9px] border border-sep">
        {pins.map((r, i) => (
          <div key={i} className="flex gap-3 px-2.5 py-1.5 text-[11.5px]">
            <span className="w-16 shrink-0 font-mono text-dim">{r.hole}</span>
            <span className="font-mono text-ink">{r.pin}</span>
            <span className="min-w-0 flex-1 truncate text-right font-mono text-dim">{goes(r.pin)}</span>
          </div>
        ))}
      </div>
      {facts?.note && <p className="mt-3 text-[11.5px] leading-[17px] text-dim">{facts.note}</p>}
    </div>
  )
}

// the compact version for a narrow panel, used in onboarding: the drawing and its steps under it
export function BreadboardGuide({ diagram }: { diagram: Diagram }) {
  const guide = useGuide(diagram, 'onboard')
  const { p, step, setStep, last } = guide
  if (!p) return <p className="text-[12px] text-dim">There is no board in this circuit yet.</p>
  const s = p.steps[step]
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[10px] border border-sep bg-frame p-2">
        <Drawing p={p} diagram={diagram} look="real" upTo={step} focus={step} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} title="the step before" className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-line text-icon hover:bg-hover disabled:opacity-40">
          <Icon name="chevron-left" size={12} />
        </button>
        <div className="flex flex-1 gap-1">
          {p.steps.map((x, i) => (
            <button key={i} onClick={() => setStep(i)} title={x.title} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-accent/50' : i === step ? 'bg-accent hover:bg-accent-hover' : 'bg-input'}`} />
          ))}
        </div>
        <button onClick={() => setStep(Math.min(last, step + 1))} disabled={step === last} title="the next step" className="flex h-8 items-center gap-1 rounded-[8px] bg-accent hover:bg-accent-hover px-3 text-[12px] font-semibold text-on-accent disabled:opacity-40">
          {step === last ? 'Done' : 'Next'}
          <Icon name="chevron-right" size={11} />
        </button>
      </div>
      <div className="rounded-[10px] border border-sep px-3 py-2.5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[13px] font-semibold text-ink">
            {s.n}. {s.title}
          </span>
          <span className="text-[11px] text-dim">
            step {step + 1} of {p.steps.length}
          </span>
        </div>
        <ul className="space-y-1">
          {s.do.map((line, i) => (
            <li key={i} className="flex gap-2 text-[12px] leading-[18px] text-ink">
              <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-icon-2" />
              {line}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
