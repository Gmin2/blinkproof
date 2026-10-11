import { Circuit, PARTS, type Diagram, type PartState } from '@blinkproof/sim'
import { useEffect, useMemo, useRef } from 'react'
import { Icon, type IconName } from '../icons/Icon'
import { STEP_ICON, Status, TOOL_ICON } from '../icons/Status'
import type { BenchState } from '../Workbench'
import { HeaderButton, KIND } from './Sidebar'
import type { FeedItem, Verdict } from './useBuild'

export type Mode = 'design' | 'code' | 'serial' | 'test' | 'agent'

const TABS: { mode: Mode; label: string; icon: IconName }[] = [
  { mode: 'design', label: 'Design', icon: 'frame' },
  { mode: 'code', label: 'Code', icon: 'code' },
  { mode: 'serial', label: 'Serial', icon: 'terminal' },
  { mode: 'test', label: 'Test', icon: 'flask' },
  { mode: 'agent', label: 'Agent', icon: 'prototype' },
]

// the colours a part comes in, and what to paint the dot
const COLORS: Record<string, string[]> = {
  'wokwi-led': ['red', 'green', 'blue', 'yellow', 'orange', 'white', 'purple'],
  'wokwi-pushbutton': ['red', 'green', 'blue', 'yellow', 'black', 'white'],
}
const SWATCH: Record<string, string> = {
  red: '#ef4444',
  green: '#22c55e',
  blue: '#3b82f6',
  yellow: '#eab308',
  orange: '#f97316',
  white: '#f5f5f5',
  purple: '#a855f7',
  black: '#171717',
}

// what a wire can be, red for power, grey for ground, the rest for signals
const WIRE_COLORS = ['#ef4444', '#94a3b8', '#141414', '#22c55e', '#f59e0b', '#38bdf8', '#a78bfa', '#eab308', '#ec4899']

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

// a section: main ones in near black, the secondary level in grey, actions on the right
function Section({ title, sub, children, right, first }: { title: React.ReactNode; sub?: boolean; children?: React.ReactNode; right?: React.ReactNode; first?: boolean }) {
  return (
    <section className={`px-4 ${first ? 'pt-1' : 'pt-5'}`}>
      <div className={`flex h-6 items-center justify-between text-[12px] font-semibold ${sub ? 'text-dim' : 'text-ink'}`}>
        <span className="flex items-center gap-1">{title}</span>
        <span className="flex items-center gap-1.5 font-normal">{right}</span>
      </div>
      {children && <div className="mt-2">{children}</div>}
    </section>
  )
}

function Sep() {
  return <div className="mx-4 mt-5 border-t border-sep" />
}

// a field: grey label or icon inside on the left, the value in mono
function Field({ label, icon, value, wide, menu }: { label?: string; icon?: IconName; value: React.ReactNode; wide?: boolean; menu?: boolean }) {
  return (
    <div className={`flex h-6 min-w-0 items-center gap-2 rounded-[7px] bg-input px-2 text-[11px] ${wide ? 'col-span-2' : ''}`}>
      {icon ? <Icon name={icon} size={13} className="text-icon-2" /> : <span className="text-dim">{label}</span>}
      <span className={`min-w-0 flex-1 truncate text-ink ${menu ? 'text-left' : 'text-right font-mono'}`}>{value}</span>
      {menu && <Icon name="chevron-expand-y" size={11} className="text-icon-2" />}
    </div>
  )
}

function Switch({ on, label }: { on: boolean; label: string }) {
  return (
    <div className="flex h-6 items-center gap-2 text-[12px] text-ink">
      <span className={`relative h-3 w-[22px] rounded-full transition-colors ${on ? 'bg-accent' : 'bg-switch'}`}>
        <span className={`absolute top-[1px] h-2.5 w-2.5 rounded-full bg-panel shadow transition-all ${on ? 'left-[11px]' : 'left-[1px]'}`} />
      </span>
      {label}
    </div>
  )
}

