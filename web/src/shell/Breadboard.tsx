import { FACTS, holeName, proto, type Diagram, type End, type Hole, type Placed, type Proto } from '@blinkproof/sim'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'
import { PART_ICON } from '../icons/Status'
import { KIND } from './Sidebar'
import { Field, Section, Sep } from './ui'

const P = 12
const BAND_HEX: Record<string, string> = { black: '#111827', brown: '#7c2d12', red: '#dc2626', orange: '#f97316', yellow: '#facc15', green: '#16a34a', blue: 'var(--accent-line)', violet: '#7c3aed', grey: '#9ca3af', white: '#f9fafb', gold: '#c9a227' }
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
      {p.beside.some((b) => shown.has(b.id)) && (
        <text x={x0} y={trayTop - 8} fontSize={7} fill={blue ? INK : '#8c8c8c'} fontFamily="Geist, sans-serif">
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
          <PartBody x={x} legs={x.legs.map((l) => at(l.hole))} look={look} ring={hot.has(x.id) ? 'var(--accent-line)' : undefined} color={diagram.parts.find((q) => q.id === x.id)?.attrs?.color} />
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
            {hot.has(j.id) && <path d={d} stroke="var(--accent-line)" strokeOpacity={0.14} strokeWidth={6} fill="none" strokeLinecap="round" />}
            <path d={d} stroke={j.color} strokeWidth={blue ? 1.2 : 2} fill="none" strokeLinecap="round" strokeDasharray={blue ? '4 3' : undefined} />
            <circle cx={a.x} cy={a.y} r={hot.has(j.id) ? 3.2 : 1.8} fill={hot.has(j.id) ? 'none' : j.color} stroke={hot.has(j.id) ? 'var(--accent-line)' : 'none'} strokeWidth={1.2} />
            <circle cx={b.x} cy={b.y} r={hot.has(j.id) ? 3.2 : 1.8} fill={hot.has(j.id) ? 'none' : j.color} stroke={hot.has(j.id) ? 'var(--accent-line)' : 'none'} strokeWidth={1.2} />
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

// the main area while building, the same way the circuit view is laid out: the build on a white frame with its
// name above it, and one floating pill at the bottom for where you are and the zoom
export function BuildView({ guide, diagram, title }: { guide: Guide; diagram: Diagram; title: string }) {
  const { p, step, picked, setPicked, setStep, last } = guide
  const [zoom, setZoom] = useState(1)
  if (!p) return <div className="flex h-full items-center justify-center text-[12px] text-dim">There is no board in this circuit yet, add one to build it.</div>
  return (
    <div className="relative h-full overflow-auto" onClick={() => setPicked(null)}>
      <div className="flex min-h-full items-center justify-center px-10 pb-24 pt-20">
        <div className="relative" style={{ width: `${Math.round(Math.min(1, zoom) * 100)}%`, minWidth: zoom > 1 ? `${Math.round(zoom * 100)}%` : undefined, maxWidth: zoom === 1 ? 980 : undefined }}>
          <span className="absolute -top-[18px] left-0 text-[11px] text-[var(--frame-label)]">{title}, on a {p.cols > 30 ? 'full' : 'half'} size breadboard</span>
          <div className="bg-frame px-6 py-5">
            <Drawing p={p} diagram={diagram} look="real" upTo={picked ? last : step} focus={picked ? undefined : step} picked={picked} onPick={setPicked} />
          </div>
        </div>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="pill pointer-events-auto flex h-9 items-center gap-1 px-1.5 font-mono text-[11px] text-dim" onClick={(e) => e.stopPropagation()}>
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0 || !!picked} title="the step before" className="flex h-7 w-7 items-center justify-center rounded-full text-icon hover:bg-hover disabled:opacity-40">
            <Icon name="chevron-left" size={12} />
          </button>
          <span className="min-w-[150px] px-1 text-center font-sans text-[12px] text-ink">
            {picked ? (
              picked
            ) : (
              <>
                <span className="font-mono text-dim">
                  {step + 1}/{p.steps.length}
                </span>{' '}
                {p.steps[step].title}
              </>
            )}
          </span>
          <button onClick={() => setStep(Math.min(last, step + 1))} disabled={step === last || !!picked} title="the next step" className="flex h-7 w-7 items-center justify-center rounded-full text-icon hover:bg-hover disabled:opacity-40">
            <Icon name="chevron-right" size={12} />
          </button>
          <span className="mx-1.5 h-4 w-px bg-sep" />
          <span className="px-1">{p.jumpers.length} wires</span>
          <span className="mx-1.5 h-4 w-px bg-sep" />
          <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.2).toFixed(1)))} title="zoom out" className="flex h-7 w-7 items-center justify-center rounded-full text-icon hover:bg-hover">
            <Icon name="minus" size={12} />
          </button>
          <button onClick={() => setZoom(1)} title="fit" className="w-10 text-center text-ink">
            {Math.round(zoom * 100)}%
          </button>
          <button onClick={() => setZoom((z) => Math.min(2.4, +(z + 0.2).toFixed(1)))} title="zoom in" className="flex h-7 w-7 items-center justify-center rounded-full text-icon hover:bg-hover">
            <Icon name="plus" size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// what a step adds, as rows rather than sentences: a part and the holes its legs go in, a resistor, a wire
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
  const end = (e: End) => ('hole' in e ? holeName(e.hole).replace(/^the /, '') : 'board' in e ? `${p.board.name.toLowerCase()}:${say(e.board.split(':')[1])}` : `${e.part}:${e.pin}`)
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

