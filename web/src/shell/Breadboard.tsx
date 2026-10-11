import { holeName, proto, type Diagram, type End, type Hole, type Placed } from '@blinkproof/sim'
import { useMemo, useState } from 'react'
import { Icon } from '../icons/Icon'

const P = 12
const BAND_HEX: Record<string, string> = { black: '#111827', brown: '#7c2d12', red: '#dc2626', orange: '#f97316', yellow: '#facc15', green: '#16a34a', blue: '#2563eb', violet: '#7c3aed', grey: '#9ca3af', white: '#f9fafb', gold: '#c9a227' }
const LED_HEX: Record<string, string> = { red: '#ef4444', green: '#22c55e', blue: '#3b82f6', yellow: '#facc15', white: '#f1f5f9', orange: '#fb923c' }

// the breadboard seen from above, with the board beside it, drawn to the hole
export function Breadboard({ diagram, upTo, focus }: { diagram: Diagram; upTo: number; focus?: number }) {
  const p = useMemo(() => proto(diagram), [diagram])
  if (!p) return null
  const shown = new Set(p.steps.slice(0, upTo + 1).flatMap((s) => s.adds))
  const hot = new Set(focus === undefined ? [] : p.steps[focus]?.adds ?? [])

  // board pins that wires reach, down its right edge
  const boardPins = [...new Set(p.jumpers.flatMap((j) => [j.from, j.to]).filter((e): e is { board: string } => 'board' in e).map((e) => e.board))]
  const BW = 92
  const x0 = BW + 34
  const W = x0 + p.cols * P + 10
  const rowY: Record<string, number> = { a: 3, b: 4, c: 5, d: 6, e: 7, f: 9.6, g: 10.6, h: 11.6, i: 12.6, j: 13.6 }
  const railY: Record<string, number> = { 'top+': 0.6, 'top-': 1.6, 'bottom-': 15.6, 'bottom+': 16.6 }
  const bbH = 17.6 * P
  const besideTop = bbH + 26
  const BX = 120
  const besideAt = (i: number) => ({ x: x0 + i * (BX + 14), y: besideTop })
  const H = besideTop + (p.beside.length ? 70 : 0) + 6
  const at = (h: Hole) => ({ x: x0 + (h.col - 0.5) * P, y: ('rail' in h ? railY[h.rail] : rowY[h.row]) * P })
  const boardPinAt = (pin: string) => {
    const i = boardPins.indexOf(pin)
    return { x: BW - 6, y: 30 + i * Math.min(16, (bbH - 46) / Math.max(1, boardPins.length - 1)) }
  }
  const besidePins = (b: Placed) => {
    const pins = [...new Set(p.jumpers.flatMap((j) => [j.from, j.to]).filter((e): e is { part: string; pin: string } => 'part' in e && e.part === b.id).map((e) => e.pin))]
    return pins
  }
  const endAt = (e: End) => {
    if ('hole' in e) return at(e.hole)
    if ('board' in e) return boardPinAt(e.board)
    const i = p.beside.findIndex((b) => b.id === e.part)
    const pins = besidePins(p.beside[i])
    const o = besideAt(i)
    return { x: o.x + 14 + pins.indexOf(e.pin) * 26, y: o.y + 4 }
  }
  const state = (id: string) => (!shown.has(id) ? 'hidden' : hot.size && !hot.has(id) ? 'dim' : 'on')
  const op = (id: string) => (state(id) === 'hidden' ? 0 : state(id) === 'dim' ? 0.35 : 1)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="block w-full" role="img" aria-label="the circuit on a breadboard">
      {/* the board, its used pins down the edge */}
      <rect x={0} y={0} width={BW} height={bbH} rx={8} fill="#0f5c8a" />
      <text x={10} y={18} fontSize={11} fontWeight={600} fill="#fff" fontFamily="Geist, sans-serif">
        {p.board.name}
      </text>
      {boardPins.map((pin) => {
        const o = boardPinAt(pin)
        const label = pin.split(':')[1].replace(/\.\d$/, '')
        return (
          <g key={pin}>
            <text x={o.x - 8} y={o.y + 3} textAnchor="end" fontSize={8.5} fill="#e0f2fe" fontFamily="Geist Mono, monospace">
              {/^\d+$/.test(label) ? `D${label}` : label}
            </text>
            <rect x={o.x - 3} y={o.y - 3} width={6} height={6} fill="#111827" stroke="#9ca3af" strokeWidth={0.6} />
          </g>
        )
      })}

      {/* the breadboard */}
      <rect x={x0 - 8} y={0} width={p.cols * P + 16} height={bbH} rx={6} fill="#f5f2ea" stroke="#d6d0c2" />
      {(['top+', 'top-', 'bottom-', 'bottom+'] as const).map((r) => (
        <g key={r}>
          <line x1={x0} x2={x0 + p.cols * P} y1={railY[r] * P + (r === 'top+' || r === 'bottom-' ? -5 : 5)} y2={railY[r] * P + (r === 'top+' || r === 'bottom-' ? -5 : 5)} stroke={r.endsWith('+') ? '#ef4444' : '#3b82f6'} strokeWidth={1} opacity={0.6} />
          <text x={x0 - 5} y={railY[r] * P + 3} textAnchor="end" fontSize={8} fill={r.endsWith('+') ? '#ef4444' : '#3b82f6'} fontFamily="Geist Mono, monospace">
            {r.endsWith('+') ? '+' : '−'}
          </text>
          {Array.from({ length: p.cols }, (_, i) => (i % 6 === 5 ? null : <rect key={i} x={x0 + i * P + P / 2 - 1.6} y={railY[r] * P - 1.6} width={3.2} height={3.2} rx={0.6} fill="#c9c1b0" />))}
        </g>
      ))}
      <rect x={x0} y={8.05 * P} width={p.cols * P} height={0.9 * P} fill="#ebe5d6" />
      {Object.entries(rowY).map(([row, y]) => (
        <g key={row}>
          <text x={x0 - 5} y={y * P + 3} textAnchor="end" fontSize={7.5} fill="#a39a86" fontFamily="Geist Mono, monospace">
            {row}
          </text>
          {Array.from({ length: p.cols }, (_, i) => (
            <rect key={i} x={x0 + i * P + P / 2 - 1.6} y={y * P - 1.6} width={3.2} height={3.2} rx={0.6} fill="#c9c1b0" />
          ))}
        </g>
      ))}
      {Array.from({ length: p.cols }, (_, i) =>
        (i + 1) % 5 === 0 || i === 0 ? (
          <text key={i} x={x0 + i * P + P / 2} y={2.35 * P} textAnchor="middle" fontSize={7} fill="#a39a86" fontFamily="Geist Mono, monospace">
            {i + 1}
          </text>
        ) : null,
      )}

      {/* parts that stay beside it */}
      {p.beside.map((b, i) => {
        const o = besideAt(i)
        const pins = besidePins(b)
        return (
          <g key={b.id} opacity={op(b.id)}>
            <rect x={o.x} y={o.y} width={Math.max(BX, 28 + pins.length * 26)} height={44} rx={6} fill="#1f2937" />
            <text x={o.x + 10} y={o.y + 32} fontSize={10} fill="#e5e7eb" fontFamily="Geist, sans-serif">
              {b.id}
            </text>
            {pins.map((pin, k) => (
              <g key={pin}>
                <circle cx={o.x + 14 + k * 26} cy={o.y + 4} r={2.4} fill="#e5e7eb" />
                <text x={o.x + 14 + k * 26} y={o.y + 16} textAnchor="middle" fontSize={7} fill="#9ca3af" fontFamily="Geist Mono, monospace">
                  {pin}
                </text>
              </g>
            ))}
          </g>
        )
      })}

      {/* parts in the breadboard */}
      {p.placed.map((x) => {
        const legs = x.legs.map((l) => at(l.hole))
        const xs = legs.map((l) => l.x)
        const ys = legs.map((l) => l.y)
        const ring = hot.has(x.id) ? '#2563eb' : 'none'
        let body: React.ReactNode
        if (x.type === 'wokwi-resistor') {
          const [a, b] = legs
          const len = Math.hypot(b.x - a.x, b.y - a.y)
          const ang = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI
          body = (
            <g transform={`translate(${a.x} ${a.y}) rotate(${ang})`}>
              <line x1={0} x2={len} y1={0} y2={0} stroke="#9ca3af" strokeWidth={1.2} />
              <rect x={len / 2 - 11} y={-3.6} width={22} height={7.2} rx={3.4} fill="#e8d3a8" stroke={ring} strokeWidth={1.4} />
              {(x.bands ?? []).map((c, k) => (
                <rect key={k} x={len / 2 - 8 + k * 4.4 + (k === 3 ? 1.6 : 0)} y={-3.6} width={2.2} height={7.2} fill={BAND_HEX[c]} />
              ))}
            </g>
          )
        } else if (x.type === 'wokwi-led') {
          const c = LED_HEX[diagram.parts.find((q) => q.id === x.id)?.attrs?.color ?? 'red'] ?? '#ef4444'
          body = <circle cx={(xs[0] + xs[1]) / 2} cy={ys[0] - 7} r={6.2} fill={c} stroke={ring === 'none' ? '#00000030' : ring} strokeWidth={1.4} />
        } else if (x.type === 'wokwi-pushbutton') {
          body = <rect x={Math.min(...xs) - 4} y={Math.min(...ys) - 4} width={Math.max(...xs) - Math.min(...xs) + 8} height={Math.max(...ys) - Math.min(...ys) + 8} rx={3} fill="#374151" stroke={ring} strokeWidth={1.4} />
        } else {
          const tall = x.type === 'wokwi-7segment'
          const left = Math.min(...xs) - 5
          const width = Math.max(...xs) - Math.min(...xs) + 10
          const top = tall ? Math.min(...ys) - 5 : Math.min(...ys) - 22
          const height = tall ? Math.max(...ys) - Math.min(...ys) + 10 : 18
          body = (
            <g>
              <rect x={left} y={top} width={width} height={height} rx={3} fill={tall ? '#111827' : '#1e3a5f'} stroke={ring} strokeWidth={1.4} />
              <text x={left + width / 2} y={top + height / 2 + 3} textAnchor="middle" fontSize={7.5} fill="#e5e7eb" fontFamily="Geist Mono, monospace">
                {tall ? '8' : x.id}
              </text>
            </g>
          )
        }
        return (
          <g key={x.id} opacity={op(x.id)}>
            {body}
            {x.type !== 'wokwi-resistor' && legs.map((l, k) => <rect key={k} x={l.x - 1.8} y={l.y - 1.8} width={3.6} height={3.6} rx={0.6} fill="#6b7280" />)}
          </g>
        )
      })}

      {/* jumpers on top, bowed a little so they do not hide each other */}
      {p.jumpers.map((j, k) => {
        const a = endAt(j.from)
        const b = endAt(j.to)
        const bow = Math.min(26, Math.hypot(b.x - a.x, b.y - a.y) * 0.25) * (k % 2 ? 1 : -1)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2 - Math.abs(bow)
        return (
          <g key={j.id} opacity={op(j.id)}>
            {hot.has(j.id) && <path d={`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`} stroke="#2563eb" strokeOpacity={0.35} strokeWidth={5} fill="none" strokeLinecap="round" />}
            <path d={`M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`} stroke={j.color} strokeWidth={1.8} fill="none" strokeLinecap="round" />
            <circle cx={a.x} cy={a.y} r={1.8} fill={j.color} />
            <circle cx={b.x} cy={b.y} r={1.8} fill={j.color} />
          </g>
        )
      })}
    </svg>
  )
}

