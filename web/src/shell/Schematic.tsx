import { schematic, type Diagram, type NetKind, type Sheet, type SNet, type Sym } from '@blinkproof/sim'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'
import { Section } from './ui'

// the circuit as a schematic: symbols, power and ground marks, signals joined by their names

const C = {
  sheet: 'var(--sch-sheet)',
  body: 'var(--sch-body)',
  edge: 'var(--sch-edge)',
  wire: 'var(--sch-wire)',
  label: 'var(--sch-label)',
  ink: 'var(--sch-ink)',
  dim: 'var(--sch-dim)',
  pick: 'var(--sch-pick)',
}
// the sheet is drawn on a 10 grid, this is how big that grid is at 100%
const SCALE = 1.85

export function useSheet(diagram: Diagram | null, key: string) {
  const sheet = useMemo(() => (diagram ? schematic(diagram) : null), [diagram])
  const [net, setNet] = useState<string | null>(null)
  const [part, setPart] = useState<string | null>(null)
  useEffect(() => {
    setNet(null)
    setPart(null)
  }, [key])
  return { sheet, net, setNet, part, setPart }
}
export type SheetState = ReturnType<typeof useSheet>

const boardPin = (pin: string) => (/^\d+$/.test(pin) ? `D${pin}` : pin.replace(/\.\d+$/, ''))
// a net said the short way: the board pin and the parts it reaches
export function netSays(n: SNet, board: string) {
  const at = n.pins.filter((p) => p.part === board).map((p) => boardPin(p.pin))
  const parts = [...new Set(n.pins.filter((p) => p.part !== board).map((p) => p.part))]
  if (n.kind === 'signal') return `${at[0]} → ${parts.join(', ')}`
  if (n.kind === 'local') return parts.join(' → ')
  return ''
}

function Mark({ kind }: { kind: NetKind }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" className="shrink-0">
      {kind === 'power' ? (
        <path d="M7 4v8M3 4h8" stroke={C.edge} strokeWidth="1.4" fill="none" />
      ) : kind === 'ground' ? (
        <path d="M7 2v4M2.5 6h9M4.5 8.8h5M6 11.6h2" stroke={C.ink} strokeWidth="1.2" fill="none" />
      ) : (
        <path d="M2 7h10" stroke={C.wire} strokeWidth="1.6" />
      )}
    </svg>
  )
}