function Resistor({ bands }: { bands: string[] }) {
  return (
    <svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true" className="shrink-0">
      <line x1="0" x2="34" y1="5" y2="5" stroke="#9ca3af" strokeWidth="1.2" />
      <rect x="8" y="1" width="18" height="8" rx="3.5" fill="#e8d3a8" />
      {bands.map((c, k) => (
        <rect key={k} x={10.5 + k * 3.5 + (k === 3 ? 1.4 : 0)} y="1" width="1.8" height="8" fill={BAND_HEX[c]} />
      ))}
    </svg>
  )
}

// one grey row the way the inspector shows a pin: a label on the left, where it goes on the right in mono
function Line({ left, right, swatch }: { left: React.ReactNode; right: React.ReactNode; swatch?: string }) {
  return (
    <div className="flex h-6 items-center gap-2 rounded-[7px] bg-input px-2 text-[11px]">
      {swatch && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: swatch }} />}
      <span className="min-w-0 truncate font-mono text-ink">{left}</span>
      <span className="ml-auto truncate font-mono text-dim">{right}</span>
    </div>
  )
}

const summary = (rows: Row[]) => {
  const parts = rows.filter((r) => r.kind === 'part' || r.kind === 'beside').length
  const res = rows.filter((r) => r.kind === 'resistor').length
  const wires = rows.filter((r) => r.kind === 'wire').length
  return [parts && `${parts} part${parts > 1 ? 's' : ''}`, res && `${res} resistor${res > 1 ? 's' : ''}`, wires && `${wires} wire${wires > 1 ? 's' : ''}`].filter(Boolean).join(', ')
}

