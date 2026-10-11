import { Circuit, PARTS, type Diagram, type PartState } from '@blinkproof/sim'
import { useEffect, useMemo, useRef } from 'react'
import { Icon } from '../icons/Icon'
import { STEP_ICON, Status, TOOL_ICON } from '../icons/Status'
import type { BenchState } from '../Workbench'
import { KIND, PART_ICON } from './Sidebar'
import type { FeedItem, Verdict } from './useBuild'

export type Tab = 'design' | 'agent' | 'test' | 'code' | 'serial'

function Section({ title, sub, children, right }: { title: string; sub?: boolean; children?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <section className="border-b border-line px-4 py-3.5">
      <div className={`mb-2.5 flex items-center justify-between text-[12px] font-semibold ${sub ? 'text-dim' : 'text-ink'}`}>
        <span>{title}</span>
        {right}
      </div>
      {children}
    </section>
  )
}

// sketch's inspector field: the label inside on the left in grey, the value on the right in mono
function Field({ label, value, wide }: { label: string; value: React.ReactNode; wide?: boolean }) {
  return (
    <div className={`flex h-6 items-center justify-between rounded-[7px] bg-input px-2 text-[11px] ${wide ? 'col-span-2' : ''}`}>
      <span className="text-dim">{label}</span>
      <span className="truncate pl-2 font-mono text-ink">{value}</span>
    </div>
  )
}

function stateOf(p: PartState | undefined) {
  if (!p) return []
  const out: [string, string][] = []
  if (p.type === 'wokwi-led') out.push(['light', p.lit ? `${Math.round(p.brightness * 100)}%` : 'off'])
  if (p.type === 'wokwi-potentiometer') out.push(['position', `${Math.round(p.position * 100)}%`])
  if (p.type === 'wokwi-pushbutton') out.push(['pressed', p.pressed ? 'yes' : 'no'], ['presses', String(p.presses)])
  if (p.type === 'wokwi-ssd1306') out.push(['screen', !p.oled ? 'not on the bus' : p.oled.on ? 'on' : 'off'])
  if (p.type === 'wokwi-servo') out.push(['angle', p.servo?.pulses ? `${p.servo.angle}°` : 'no pulses'])
  if (p.type === 'wokwi-hc-sr04') out.push(['distance', `${p.distance} cm`], ['pings', String(p.sensor?.pings ?? 0)])
  if (p.type === 'wokwi-buzzer') out.push(['tone', p.buzzer?.hz ? `${p.buzzer.hz} hz` : 'silent'])
  if (p.type === 'wokwi-led-ring' || p.type === 'wokwi-neopixel') out.push(['lit', p.strip ? `${p.strip.pixels.filter((c) => c.some((v) => v > 0)).length} of ${p.strip.pixels.length}` : 'no power'], ['frames', String(p.strip?.frames ?? 0)])
  return out
}

type Props = {
  tab: Tab
  onTab: (t: Tab) => void
  diagram: Diagram | null
  selected: string | null
  bench: BenchState | null
  feed: FeedItem[]
  verdict: Verdict | null
  request: string
  code: string
  test?: string
  testRun: number
}