function live(p: PartState | undefined) {
  const fields: [string, string][] = []
  const switches: [string, boolean][] = []
  if (!p) return { fields, switches }
  if (p.type === 'wokwi-led') (switches.push(['Lit', p.lit]), fields.push(['brightness', `${Math.round(p.brightness * 100)}%`]))
  if (p.type === 'wokwi-potentiometer') fields.push(['position', `${Math.round(p.position * 100)}%`])
  if (p.type === 'wokwi-pushbutton') (switches.push(['Pressed', p.pressed]), fields.push(['presses', String(p.presses)]))
  if (p.type === 'wokwi-ssd1306') switches.push([!p.oled ? 'Not on the bus' : 'Screen on', !!p.oled?.on])
  if (p.type === 'wokwi-servo') fields.push(['angle', p.servo?.pulses ? `${p.servo.angle}°` : 'none'])
  if (p.type === 'wokwi-hc-sr04') fields.push(['cm', String(p.distance)], ['pings', String(p.sensor?.pings ?? 0)])
  if (p.type === 'wokwi-buzzer') (switches.push(['Sounding', !!p.buzzer?.hz]), fields.push(['hz', p.buzzer?.hz ? String(p.buzzer.hz) : '0']))
  if (p.type === 'wokwi-led-ring' || p.type === 'wokwi-neopixel')
    fields.push(['lit', p.strip ? `${p.strip.pixels.filter((c) => c.some((v) => v > 0)).length}/${p.strip.pixels.length}` : '0'], ['frames', String(p.strip?.frames ?? 0)])
  return { fields, switches }
}

type Props = {
  mode: Mode
  onMode: (m: Mode) => void
  diagram: Diagram | null
  selected: string | null
  bench: BenchState | null
  feed: FeedItem[]
  verdict: Verdict | null
  request: string
  test?: string
  testRun: number
  onRunTest: () => void
  model: string
  models: { id: string; provider: string; label: string }[]
  onModel: (id: string) => void
  onShare: () => void
  onDownload: () => void
  canShare: boolean
  forkOf?: { id: string; title: string }
  onOpen: (id: string) => void
  wire?: Diagram['connections'][number]
  onRecolorWire: (color: string) => void
  onRemoveWire: () => void
  editable: boolean
  onRemovePart: (id: string) => void
  onSetAttr: (id: string, key: string, value: string) => void
  // the code and serial tabs are made by the page, they need its state
  code: React.ReactNode
  serial: React.ReactNode
}