// the right panel while building, in the inspector's own sections: the steps, what the open one adds, what sits
// beside the board, or the shopping list, or the card of a part picked on the canvas
export function BuildDrawer({ guide, diagram }: { guide: Guide; diagram: Diagram }) {
  const { p, step, setStep, ticks, tick, picked, setPicked, list, setList, last } = guide
  if (!p) return <p className="px-4 text-[12px] text-dim">Add a board to see how to build it.</p>
  if (picked) return <PartCard p={p} diagram={diagram} id={picked} onClose={() => setPicked(null)} onStep={(i) => (setPicked(null), setStep(i))} />
  const done = p.steps.filter((s) => ticks.has(s.n)).length
  const s = p.steps[step]
  const rows = rowsOf(p, s.adds)
  const lead = s.adds.length === 0 ? s.do : s.n === 1 ? s.do.slice(0, 1) : []
  const parts = rows.filter((r): r is Extract<Row, { kind: 'part' }> => r.kind === 'part')
  const others = rows.filter((r) => r.kind !== 'part')
  return (
    <div className="flex h-full flex-col">
      <div className="px-2.5">
        <div className="relative grid grid-cols-2 rounded-[9px] bg-input p-0.5">
          <span className="absolute inset-y-0.5 left-0.5 w-[calc(50%-2px)] rounded-[7px] bg-panel shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_0.5px_rgba(0,0,0,.06)] transition-transform duration-300 ease-out" style={{ transform: `translateX(${list === 'shopping' ? 100 : 0}%)` }} />
          {(['steps', 'shopping'] as const).map((l) => (
            <button key={l} onClick={() => setList(l)} className={`relative z-10 flex h-7 items-center justify-center gap-1 text-[11px] font-medium ${list === l ? 'text-ink' : 'text-dim hover:text-ink'}`}>
              <Icon name={l === 'steps' ? 'unordered-list' : 'box'} size={13} />
              {l === 'steps' ? 'Steps' : 'Shopping list'}
            </button>
          ))}
        </div>
      </div>
      <div className="mt-3 min-h-0 flex-1 overflow-auto border-t border-sep pb-6 pt-3">
        {list === 'shopping' ? (
          <Shopping p={p} diagram={diagram} />
        ) : (
          <>
            <Section first title="Steps" right={<span className="text-[11px] text-dim">{done} of {p.steps.length} done</span>}>
              <div className="space-y-px">
                {p.steps.map((x, i) => {
                  const isDone = ticks.has(x.n)
                  const open = i === step
                  return (
                    <div key={x.n} className={`flex h-7 items-center gap-2 rounded-[7px] pl-1 pr-2 text-[12px] ${open ? 'chip' : 'hover:bg-hover'}`}>
                      <button onClick={() => tick(x.n, !isDone)} title={isDone ? 'mark as not done' : 'mark as done'} className="flex h-5 w-5 shrink-0 items-center justify-center">
                        {isDone ? <Icon name="circle-check" size={15} className="text-ok" /> : <span className={`flex h-[15px] w-[15px] items-center justify-center rounded-full border font-mono text-[9px] ${open ? 'border-ink text-ink' : 'border-icon-2 text-dim'}`}>{x.n}</span>}
                      </button>
                      <button onClick={() => setStep(i)} className={`min-w-0 flex-1 truncate text-left ${isDone && !open ? 'text-dim' : 'text-ink'}`}>
                        {x.title}
                      </button>
                      <span className="shrink-0 text-[11px] text-dim">{summary(rowsOf(p, x.adds))}</span>
                    </div>
                  )
                })}
              </div>
            </Section>
            <Sep />
            <Section title={`${step + 1}. ${s.title}`}>
              {lead.length > 0 && (
                <div className="mb-2.5 space-y-1">
                  {lead.map((l, i) => (
                    <p key={i} className="text-[12px] leading-[18px] text-dim">
                      {l}
                    </p>
                  ))}
                </div>
              )}
              {parts.map((r) => (
                <div key={r.id} className="mb-2.5">
                  <div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-dim">
                    <Icon name={PART_ICON[r.type] ?? 'box'} size={13} className="text-icon-2" />
                    {r.straddle ? 'press' : 'push'} {r.id} in{r.straddle ? ' across the gap' : ''}
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {r.legs.map((l, i) => (
                      <Line key={i} left={l.pin} right={l.hole} />
                    ))}
                  </div>
                </div>
              ))}
              {others.length > 0 && (
                <div className="space-y-1.5">
                  {others.map((r) =>
                    r.kind === 'resistor' ? (
                      <div key={r.id} className="flex h-6 items-center gap-2 rounded-[7px] bg-input px-2 text-[11px]">
                        <Resistor bands={r.bands} />
                        <span className="font-mono text-ink">{r.value}</span>
                        <span className="ml-auto font-mono text-dim">
                          {r.from} → {r.to}
                        </span>
                      </div>
                    ) : r.kind === 'beside' ? (
                      <Line key={r.id} left={r.id} right="beside the board" />
                    ) : (
                      <Line key={r.id} swatch={r.color} left={r.from} right={`→ ${r.to}`} />
                    ),
                  )}
                </div>
              )}
            </Section>
            {p.beside.length > 0 && (
              <>
                <Sep />
                <Section title="Beside the board" sub>
                  <p className="flex gap-2 text-[11.5px] leading-[17px] text-ink">
                    <Icon name="circle-info" size={14} className="mt-px shrink-0 text-icon-2" />
                    {p.beside.map((b) => b.id).join(', ')} {p.beside.length > 1 ? 'have' : 'has'} no breadboard form, {p.beside.length > 1 ? 'they connect' : 'it connects'} with jumper wires
                  </p>
                </Section>
              </>
            )}
          </>
        )}
      </div>
      {list === 'steps' && (
        <div className="flex shrink-0 items-center gap-2 border-t border-sep px-4 py-3">
          <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} className="h-7 rounded-[7px] bg-input px-2.5 text-[11px] font-semibold text-ink disabled:opacity-40">
            Back
          </button>
          <div className="flex-1" />
          <button onClick={() => (tick(s.n, true), setStep(Math.min(last, step + 1)))} className="flex h-7 items-center gap-1 rounded-[7px] bg-accent px-2.5 text-[11px] font-semibold text-on-accent hover:bg-accent-hover">
            {step === last ? 'Done' : 'Done, next'}
            <Icon name="chevron-right" size={10} />
          </button>
        </div>
      )}
    </div>
  )
}