function Symbol({ s, top, lit, onPick }: { s: Sym; top?: string; lit: boolean; onPick: (id: string) => void }) {
  const sw = lit ? 1.8 : 1
  const cx = s.x + s.w / 2
  const beside = s.vertical && s.kind !== 'board' && s.kind !== 'box'
  const pick = (e: React.MouseEvent) => (e.stopPropagation(), onPick(s.id))
  let body: React.ReactNode
  if (s.kind === 'led') {
    // the arrow points the way current flows, anode to cathode
    const down = top !== 'C'
    const [a, b] = down ? [s.y + 1, s.y + s.h - 2] : [s.y + s.h - 1, s.y + 2]
    body = (
      <>
        <path d={`M${s.x} ${a}h${s.w}L${cx} ${b}z`} fill={C.body} stroke={C.edge} strokeWidth={sw} strokeLinejoin="round" />
        <path d={`M${s.x} ${b}h${s.w}M${cx} ${s.y}V${a}M${cx} ${b}V${s.y + s.h}`} stroke={C.edge} strokeWidth={sw} />
        <path d={`M${s.x + s.w + 1.5} ${s.y + 3}l4 -3.2M${s.x + s.w + 1.5} ${s.y + 6}l4 -3.2`} stroke={C.edge} strokeWidth=".7" />
        <path d={`M${s.x + s.w + 5.5} ${s.y - 0.2}l-1.6 .2.6 1.3zM${s.x + s.w + 5.5} ${s.y + 2.8}l-1.6 .2.6 1.3z`} fill={C.edge} />
      </>
    )
  } else if (s.kind === 'switch') {
    body = (
      <>
        <rect x={s.x} y={s.y} width={s.w} height={s.h} fill="transparent" />
        <circle cx={cx} cy={s.y + 2.5} r="1.7" fill={C.body} stroke={C.edge} strokeWidth={sw * 0.9} />
        <circle cx={cx} cy={s.y + s.h - 2.5} r="1.7" fill={C.body} stroke={C.edge} strokeWidth={sw * 0.9} />
        <path d={`M${cx + 4} ${s.y + 1}V${s.y + s.h - 1}M${cx + 4} ${s.y + s.h / 2}h4.5`} stroke={C.edge} strokeWidth={sw} />
      </>
    )
  } else if (s.kind === 'buzzer') {
    body = (
      <>
        <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={C.body} stroke={C.edge} strokeWidth={sw} />
        <path d={`M${s.x + 5} ${s.y + 8}h4l5 -4v14l-5 -4h-4z`} fill="none" stroke={C.edge} strokeWidth=".9" strokeLinejoin="round" />
        <text x={s.x + 3} y={s.y + 5.5} fontSize="5.5" fill={C.edge}>+</text>
      </>
    )
  } else {
    body = <rect x={s.x} y={s.y} width={s.w} height={s.h} fill={C.body} stroke={C.edge} strokeWidth={sw} />
  }
  return (
    <g onClick={pick} className="cursor-pointer">
      {body}
      {s.kind === 'resistor' ? (
        s.vertical ? (
          <>
            <text x={s.x + s.w + 4} y={s.y + s.h / 2 - 1} fontSize="6.5" fill={C.edge}>{s.ref}</text>
            <text x={s.x + s.w + 4} y={s.y + s.h / 2 + 6.5} fontSize="6" fill={C.dim}>{s.value}</text>
          </>
        ) : (
          <>
            <text x={cx} y={s.y - 3} fontSize="6.5" fill={C.edge} textAnchor="middle">{s.ref}</text>
            <text x={cx} y={s.y + s.h + 7.5} fontSize="6" fill={C.dim} textAnchor="middle">{s.value}</text>
          </>
        )
      ) : beside ? (
        <>
          <text x={s.x + s.w + (s.kind === 'switch' ? 6 : s.kind === 'led' ? 10 : 8)} y={s.y + s.h / 2 - 0.5} fontSize="6.8" fill={C.edge}>{s.ref}</text>
          <text x={s.x + s.w + (s.kind === 'switch' ? 6 : s.kind === 'led' ? 10 : 8)} y={s.y + s.h / 2 + 7} fontSize="6.2" fill={C.dim}>{s.value}</text>
        </>
      ) : (
        <>
          <text x={s.x} y={s.y - 4} fontSize="6.8" fill={C.edge}>{s.ref}</text>
          <text x={s.x} y={s.y + s.h + 9} fontSize="6.2" fill={C.dim}>{s.value}</text>
        </>
      )}
    </g>
  )
}