export function Inspector({
  mode,
  onMode,
  diagram,
  selected,
  bench,
  feed,
  verdict,
  request,
  test,
  testRun,
  onRunTest,
  model,
  models,
  onModel,
  onShare,
  onDownload,
  canShare,
  forkOf,
  onOpen,
  wire,
  onRecolorWire,
  onRemoveWire,
  editable,
  onRemovePart,
  onSetAttr,
  code,
  serial,
}: Props) {
  const circuit = useMemo(() => (diagram ? Circuit.parse(diagram).circuit : undefined), [diagram])
  const part = selected ? diagram?.parts.find((p) => p.id === selected) : undefined
  const feedEnd = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // scroll the agent panel only: scrollIntoView would also slide the tab track sideways
    const panel = feedEnd.current?.closest<HTMLElement>('[data-panel]')
    if (panel) panel.scrollTop = panel.scrollHeight
  }, [feed.length, verdict])

  const findings = bench?.findings ?? []
  const errors = findings.filter((f) => f.severity === 'error').length
  const warnings = findings.filter((f) => f.severity === 'warning').length
  const state = live(part && bench?.parts[part.id])
  const current = models.find((m) => m.id === model)
  const index = TABS.findIndex((t) => t.mode === mode)
  const pins = part ? ((PARTS[part.type as keyof typeof PARTS]?.pins as string[] | undefined) ?? []) : []
  const peers = (pin: string) => (circuit && part ? circuit.peers(`${part.id}:${pin}`).filter((r) => !r.startsWith(`${part.id}:`)) : [])

  return (
    <aside className={`flex shrink-0 flex-col border-l border-line bg-panel transition-[width] duration-300 ease-out ${mode === 'code' ? 'w-[440px]' : 'w-[300px]'}`}>
      <div className="flex h-[52px] shrink-0 items-center gap-2 px-2.5">
        <div className="flex-1" />
        {/* who builds it */}
        <label className="relative flex h-9 items-center gap-1.5 text-[12px] font-medium text-ink" title="model">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-on-accent">{(current?.label ?? model).charAt(0).toUpperCase()}</span>
          <span className="max-w-[78px] truncate">{(current?.label ?? model).split(' ').slice(-2).join(' ')}</span>
          <select value={model} onChange={(e) => onModel(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
            {['litellm', 'anthropic', 'openai'].map((p) => {
              const group = models.filter((m) => m.provider === p)
              return group.length ? (
                <optgroup key={p} label={p === 'litellm' ? 'neatHack credits' : p}>
                  {group.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </optgroup>
              ) : null
            })}
          </select>
        </label>
        <button title="download the circuit, sketch and test" onClick={onDownload} disabled={!diagram} className="pill flex h-9 w-9 items-center justify-center text-icon disabled:opacity-40">
          <Icon name="export" size={18} />
        </button>
        <button title="copy the link to this build" onClick={onShare} disabled={!canShare} className="pill flex h-9 w-9 items-center justify-center text-icon disabled:opacity-40">
          <Icon name="link" size={18} />
        </button>
      </div>

      {/* the tabs: the chip slides to the one picked, and the panels slide along with it */}
      <div className="px-2.5 pb-2">
        <div className="relative grid grid-cols-5 rounded-[9px] bg-input p-0.5">
          <span
            className="absolute inset-y-0.5 left-0.5 rounded-[7px] bg-panel shadow-[0_1px_2px_rgba(0,0,0,.08),0_0_0_0.5px_rgba(0,0,0,.06)] transition-transform duration-300 ease-out"
            style={{
              width: 'calc((100% - 4px) / 5)',
              transform: `translateX(${index * 100}%)`,
            }}
          />
          {TABS.map((t) => (
            <button
              key={t.mode}
              onClick={() => onMode(t.mode)}
              title={t.label}
              className={`relative z-10 flex h-7 items-center justify-center gap-1 text-[11px] font-medium transition-colors ${mode === t.mode ? 'text-ink' : 'text-dim hover:text-ink'}`}
            >
              <Icon name={t.icon} size={13} />
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden border-t border-sep">
        <div className="flex h-full transition-transform duration-300 ease-out" style={{ transform: `translateX(${-index * 100}%)` }}>
          <div className="h-full w-full shrink-0 overflow-auto pb-6 pt-3" aria-hidden={mode !== 'design'}>
            {wire && (
              <>
                <Section first title="Wire" right={<HeaderButton icon="trash" title="remove the wire, delete" onClick={onRemoveWire} />}>
                  <div className="space-y-1.5">
                    {[wire[0], wire[1]].map((end, i) => (
                      <div key={i} className="flex h-6 items-center gap-2 rounded-[7px] bg-input px-2 text-[11px]">
                        <span className="text-dim">{i ? 'To' : 'From'}</span>
                        <span className="min-w-0 flex-1 truncate text-right font-mono text-ink">{end}</span>
                      </div>
                    ))}
                  </div>
                </Section>
                <Section title="Colour" sub>
                  <div className="flex flex-wrap gap-2">
                    {WIRE_COLORS.map((c) => (
                      <button
                        key={c}
                        title={c}
                        onClick={() => onRecolorWire(c)}
                        className={`h-6 w-6 rounded-full ring-offset-2 ring-offset-panel ${wire[2] === c ? 'ring-2 ring-accent' : ''}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </Section>
              </>
            )}
            {!wire &&
              (part && circuit ? (
                <>
                  <Section
                    first
                    title={
                      <>
                        {cap(KIND[part.type] ?? part.type)}
                        <Icon name="chevron-expand-y" size={11} />
                      </>
                    }
                    right={
                      <>
                        <span className="font-mono text-[11px] text-dim">{part.id}</span>
                        {editable && !('board' in (PARTS[part.type as keyof typeof PARTS] ?? {})) && (
                          <HeaderButton icon="trash" title="remove the part and its wires, delete" onClick={() => onRemovePart(part.id)} />
                        )}
                      </>
                    }
                  >
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field label="X" value={Math.round(part.left ?? 0)} />
                      <Field label="Y" value={Math.round(part.top ?? 0)} />
                      <Field icon="rotation-360" value={`${part.rotate ?? 0}°`} />
                      <Field icon="wire" value={pins.filter((pin) => peers(pin).length).length} />
                    </div>
                  </Section>
                  {Object.keys(part.attrs ?? {}).length > 0 && (
                    <>
                      <Sep />
                      <Section title="Attributes">
                        <div className="grid grid-cols-2 gap-2.5">
                          {Object.entries(part.attrs ?? {}).map(([k, v]) =>
                            editable && k === 'color' && COLORS[part.type] ? (
                              <label key={k} className="relative col-span-2 flex h-6 items-center gap-2 rounded-[7px] bg-input px-2 text-[11px]">
                                <span className="text-dim">{k}</span>
                                <span className="h-3 w-3 rounded-full ring-1 ring-black/10" style={{ background: SWATCH[v] ?? v }} />
                                <span className="flex-1 text-ink">{v}</span>
                                <Icon name="chevron-expand-y" size={11} className="text-icon-2" />
                                <select value={v} onChange={(e) => onSetAttr(part.id, k, e.target.value)} className="absolute inset-0 cursor-pointer opacity-0">
                                  {COLORS[part.type].map((c) => (
                                    <option key={c}>{c}</option>
                                  ))}
                                </select>
                              </label>
                            ) : editable && ['value', 'pixels'].includes(k) ? (
                              <label key={k} className="flex h-6 min-w-0 items-center gap-2 rounded-[7px] bg-input px-2 text-[11px]">
                                <span className="text-dim">{k}</span>
                                <input
                                  defaultValue={v}
                                  key={`${part.id}-${v}`}
                                  onBlur={(e) => e.target.value.trim() && e.target.value !== v && onSetAttr(part.id, k, e.target.value.trim())}
                                  onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                                  className="min-w-0 flex-1 bg-transparent text-right font-mono text-ink outline-none"
                                />
                              </label>
                            ) : (
                              <Field key={k} label={k} value={v} wide={v.length > 6} menu={k === 'color'} />
                            ),
                          )}
                        </div>
                      </Section>
                    </>
                  )}
                  {(state.fields.length > 0 || state.switches.length > 0) && (
                    <Section title="Live" sub>
                      <div className="grid grid-cols-2 gap-2.5">
                        {state.fields.map(([k, v]) => (
                          <Field key={k} label={k} value={v} />
                        ))}
                      </div>
                      {state.switches.map(([k, on]) => (
                        <div key={k} className="mt-1.5">
                          <Switch on={on} label={k} />
                        </div>
                      ))}
                    </Section>
                  )}
                  <Sep />
                  <Section title="Pins" sub>
                    <div className="space-y-1.5">
                      {pins.map((pin) => {
                        const to = peers(pin)
                        if (!to.length && 'board' in PARTS[part.type as keyof typeof PARTS]) return null
                        return (
                          <div key={pin} className="flex h-6 items-center justify-between gap-2 rounded-[7px] bg-input px-2 text-[11px]">
                            <span className="font-mono text-ink">{pin}</span>
                            <span className={`truncate font-mono ${to.length ? 'text-dim' : 'text-dim/50'}`}>{to.length ? to.slice(0, 2).join(', ') : 'not wired'}</span>
                          </div>
                        )
                      })}
                    </div>
                  </Section>
                </>
              ) : (
                <>
                  <Section
                    first
                    title={
                      <>
                        Circuit
                        <Icon name="chevron-expand-y" size={11} />
                      </>
                    }
                  >
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field icon="chip" value={circuit ? cap(KIND[circuit.board.type].replace('arduino ', '').replace('raspberry pi ', '')) : 'No board'} wide menu />
                      <Field icon="box" value={diagram ? diagram.parts.length - 1 : 0} />
                      <Field icon="wire" value={diagram?.connections.length ?? 0} />
                      <Field icon="magnifier" value={bench && diagram ? `${Math.round(bench.zoom * 100)}%` : '-'} />
                      <Field icon="stopwatch" value={bench?.build && diagram ? `${(bench.simMs / 1000).toFixed(1)}s` : '-'} />
                    </div>
                    {forkOf && (
                      <button onClick={() => onOpen(forkOf.id)} className="mt-2.5 flex w-full items-center gap-2 rounded-[7px] bg-input px-2 py-1.5 text-left text-[11px] text-dim hover:text-ink">
                        <Icon name="nodes" size={13} className="text-icon-2" />
                        <span className="min-w-0 flex-1 truncate">
                          Edited from <span className="font-medium text-ink">{forkOf.title}</span>
                        </span>
                        <Icon name="chevron-right" size={11} />
                      </button>
                    )}
                    {!diagram && <p className="mt-3 text-[11px] leading-4 text-dim">Describe a gadget and the agent builds it on the canvas, then has to pass a test before it hands it over.</p>}
                  </Section>
                  <Sep />
                  <Section
                    title="Wiring Checks"
                    right={
                      <span className="flex items-center gap-1.5 text-[11px] text-dim">
                        {errors} errors · {warnings} warnings
                        <Status ok={!errors} warn={!errors && warnings > 0} size={14} />
                      </span>
                    }
                  >
                    {findings.length === 0 ? (
                      <p className="text-[11px] text-dim">Nothing to flag</p>
                    ) : (
                      <ul className="space-y-2">
                        {findings.map((f, i) => (
                          <li key={i} className="flex gap-2 text-[11px] leading-4">
                            {f.severity === 'info' ? <Icon name="circle-info" size={14} className="text-icon-2" /> : <Status ok={false} warn={f.severity === 'warning'} size={14} />}
                            <span className={f.severity === 'info' ? 'text-dim' : 'text-ink'}>{f.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Section>
                  <Section title="Test" sub right={<HeaderButton icon="chevron-right" title="open the test" onClick={() => onMode('test')} />} />
                  <Section title="Agent" sub right={<HeaderButton icon="chevron-right" title="open the agent" onClick={() => onMode('agent')} />} />
                </>
              ))}
          </div>

          <div className="flex h-full w-full shrink-0 flex-col pt-3" aria-hidden={mode !== 'code'}>
            {code}
          </div>

          <div className="h-full w-full shrink-0 pt-3" aria-hidden={mode !== 'serial'}>
            {serial}
          </div>

          <div className="h-full w-full shrink-0 overflow-auto pb-6 pt-3" aria-hidden={mode !== 'test'}>
            <>
              <Section
                first
                title="Test"
                right={
                  <>
                    {bench?.report && (
                      <span className="flex items-center gap-1.5 text-[11px] text-dim">
                        {bench.report.ok ? 'passed' : 'failed'}
                        <Status ok={bench.report.ok} size={14} />
                      </span>
                    )}
                    <HeaderButton icon="play" title="run the test" onClick={onRunTest} />
                  </>
                }
              >
                {testRun === 0 && <p className="text-[11px] text-dim">{test ? 'Press play to run it on a fresh bench.' : 'No test yet.'}</p>}
                {testRun > 0 && (
                  <ol className="space-y-px">
                    {(bench?.steps ?? []).map((st) => (
                      <li key={st.index} className="rise flex items-start gap-2 rounded-[6px] px-1 py-1 text-[11px] leading-4 hover:bg-hover">
                        <Icon name={STEP_ICON[st.kind] ?? 'flask'} size={16} className="text-icon-2" />
                        <span className={`min-w-0 flex-1 ${st.ok ? 'text-ink' : 'text-bad'}`}>
                          {st.name ?? st.kind}
                          <span className="block break-words font-mono text-[10.5px] text-dim">{st.detail}</span>
                        </span>
                        <Status ok={st.ok} size={14} />
                      </li>
                    ))}
                    {!bench?.report && <li className="px-1 text-[11px] text-dim">Running...</li>}
                  </ol>
                )}
                {bench?.report?.failed && <pre className="mt-2.5 whitespace-pre-wrap rounded-[7px] bg-input px-2.5 py-2 font-mono text-[10px] leading-4 text-dim">{bench.report.failed.bench}</pre>}
              </Section>
              <Sep />
              <Section title="test.yaml" sub>
                {test ? (
                  <pre className="whitespace-pre-wrap rounded-[7px] bg-input px-2.5 py-2 font-mono text-[10.5px] leading-[17px] text-ink">{test}</pre>
                ) : (
                  <p className="text-[11px] text-dim">No test yet</p>
                )}
              </Section>
            </>
          </div>

          <div className="h-full w-full shrink-0 overflow-auto pb-6 pt-3" data-panel aria-hidden={mode !== 'agent'}>
            <>
              <Section first title="Agent" right={verdict && <Status ok={verdict.ok} size={14} />}>
                {request ? <p className="rounded-[7px] bg-input px-2.5 py-2 text-[12px] leading-[18px] text-ink">{request}</p> : <p className="text-[11px] text-dim">Nothing built yet</p>}
              </Section>
              {feed.length > 0 && (
                <Section title="Steps" sub>
                  <div className="space-y-px">
                    {feed.map((f, i) =>
                      f.kind === 'say' ? (
                        <p key={i} className="rise px-1 py-1 text-[11.5px] leading-[17px] text-dim">
                          {f.text}
                        </p>
                      ) : (
                        <div key={i} className="rise flex items-start gap-2 rounded-[6px] px-1 py-1 text-[11px] leading-4 hover:bg-hover">
                          <Icon name={TOOL_ICON[f.name] ?? 'box'} size={16} className="text-icon-2" />
                          <span className="min-w-0 flex-1">
                            <span className="font-mono text-ink">{f.name}</span> <span className={f.ok ? 'text-dim' : 'text-bad'}>{f.note}</span>
                          </span>
                          <Status ok={f.ok} size={14} />
                        </div>
                      ),
                    )}
                  </div>
                </Section>
              )}
              {verdict && (
                <>
                  <Sep />
                  <Section title={verdict.ok ? 'Proven' : 'Not Proven'} right={<span className="font-mono text-[11px] text-dim">{verdict.turns} turns</span>}>
                    <div className="grid grid-cols-2 gap-2.5">
                      <Field icon="bolt" value={`${verdict.tokens?.toLocaleString() ?? '-'} tokens`} wide />
                    </div>
                    <p className="mt-2.5 text-[12px] leading-[18px] text-ink">{verdict.text}</p>
                  </Section>
                </>
              )}
              <div ref={feedEnd} />
            </>
          </div>
        </div>
      </div>
    </aside>
  )
}