export function Inspector({ tab, onTab, diagram, selected, bench, feed, verdict, request, code, test, testRun }: Props) {
  const circuit = useMemo(() => (diagram ? Circuit.parse(diagram).circuit : undefined), [diagram])
  const part = selected ? diagram?.parts.find((p) => p.id === selected) : undefined
  const feedEnd = useRef<HTMLDivElement>(null)
  const codeEnd = useRef<HTMLDivElement>(null)
  useEffect(() => {
    feedEnd.current?.scrollIntoView({ block: 'end' })
  }, [feed.length])
  useEffect(() => {
    codeEnd.current?.scrollIntoView({ block: 'end' })
  }, [code])

  const findings = bench?.findings ?? []
  const errors = findings.filter((f) => f.severity === 'error').length
  const warnings = findings.filter((f) => f.severity === 'warning').length

  return (
    <aside className="flex w-[262px] shrink-0 flex-col border-l border-line bg-panel">
      <div className="flex h-[52px] items-center px-3">
        <div className="flex w-full rounded-[8px] bg-input p-0.5">
          {(['design', 'agent', 'test', 'code', 'serial'] as Tab[]).map((t) => (
            <button key={t} onClick={() => onTab(t)} className={`h-6 flex-1 rounded-[6px] text-[11px] capitalize ${tab === t ? 'bg-panel font-semibold text-ink shadow-[0_1px_2px_rgba(0,0,0,.12)]' : 'text-dim hover:text-ink'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto border-t border-line">
        {tab === 'design' && (
          <>
            {part && circuit ? (
              <>
                <Section title={part.id} right={<Icon name={PART_ICON[part.type] ?? 'board'} size={16} className="text-icon" />}>
                  <p className="-mt-1 mb-2.5 text-[11px] text-dim">{KIND[part.type] ?? part.type}</p>
                  <div className="grid grid-cols-2 gap-2.5">
                    <Field label="X" value={Math.round(part.left ?? 0)} />
                    <Field label="Y" value={Math.round(part.top ?? 0)} />
                    {Object.entries(part.attrs ?? {}).map(([k, v]) => (
                      <Field key={k} label={k} value={v} wide={v.length > 6} />
                    ))}
                  </div>
                </Section>
                {stateOf(bench?.parts[part.id]).length > 0 && (
                  <Section title="Live">
                    <div className="grid grid-cols-2 gap-2.5">
                      {stateOf(bench?.parts[part.id]).map(([k, v]) => (
                        <Field key={k} label={k} value={v} wide={v.length > 7} />
                      ))}
                    </div>
                  </Section>
                )}
                <Section title="Pins" sub>
                  <div className="space-y-1">
                    {(PARTS[part.type as keyof typeof PARTS]?.pins as string[] | undefined)?.map((pin) => {
                      const to = circuit.peers(`${part.id}:${pin}`).filter((r) => !r.startsWith(`${part.id}:`))
                      if (!to.length && 'board' in PARTS[part.type as keyof typeof PARTS]) return null
                      return (
                        <div key={pin} className="flex items-center justify-between gap-2 text-[11px]">
                          <span className="font-mono text-ink">{pin}</span>
                          <span className={`truncate font-mono ${to.length ? 'text-dim' : 'text-dim/50'}`}>{to.length ? to.slice(0, 3).join(', ') : 'not wired'}</span>
                        </div>
                      )
                    })}
                  </div>
                </Section>
              </>
            ) : (
              <Section title="Circuit">
                <div className="grid grid-cols-2 gap-2.5">
                  <Field label="board" value={circuit ? KIND[circuit.board.type].replace('arduino ', '').replace('raspberry pi ', '') : '-'} />
                  <Field label="parts" value={diagram ? diagram.parts.length - 1 : 0} />
                  <Field label="wires" value={diagram?.connections.length ?? 0} />
                  <Field label="zoom" value={bench ? `${Math.round(bench.zoom * 100)}%` : '-'} />
                </div>
                {!diagram && <p className="mt-3 text-[11px] leading-4 text-dim">describe a gadget below and the agent builds it here, then has to prove it works</p>}
              </Section>
            )}
            <Section
              title="Wiring checks"
              right={
                <span className="flex items-center gap-1.5 text-[11px] font-normal text-dim">
                  <Status ok={!errors} warn={!errors && warnings > 0} />
                  {errors} errors · {warnings} warnings
                </span>
              }
            >
              {findings.length === 0 && <p className="text-[11px] text-dim">nothing to flag</p>}
              <ul className="space-y-2">
                {findings.map((f, i) => (
                  <li key={i} className="flex gap-2 text-[11px] leading-4">
                    {f.severity === 'info' ? <Icon name="checks" size={16} className="text-icon" /> : <Status ok={false} warn={f.severity === 'warning'} />}
                    <span className={f.severity === 'info' ? 'text-dim' : 'text-ink'}>{f.message}</span>
                  </li>
                ))}
              </ul>
            </Section>
          </>
        )}

        {tab === 'agent' && (
          <div className="px-4 py-3.5">
            {request && <p className="mb-3 rounded-[7px] bg-accent-soft px-3 py-2 text-[12px] leading-[18px] text-ink">{request}</p>}
            {!request && <p className="text-[11px] text-dim">nothing built yet</p>}
            <div className="space-y-2">
              {feed.map((f, i) =>
                f.kind === 'say' ? (
                  <p key={i} className="rise text-[11.5px] leading-[17px] text-dim">{f.text}</p>
                ) : (
                  <div key={i} className="rise flex items-start gap-2 text-[11px] leading-4">
                    <Icon name={TOOL_ICON[f.name] ?? 'build'} size={18} className="text-icon" />
                    <span className="min-w-0 flex-1">
                      <span className="font-mono text-ink">{f.name}</span> <span className={f.ok ? 'text-dim' : 'text-bad'}>{f.note}</span>
                    </span>
                    <Status ok={f.ok} />
                  </div>
                ),
              )}
            </div>
            {verdict && (
              <div className={`rise mt-3 rounded-[10px] border px-3 py-2.5 ${verdict.ok ? 'border-ok/40 bg-ok/10' : 'border-bad/40 bg-bad/10'}`}>
                <div className={`flex items-center gap-1.5 text-[12px] font-semibold ${verdict.ok ? 'text-ok' : 'text-bad'}`}>
                  <Status ok={verdict.ok} size={20} />
                  {verdict.ok ? 'proven, the test passed' : 'not proven'}
                </div>
                <p className="mt-1 text-[11px] leading-4 text-dim">
                  {verdict.turns} turns · {verdict.tokens?.toLocaleString()} tokens
                </p>
                <p className="mt-1.5 text-[11.5px] leading-[17px] text-ink">{verdict.text}</p>
              </div>
            )}
            <div ref={feedEnd} />
          </div>
        )}

        {tab === 'test' && (
          <>
            {testRun > 0 && (
              <Section title="Run" right={bench?.report && <span className="flex items-center gap-1.5 text-[11px] font-normal text-dim"><Status ok={bench.report.ok} />{bench.report.ok ? 'passed' : 'failed'}</span>}>
                <ol className="space-y-1.5">
                  {(bench?.steps ?? []).map((st) => (
                    <li key={st.index} className="rise flex items-start gap-2 text-[11px] leading-4">
                      <Icon name={STEP_ICON[st.kind] ?? 'test'} size={18} className="text-icon" />
                      <span className={`min-w-0 flex-1 ${st.ok ? 'text-ink' : 'text-bad'}`}>
                        {st.name ?? st.kind}
                        <span className="block break-words font-mono text-[10.5px] text-dim">{st.detail}</span>
                      </span>
                      <Status ok={st.ok} />
                    </li>
                  ))}
                  {!bench?.report && <li className="text-[11px] text-dim">running...</li>}
                </ol>
                {bench?.report?.failed && <pre className="mt-2.5 whitespace-pre-wrap rounded-[7px] bg-input px-2.5 py-2 font-mono text-[10px] leading-4 text-dim">{bench.report.failed.bench}</pre>}
              </Section>
            )}
            <Section title="test.yaml" sub>
              {test ? <pre className="whitespace-pre-wrap font-mono text-[10.5px] leading-[17px] text-ink">{test}</pre> : <p className="text-[11px] text-dim">no test yet</p>}
            </Section>
          </>
        )}

        {tab === 'code' && (
          <pre className="px-3 py-3 font-mono text-[10.5px] leading-[17px] text-ink">
            {code ? (
              code.split('\n').map((line, i) => (
                <div key={i} className="flex gap-2.5">
                  <span className="w-5 shrink-0 select-none text-right text-dim/60">{i + 1}</span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              ))
            ) : (
              <span className="text-dim">no sketch yet</span>
            )}
            <div ref={codeEnd} />
          </pre>
        )}

        {tab === 'serial' && <pre className="whitespace-pre-wrap px-4 py-3.5 font-mono text-[11px] leading-[18px] text-ink">{bench?.serial || <span className="text-dim">nothing printed yet</span>}</pre>}
      </div>
      <div className="flex h-8 items-center border-t border-line px-4 font-mono text-[10px] text-dim">
        <span className="truncate">{bench?.status}</span>
      </div>
    </aside>
  )
}