function Drawing({ sheet, state, zoom, fill = false }: { sheet: Sheet; state: SheetState; zoom: number; fill?: boolean }) {
  const { net, setNet, part, setPart } = state
  // a picked net stands out and the rest steps back
  const fade = (n: string) => (net && n !== net ? 0.3 : 1)
  const strong = (n: string) => net === n
  const pickNet = (n: string) => (e: React.MouseEvent) => {
    e.stopPropagation()
    setPart(null)
    setNet(net === n ? null : n)
  }
  const topOf = (id: string) => sheet.pins.find((p) => p.part === id && p.side === 'u')?.pin
  return (
    <svg width={fill ? '100%' : sheet.w * SCALE * zoom} height={fill ? undefined : sheet.h * SCALE * zoom} viewBox={`0 0 ${sheet.w} ${sheet.h}`} className="block font-mono" style={{ fontFamily: 'Geist Mono, ui-monospace, monospace' }}>
      {sheet.wires.map((w, i) => (
        <g key={`w${i}`} opacity={fade(w.net)} onClick={pickNet(w.net)} className="cursor-pointer">
          <polyline points={w.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="transparent" strokeWidth="6" />
          <polyline points={w.pts.map((p) => p.join(',')).join(' ')} fill="none" stroke={strong(w.net) ? C.pick : C.wire} strokeWidth={strong(w.net) ? 1.6 : 1} strokeLinejoin="round" strokeLinecap="round" />
        </g>
      ))}
      {sheet.symbols.map((s) => (
        <g key={s.id} opacity={net && !sheet.pins.some((p) => p.part === s.id && p.net === net) && s.kind !== 'resistor' ? 0.55 : 1}>
          <Symbol s={s} top={topOf(s.id)} lit={part === s.id} onPick={(id) => (setNet(null), setPart(part === id ? null : id))} />
        </g>
      ))}
      {sheet.pins.map((p, i) => {
        const [fx, fy] = p.from
        const [tx, ty] = p.to
        return (
          <g key={`p${i}`} opacity={fade(p.net)} onClick={pickNet(p.net)} className="cursor-pointer">
            <line x1={fx} y1={fy} x2={tx} y2={ty} stroke={strong(p.net) ? C.pick : C.edge} strokeWidth={strong(p.net) ? 1.6 : 1} />
            {p.name &&
              (p.side === 'l' ? (
                <text x={fx + 3} y={fy + 2.2} fontSize="6.2" fill={C.ink}>{p.name}</text>
              ) : p.side === 'r' ? (
                <text x={fx - 3} y={fy + 2.2} fontSize="6.2" fill={C.ink} textAnchor="end">{p.name}</text>
              ) : p.side === 'u' ? (
                <text x={fx + 2.1} y={fy + 3} fontSize="6" fill={C.ink} transform={`rotate(90 ${fx + 2.1} ${fy + 3})`}>{p.name}</text>
              ) : (
                <text x={fx - 2.1} y={fy - 3} fontSize="6" fill={C.ink} transform={`rotate(-90 ${fx - 2.1} ${fy - 3})`}>{p.name}</text>
              ))}
            {p.num && p.name &&
              (p.side === 'l' ? (
                <text x={tx + 2} y={ty - 1.6} fontSize="5" fill={C.edge}>{p.num}</text>
              ) : p.side === 'r' ? (
                <text x={fx + 2} y={fy - 1.6} fontSize="5" fill={C.edge}>{p.num}</text>
              ) : (
                <text x={fx + 2} y={p.side === 'u' ? fy - 3 : fy + 7} fontSize="5" fill={C.edge}>{p.num}</text>
              ))}
          </g>
        )
      })}
      {sheet.labels.map((l, i) => (
        <text key={`l${i}`} x={l.at[0]} y={l.at[1] - 2} fontSize="6.5" fill={strong(l.net) ? C.pick : C.label} fontWeight={strong(l.net) ? 600 : 400} textAnchor={l.side === 'r' ? 'start' : 'end'} opacity={fade(l.net)} onClick={pickNet(l.net)} className="cursor-pointer">
          {l.name}
        </text>
      ))}
      {sheet.powers.map((p, i) => (
        <g key={`v${i}`} opacity={fade(p.net)} onClick={pickNet(p.net)} className="cursor-pointer">
          <line x1={p.at[0] - 6} x2={p.at[0] + 6} y1={p.at[1]} y2={p.at[1]} stroke={strong(p.net) ? C.pick : C.edge} strokeWidth={strong(p.net) ? 1.8 : 1.2} />
          <text x={p.at[0]} y={p.at[1] - 4} fontSize="6.5" fill={strong(p.net) ? C.pick : C.edge} textAnchor="middle" fontWeight={strong(p.net) ? 600 : 400}>
            {p.name}
          </text>
        </g>
      ))}
      {sheet.grounds.map((g, i) => {
        const [x, y] = g.at
        const c = strong(g.net) ? C.pick : C.ink
        return (
          <g key={`g${i}`} opacity={fade(g.net)} onClick={pickNet(g.net)} className="cursor-pointer">
            <rect x={x - 7} y={y - 1} width="14" height="8" fill="transparent" />
            <path d={`M${x - 6} ${y}h12M${x - 4} ${y + 2.5}h8M${x - 2} ${y + 5}h4`} stroke={c} strokeWidth={strong(g.net) ? 1.5 : 1} />
          </g>
        )
      })}
    </svg>
  )
}

export function SchematicView({ state, title }: { state: SheetState; title: string }) {
  const { sheet, setNet, setPart } = state
  // null is fit: as big as it goes up to 100%, so the whole sheet is in view
  const [zoom, setZoom] = useState<number | null>(null)
  const box = useRef<HTMLDivElement>(null)
  const [room, setRoom] = useState<[number, number]>([0, 0])
  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(() => setRoom([el.clientWidth, el.clientHeight]))
    ro.observe(el)
    return () => ro.disconnect()
  }, [!!sheet])
  if (!sheet) return <div className="flex h-full items-center justify-center text-[12px] text-dim">There is no board in this circuit yet, add one to draw its schematic.</div>
  const parts = sheet.symbols.filter((s) => s.kind !== 'board').length
  const fit = room[0] ? Math.max(0.4, Math.min(1, (room[0] - 80) / (sheet.w * SCALE), (room[1] - 150) / (sheet.h * SCALE))) : 1
  const z = zoom ?? fit
  const step = (d: number) => setZoom(Math.min(2.4, Math.max(0.4, +(z + d).toFixed(1))))
  return (
    <div className="relative h-full" style={{ background: C.sheet }}>
      <div ref={box} className="h-full overflow-auto" onClick={() => (setNet(null), setPart(null))}>
        <div className="flex min-h-full min-w-fit items-center justify-center px-10 pb-24 pt-20">
          <Drawing sheet={sheet} state={state} zoom={z} />
        </div>
      </div>
      <div className="pill pointer-events-none absolute bottom-3 left-3 flex h-9 items-center gap-2 px-3 text-[12px] max-md:hidden">
        <span className="max-w-[220px] truncate font-medium text-ink">{title}</span>
        <span className="font-mono text-[11px] text-dim">
          {parts} {parts === 1 ? 'part' : 'parts'}
        </span>
      </div>
      <div className="pointer-events-none absolute inset-x-0 bottom-3 flex justify-center">
        <div className="pill pointer-events-auto flex h-9 items-center gap-1 px-1.5 font-mono text-[11px] text-dim">
          <span className="px-2 text-ink">{sheet.nets.length} nets</span>
          <span className="mx-1 h-4 w-px bg-sep" />
          <button onClick={() => step(-0.2)} title="zoom out" className="flex h-7 w-7 items-center justify-center rounded-full text-icon hover:bg-hover">
            <Icon name="minus" size={12} />
          </button>
          <button onClick={() => setZoom(zoom === null ? 1 : null)} title={zoom === null ? 'show at 100%' : 'fit the sheet'} className="w-10 text-center text-ink">
            {Math.round(z * 100)}%
          </button>
          <button onClick={() => step(0.2)} title="zoom in" className="flex h-7 w-7 items-center justify-center rounded-full text-icon hover:bg-hover">
            <Icon name="plus" size={12} />
          </button>
        </div>
      </div>
    </div>
  )
}

