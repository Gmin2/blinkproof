import type { Diagram, Report } from '@blinkproof/sim'
import { useEffect, useRef, useState } from 'react'

export type AgentEvent =
  | { type: 'start'; request: string; model: string; version: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; name: string; args: any; result: Record<string, any>; ms: number }
  | { type: 'done'; ok: boolean; turns: number; summary?: string; reason?: string; tokens: number }
  | { type: 'result'; passed: boolean }
  | { type: 'error'; message: string }

export type FeedItem = { kind: 'say'; text: string } | { kind: 'tool'; name: string; ok: boolean; note: string }

export type Verdict = { ok: boolean; text: string; turns?: number; tokens?: number }

export const IDEAS = [
  'a parking sensor for my garage: an ultrasonic sensor measures the car, a 16 led ring fills up green to red as it gets closer, a buzzer beeps faster when close, and an oled shows the distance and says STOP under 10 cm',
  'a night light: an led that lights while you hold a button down',
  'a reaction game: an led lights after a random wait, press the button as fast as you can, the oled shows your time in ms',
  'a plant monitor on a raspberry pi pico: a soil sensor, an oled shows the moisture and says WATER ME under 30%',
  'on an arduino nano: a knob that sets how bright an led is',
]

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const LAST = 'blinkproof:last-build'

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

// the agent's build, played on screen at a pace a person can follow
export function useBuild(onRunTest: () => void, onTab: (tab: 'agent' | 'test' | 'code') => void) {
  const [busy, setBusy] = useState(false)
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [diagram, setDiagram] = useState<Diagram | null>(null)
  const [source, setSource] = useState<string>()
  const [code, setCode] = useState('')
  const [test, setTest] = useState<string>()
  const [verdict, setVerdict] = useState<Verdict | null>(null)
  const [request, setRequest] = useState('')
  const [canReplay, setCanReplay] = useState(false)
  const reportWaiter = useRef<(() => void) | null>(null)

  useEffect(() => {
    try {
      setCanReplay(!!localStorage.getItem(LAST))
    } catch {}
  }, [])

  // the canvas tells us when the test it plays has a report
  const reported = (report: Report | null) => {
    if (report && reportWaiter.current) {
      reportWaiter.current()
      reportWaiter.current = null
    }
  }

  const say = (item: FeedItem) => setFeed((f) => [...f, item])

  async function show(e: AgentEvent) {
    if (e.type === 'start') {
      setRequest(e.request)
      say({ kind: 'say', text: `building with ${e.model}, prompt ${e.version}` })
    }
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
        onTab('code')
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
        onTab('agent')
        return
      }
      if (e.name === 'write_test' && typeof e.args?.yaml === 'string' && ok) setTest(e.args.yaml)
      say({ kind: 'tool', name: e.name, ok, note: note(e.name, e.result) })
      if (e.name === 'run_test' && Array.isArray(e.result.steps)) {
        onTab('test')
        onRunTest()
        // let the canvas play the same test the agent just ran
        await Promise.race([new Promise<void>((r) => (reportWaiter.current = r)), sleep(20_000)])
        await sleep(700)
        onTab('agent')
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
  }

  async function start(text: string, model: string) {
    if (busy || !text.trim()) return
    reset()
    setRequest(text)
    setBusy(true)
    onTab('agent')
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
      const res = await fetch('/agent/build', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request: text, model }) })
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
      localStorage.setItem(LAST, JSON.stringify(events))
      setCanReplay(true)
    } catch {}
    setBusy(false)
  }

  async function replay() {
    let events: AgentEvent[] = []
    try {
      events = JSON.parse(localStorage.getItem(LAST) ?? '[]')
    } catch {}
    if (!events.length || busy) return
    reset()
    setBusy(true)
    onTab('agent')
    for (const e of events) await show(e)
    setBusy(false)
  }

  return { busy, feed, diagram, source, code, test, verdict, request, canReplay, start, replay, reported, reset }
}