function Shopping({ p, diagram }: { p: Proto; diagram: Diagram }) {
  const lines = new Map<string, { name: string; note?: string; count: number; bands?: string[] }>()
  for (const x of [...p.placed, ...p.beside]) {
    const value = x.type === 'wokwi-resistor' ? x.label.split(', ')[1] : undefined
    const key = `${x.type}|${value ?? diagram.parts.find((q) => q.id === x.id)?.attrs?.color ?? ''}`
    const line = lines.get(key) ?? { name: value ? `Resistor ${value}` : (KIND[x.type] ?? x.type).replace(/^./, (c) => c.toUpperCase()), note: value ? undefined : FACTS[x.type]?.supply, count: 0, bands: x.bands }
    line.count++
    lines.set(key, line)
  }
  const all = [{ name: p.board.name, count: 1 } as { name: string; note?: string; count: number; bands?: string[] }, ...lines.values(), { name: 'Breadboard', note: p.cols > 30 ? 'full size' : 'half size', count: 1 }, { name: 'Jumper wires', note: 'male to male', count: p.jumpers.length }]
  return (
    <Section first title="To buy" right={<span className="text-[11px] text-dim">{all.reduce((a, l) => a + (l.name === 'Jumper wires' ? 0 : l.count), 0)} pieces</span>}>
      <div className="space-y-1.5">
        {all.map((l, i) => (
          <div key={i} className="flex min-h-6 items-center gap-2 rounded-[7px] bg-input px-2 py-1 text-[11px]">
            {l.bands && <Resistor bands={l.bands} />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-ink">{l.name}</span>
              {l.note && <span className="block truncate text-dim">{l.note}</span>}
            </span>
            <span className="font-mono text-ink">× {l.count}</span>
          </div>
        ))}
      </div>
    </Section>
  )
}

// a part picked on the canvas: what it is, the step that places it, every pin with its hole and where it goes
function PartCard({ p, diagram, id, onClose, onStep }: { p: Proto; diagram: Diagram; id: string; onClose: () => void; onStep: (i: number) => void }) {
  const x = [...p.placed, ...p.beside].find((q) => q.id === id)
  if (!x) return null
  const facts = FACTS[x.type]
  const stepAt = p.steps.findIndex((s) => s.adds.includes(id))
  const goes = (pin: string) =>
    diagram.connections
      .filter(([a, b]) => a === `${id}:${pin}` || b === `${id}:${pin}`)
      .map(([a, b]) => (a === `${id}:${pin}` ? b : a))
      .join(', ')
  const pins = x.legs.length ? x.legs.map((l) => ({ pin: l.pin, hole: holeName(l.hole) })) : p.jumpers.map((j) => j.from).filter((e): e is { part: string; pin: string } => 'part' in e && e.part === id).map((e) => ({ pin: e.pin, hole: 'jumper' }))
  return (
    <div className="h-full overflow-auto pb-6">
      <Section
        first
        title={
          <>
            <Icon name={PART_ICON[x.type] ?? 'box'} size={13} className="text-icon-2" />
            {(KIND[x.type] ?? x.type).replace(/^./, (c) => c.toUpperCase())}
          </>
        }
        right={
          <>
            <span className="font-mono text-[11px] text-dim">{id}</span>
            <button onClick={onClose} title="back to the steps" className="flex h-5 w-5 items-center justify-center rounded-full text-icon-2 hover:text-ink">
              <Icon name="xmark" size={10} />
            </button>
          </>
        }
      >
        <p className="text-[12px] leading-[18px] text-ink">{facts?.what ?? KIND[x.type]}</p>
        <div className="mt-2.5 grid grid-cols-2 gap-1.5">
          {facts?.supply && <Field label="runs on" value={facts.supply} wide />}
          {x.type === 'wokwi-resistor' && <Field label="bands" value={x.bands?.slice(0, 3).join(' ')} wide />}
          <button onClick={() => stepAt >= 0 && onStep(stepAt)} className="col-span-2 flex h-6 items-center gap-2 rounded-[7px] bg-input px-2 text-[11px] hover:text-ink">
            <span className="text-dim">placed in</span>
            <span className="ml-auto truncate font-mono text-ink">{stepAt >= 0 ? `step ${stepAt + 1}` : 'beside the board'}</span>
            <Icon name="chevron-right" size={10} className="text-icon-2" />
          </button>
        </div>
      </Section>
      <Sep />
      <Section title="Pins and holes" sub>
        <div className="space-y-1.5">
          {pins.map((r, i) => (
            <div key={i} className="flex h-6 items-center gap-2 rounded-[7px] bg-input px-2 font-mono text-[11px]">
              <span className="w-12 shrink-0 text-ink">{r.pin}</span>
              <span className="text-dim">{r.hole}</span>
              <span className="ml-auto truncate text-dim">{goes(r.pin)}</span>
            </div>
          ))}
        </div>
      </Section>
      {facts?.note && (
        <>
          <Sep />
          <Section title="Watch out" sub>
            <p className="text-[11.5px] leading-[17px] text-ink">{facts.note}</p>
          </Section>
        </>
      )}
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