// the drawer beside it: every net, and what the picked net or part joins
export function NetsPanel({ state }: { state: SheetState }) {
  const { sheet, net, setNet, part, setPart } = state
  if (!sheet) return <p className="px-4 text-[12px] text-dim">Add a board to the circuit and its schematic shows here.</p>
  const board = sheet.symbols.find((s) => s.kind === 'board')!.id
  const picked = sheet.nets.find((n) => n.id === net)
  const sym = sheet.symbols.find((s) => s.id === part)
  const nameOf = (id: string) => sheet.nets.find((n) => n.id === id)?.name
  const pinsOf = sym && sheet.pins.filter((p) => p.part === sym.id)
  const say = (part: string, pin: string) => (part === board ? boardPin(pin) : pin.replace(/\.l$/, ''))
  return (
    <div className="h-full overflow-auto pb-6">
      <Section title="Nets" first right={<span className="text-[11px] text-dim">{sheet.nets.length}</span>}>
        <div className="-mx-1.5">
          {sheet.nets.map((n) => {
            const on = n.id === net
            const says = netSays(n, board)
            return (
              <button key={n.id} onClick={() => (setPart(null), setNet(on ? null : n.id))} className={`flex h-[26px] w-full items-center gap-2 rounded-[7px] px-1.5 text-left text-[11.5px] ${on ? 'chip text-ink' : 'text-ink hover:bg-hover'}`}>
                <Mark kind={n.kind} />
                <span className="min-w-0 flex-1 truncate">
                  {n.name}
                  {says && <span className="text-dim"> {says}</span>}
                </span>
                <span className="font-mono text-[10.5px] text-dim">
                  {n.pins.length} {n.pins.length === 1 ? 'pin' : 'pins'}
                </span>
              </button>
            )
          })}
        </div>
      </Section>
      {picked && (
        <Section title={picked.name} right={<span className="text-[11px] text-dim">{picked.kind === 'local' ? 'between parts' : picked.kind}</span>}>
          <div className="grid grid-cols-[1fr_auto] gap-y-2 text-[11.5px]">
            {picked.pins.map((p, i) => (
              <div key={i} className="contents">
                <button onClick={() => (setNet(null), setPart(p.part))} className="truncate text-left text-ink hover:underline">
                  {p.part}
                </button>
                <span className="rounded-[5px] bg-frame px-[5px] py-px font-mono text-[10.5px] text-ink shadow-[inset_0_0_0_1px_var(--divider)]">{say(p.part, p.pin)}</span>
              </div>
            ))}
          </div>
        </Section>
      )}
      {sym && pinsOf && (
        <Section title={sym.id} right={<span className="text-[11px] text-dim">{sym.ref} · {sym.value}</span>}>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-[11.5px]">
            {pinsOf.length ? (
              pinsOf.map((p, i) => (
                <div key={i} className="contents">
                  <span className="rounded-[5px] bg-frame px-[5px] py-px font-mono text-[10.5px] text-ink shadow-[inset_0_0_0_1px_var(--divider)]">{say(p.part, p.pin)}</span>
                  <button onClick={() => (setPart(null), setNet(p.net))} className="truncate text-left text-ink hover:underline">
                    {nameOf(p.net)}
                  </button>
                </div>
              ))
            ) : (
              <span className="col-span-2 text-dim">Drawn in line on the wire it sits on.</span>
            )}
          </div>
        </Section>
      )}
    </div>
  )
}