// the breadboard and its steps: each step shows what came before, lights what it adds, hides what comes after
export function BreadboardGuide({ diagram }: { diagram: Diagram }) {
  const p = useMemo(() => proto(diagram), [diagram])
  const [step, setStep] = useState(0)
  if (!p) return <p className="text-[12px] text-dim">There is no board in this circuit yet.</p>
  const s = p.steps[Math.min(step, p.steps.length - 1)]
  const last = p.steps.length - 1
  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-[10px] border border-sep bg-[#fbfaf7] p-2">
        <Breadboard diagram={diagram} upTo={step} focus={step} />
      </div>
      <div className="flex items-center gap-2">
        <button onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0} title="the step before" className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-line text-icon hover:bg-hover disabled:opacity-40">
          <Icon name="chevron-left" size={12} />
        </button>
        <div className="flex flex-1 gap-1">
          {p.steps.map((x, i) => (
            <button key={i} onClick={() => setStep(i)} title={x.title} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? 'bg-accent/50' : i === step ? 'bg-accent' : 'bg-input'}`} />
          ))}
        </div>
        <button onClick={() => setStep(Math.min(last, step + 1))} disabled={step === last} title="the next step" className="flex h-8 items-center gap-1 rounded-[8px] bg-accent px-3 text-[12px] font-semibold text-on-accent disabled:opacity-40">
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
      <p className="text-[11px] leading-[16px] text-dim">Holes are named the way the breadboard prints them: a row letter and a column number, like {holeName({ col: 12, row: 'c' })}.</p>
    </div>
  )
}
