import type { Diagram } from '@blinkproof/sim'
import { useEffect, useRef, useState } from 'react'
import { Checks, Heading, Serial, TestSteps } from './panels'
import { Workbench, type BenchState } from './Workbench'

type AgentEvent =
  | { type: 'start'; request: string; model: string; version: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; name: string; args: any; result: Record<string, any>; ms: number }
  | { type: 'done'; ok: boolean; turns: number; summary?: string; reason?: string; tokens: number }
  | { type: 'result'; passed: boolean }
  | { type: 'error'; message: string }

type FeedItem = { kind: 'say'; text: string } | { kind: 'tool'; name: string; ok: boolean; note: string }

const IDEAS = [
  'a parking sensor for my garage: an ultrasonic sensor measures the car, a 16 led ring fills up green to red as it gets closer, a buzzer beeps faster when close, and an oled shows the distance and says STOP under 10 cm',
  'a night light: an led that lights while you hold a button down',
  'a reaction game: an led lights after a random wait, press the button as fast as you can, the oled shows your time in ms',
  'a door chime: when the ultrasonic sensor sees someone closer than 50 cm the buzzer plays two notes and the ring flashes blue',
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

// one line saying what a tool came back with
function note(name: string, r: Record<string, any>) {
  if (r.refused) return r.refused
  if (r.errors) return String(r.errors[0]?.message ?? r.errors[0])
  if (r.compile_errors) return `line ${r.compile_errors[0]?.line}: ${r.compile_errors[0]?.message}`
  if (name === 'list_parts') return `${r.parts?.length} parts to pick from`
  if (name === 'write_circuit') return `${r.parts} parts, ${r.wires} wires${r.findings?.length ? `, ${r.findings.length} findings` : ''}`
  if (name === 'write_sketch') return `${r.lines} lines`
  if (name === 'write_test') return `${r.steps} steps`
  if (name === 'compile') return `${r.flash}, ram ${r.ram}`
  if (name === 'run_test') return r.ok ? `all ${r.steps?.length} steps pass` : String(r.steps?.find((s: string) => s.startsWith('FAIL')) ?? 'failed')
  if (name === 'finish') return 'handed over'
  return ''
}

export function BuildView({ sound }: { sound: boolean }) {
  const [request, setRequest] = useState(IDEAS[0])
  const [busy, setBusy] = useState(false)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [diagram, setDiagram] = useState<Diagram | null>(null)
  const [source, setSource] = useState<string>()
  const [code, setCode] = useState('')
  const [test, setTest] = useState<string>()
  const [testRun, setTestRun] = useState(0)
  const [tab, setTab] = useState<'code' | 'test' | 'serial'>('code')
  const [bench, setBench] = useState<BenchState | null>(null)
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string; turns?: number; tokens?: number } | null>(null)
  const [canReplay, setCanReplay] = useState(false)
  const feedEnd = useRef<HTMLDivElement>(null)
  const codeEnd = useRef<HTMLDivElement>(null)
  const reportWaiter = useRef<(() => void) | null>(null)

  useEffect(() => {
    try {
      setCanReplay(!!localStorage.getItem('blinkproof:last-build'))
    } catch {}
  }, [])

  useEffect(() => feedEnd.current?.scrollIntoView({ block: 'end' }), [feed])

  const onState = (s: BenchState) => {
    setBench(s)
    if (s.report && reportWaiter.current) {
      reportWaiter.current()
      reportWaiter.current = null
    }
  }

  const say = (item: FeedItem) => setFeed((f) => [...f, item])

  // shows one agent step, at a pace a person can follow
  async function show(e: AgentEvent) {
    if (e.type === 'start') say({ kind: 'say', text: `building with ${e.model}, prompt ${e.version}` })
    if (e.type === 'thinking') {
      say({ kind: 'say', text: e.text })
      await sleep(350)
    }
    if (e.type === 'tool') {
      const ok = e.result.ok !== false
      if (e.name === 'write_circuit' && e.args?.diagram && !e.result.errors) {
        setDiagram(e.args.diagram)
        say({ kind: 'tool', name: e.name, ok, note: note(e.name, e.result) })
        const d = e.args.diagram as Diagram
        await sleep(d.parts.length * 150 + d.connections.length * 80 + 900)
        return
      }
      if (e.name === 'write_sketch' && typeof e.args?.code === 'string') {
        const text: string = e.args.code
        setTab('code')
        setSource(text)
        say({ kind: 'tool', name: e.name, ok, note: note(e.name, e.result) })
        const total = Math.min(2600, text.length * 1.5)
        const start = performance.now()
        for (;;) {
          const t = Math.min(1, (performance.now() - start) / total)
          setCode(text.slice(0, Math.round(text.length * t)))
          if (t >= 1) break
          await sleep(16)
        }
        return
      }
      if (e.name === 'write_test' && typeof e.args?.yaml === 'string' && ok) {
        setTest(e.args.yaml)
        setTab('test')
      }
      say({ kind: 'tool', name: e.name, ok, note: note(e.name, e.result) })
      if (e.name === 'run_test' && Array.isArray(e.result.steps)) {
        setTab('test')
        setTestRun((n) => n + 1)
        // let the canvas play the same test the agent just ran
        await Promise.race([new Promise<void>((r) => (reportWaiter.current = r)), sleep(20_000)])
        await sleep(700)
        return
      }
      await sleep(300)
    }
    if (e.type === 'done') {
      setVerdict(e.ok ? { ok: true, text: e.summary ?? '', turns: e.turns, tokens: e.tokens } : { ok: false, text: e.reason ?? 'stopped', turns: e.turns, tokens: e.tokens })
    }
    if (e.type === 'error') say({ kind: 'say', text: `error: ${e.message}` })
  }

  function reset() {
    setFeed([])
    setDiagram(null)
    setSource(undefined)
    setCode('')
    setTest(undefined)
    setVerdict(null)
    setTestRun(0)
  }

  async function play(events: AgentEvent[]) {
    for (const e of events) await show(e)
  }

  async function start() {
    if (busy || !request.trim()) return
    reset()
    setBusy(true)
    const events: AgentEvent[] = []
    const queue: AgentEvent[] = []
    let finished = false
    // the agent and the screen run at their own pace, the screen works through a queue
    const pump = (async () => {
      for (;;) {
        const e = queue.shift()
        if (e) await show(e)
        else if (finished) break
        else await sleep(50)
      }
    })()
    try {
      const res = await fetch('/agent/build', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request }) })
      if (!res.ok || !res.body) throw new Error(res.status === 409 ? 'a build is already running' : 'agent server not running, start it with pnpm -C agent serve')
      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader()
      let buf = ''
      for (;;) {
        const { value, done } = await reader.read()
        if (done) break
        buf += value
        const chunks = buf.split('\n\n')
        buf = chunks.pop()!
        for (const c of chunks) {
          if (!c.startsWith('data: ')) continue
          const e = JSON.parse(c.slice(6)) as AgentEvent
          events.push(e)
          queue.push(e)
        }
      }
    } catch (e) {
      queue.push({ type: 'error', message: (e as Error).message })
    }
    finished = true
    await pump
    try {
      localStorage.setItem('blinkproof:last-build', JSON.stringify(events))
      setCanReplay(true)
    } catch {}
    setBusy(false)
  }

  async function replay() {
    let events: AgentEvent[] = []
    try {
      events = JSON.parse(localStorage.getItem('blinkproof:last-build') ?? '[]')
    } catch {}
    if (!events.length) return
    reset()
    setBusy(true)
    await play(events)
    setBusy(false)
  }

  useEffect(() => codeEnd.current?.scrollIntoView({ block: 'end' }), [code])

  return (
    <div className="flex min-h-0 flex-1">
      <section className="flex w-96 flex-col border-r border-line bg-panel">
        <div className="space-y-2 border-b border-line p-4">
          <textarea
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            rows={4}
            placeholder="describe a gadget in plain words"
            className="w-full resize-none rounded-md border border-line bg-canvas px-3 py-2 text-sm leading-5 text-ink outline-none focus:border-accent/60"
          />
          <div className="flex flex-wrap gap-1.5">
            {IDEAS.map((idea) => (
              <button key={idea} onClick={() => setRequest(idea)} className="rounded-full bg-line px-2.5 py-1 text-[11px] text-dim hover:text-ink">
                {idea.split(':')[0]}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={start} disabled={busy} className="flex-1 rounded-md bg-accent px-3 py-2 font-mono text-xs font-semibold text-canvas disabled:opacity-50">
              {busy ? 'building...' : 'build it'}
            </button>
            {canReplay && (
              <button onClick={replay} disabled={busy} className="rounded-md bg-line px-3 py-2 font-mono text-xs text-dim hover:text-ink disabled:opacity-50">
                replay last
              </button>
            )}
          </div>
        </div>
        <div className="min-h-0 flex-1 space-y-2 overflow-auto px-4 py-3 text-[12px] leading-5">
          {feed.map((f, i) =>
            f.kind === 'say' ? (
              <p key={i} className="rise text-dim">{f.text}</p>
            ) : (
              <div key={i} className="rise flex gap-2 font-mono text-[11px]">
                <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${f.ok ? 'bg-accent' : 'bg-[#f87171]'}`} />
                <span>
                  <span className="text-ink">{f.name}</span> <span className={f.ok ? 'text-dim' : 'text-[#f87171]'}>{f.note}</span>
                </span>
              </div>
            ),
          )}
          <div ref={feedEnd} />
        </div>
      </section>

      <div className="relative min-w-0 flex-1">
        {diagram ? (
          <Workbench diagram={diagram} source={source} test={test} testRun={testRun} sound={sound} reveal onState={onState} />
        ) : (
          <div className="dots flex h-full items-center justify-center">
            <p className="max-w-sm text-center text-sm text-dim">{busy ? 'the agent is picking parts...' : 'describe a gadget and the agent builds it here, then proves it works'}</p>
          </div>
        )}
        {verdict && (
          <div className={`rise absolute left-1/2 top-4 w-[560px] max-w-[90%] -translate-x-1/2 rounded-lg border px-4 py-3 text-sm shadow-2xl ${verdict.ok ? 'border-accent/40 bg-[#0f1f17]' : 'border-[#f87171]/40 bg-[#1f1012]'}`}>
            <div className={`font-mono text-xs font-semibold ${verdict.ok ? 'text-accent' : 'text-[#f87171]'}`}>
              {verdict.ok ? 'proven: the test passed' : 'not proven'} · {verdict.turns} turns · {verdict.tokens?.toLocaleString()} tokens
            </div>
            <p className="mt-1 text-[12px] leading-5 text-dim">{verdict.text}</p>
          </div>
        )}
      </div>

      <aside className="flex w-96 flex-col border-l border-line bg-panel">
        <Checks findings={bench?.findings ?? []} />
        <div className="flex gap-1 border-b border-line px-3 py-2">
          {(['code', 'test', 'serial'] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded px-2.5 py-1 font-mono text-[11px] ${tab === t ? 'bg-line text-ink' : 'text-dim hover:text-ink'}`}>
              {t}
            </button>
          ))}
          <span className="ml-auto self-center truncate font-mono text-[10px] text-dim">{bench?.status}</span>
        </div>
        {tab === 'code' && (
          <pre className="min-h-0 flex-1 overflow-auto px-3 py-2 font-mono text-[11px] leading-[18px] text-ink">
            {code.split('\n').map((line, i) => (
              <div key={i} className="flex gap-3">
                <span className="w-6 shrink-0 select-none text-right text-dim/50">{i + 1}</span>
                <span className="whitespace-pre">{line}</span>
              </div>
            ))}
            <div ref={codeEnd} />
          </pre>
        )}
        {tab === 'test' && (
          <div className="min-h-0 flex-1 overflow-auto">
            {testRun > 0 && <TestSteps steps={bench?.steps ?? []} report={bench?.report ?? null} />}
            {test && (
              <>
                <Heading title="test.yaml" />
                <pre className="px-4 pb-3 font-mono text-[11px] leading-[18px] text-dim">{test}</pre>
              </>
            )}
          </div>
        )}
        {tab === 'serial' && <Serial text={bench?.serial ?? ''} />}
      </aside>
    </div>
  )
}