// the small version for onboarding: the whole sheet fitted to the panel, its nets as chips under it
export function SheetCard({ diagram, title }: { diagram: Diagram; title: string }) {
  const state = useSheet(diagram, 'onboard')
  const { sheet, net, setNet, setPart } = state
  if (!sheet) return <p className="text-[12px] text-dim">There is no board in this circuit yet.</p>
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between text-[12px] font-semibold text-ink">
        <span className="truncate">{title}</span>
        <span className="text-[11px] font-normal text-dim">{sheet.nets.length} nets</span>
      </div>
      <div className="rounded-[10px] p-2.5 shadow-[inset_0_0_0_1px_var(--divider)]" style={{ background: C.sheet }} onClick={() => (setNet(null), setPart(null))}>
        <Drawing sheet={sheet} state={state} zoom={1} fill />
      </div>
      <div className="mt-2.5 flex flex-wrap gap-1">
        {sheet.nets.map((n) => {
          const at = n.kind === 'signal' ? netSays(n, sheet.symbols.find((s) => s.kind === 'board')!.id).split(' ')[0] : `${n.pins.length} pins`
          return (
            <button key={n.id} onClick={() => (setPart(null), setNet(net === n.id ? null : n.id))} className={`inline-flex h-[22px] items-center gap-[5px] rounded-[6px] px-2 text-[10.5px] text-ink shadow-[inset_0_0_0_1px_var(--divider)] ${net === n.id ? 'bg-input' : 'bg-frame hover:bg-hover'}`}>
              {n.name}
              <span className="text-dim">{at}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
