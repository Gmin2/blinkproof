import '@wokwi/elements'
import { Bench, Circuit, parseScenario, play, type Diagram, type Report, type StepResult } from '@blinkproof/sim'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import blinkDiagram from '../../sketches/blink/diagram.json'
import blinkSrc from '../../sketches/blink/blink.ino?raw'
import oledDiagram from '../../sketches/hello-oled/diagram.json'
import oledSrc from '../../sketches/hello-oled/hello-oled.ino?raw'
import tourDiagram from '../../sketches/parts-tour/diagram.json'
import tourSrc from '../../sketches/parts-tour/parts-tour.ino?raw'
import tourTest from '../../sketches/parts-tour/test.yaml?raw'
import parkingDiagram from '../../sketches/parking/diagram.json'
import parkingSrc from '../../sketches/parking/parking.ino?raw'
import parkingTest from '../../sketches/parking/test.yaml?raw'
import parkingRamSrc from '../../sketches/parking-ram/parking-ram.ino?raw'
import potDiagram from '../../sketches/pot-print/diagram.json'
import potSrc from '../../sketches/pot-print/pot-print.ino?raw'
import potTest from '../../sketches/pot-print/test.yaml?raw'

const SKETCHES: Record<string, { source: string; diagram: Diagram; test?: string }> = {
  blink: { source: blinkSrc, diagram: blinkDiagram as unknown as Diagram },
  'hello-oled': { source: oledSrc, diagram: oledDiagram as unknown as Diagram },
  'parts-tour': { source: tourSrc, diagram: tourDiagram as unknown as Diagram, test: tourTest },
  parking: { source: parkingSrc, diagram: parkingDiagram as unknown as Diagram, test: parkingTest },
  'parking-ram': { source: parkingRamSrc, diagram: parkingDiagram as unknown as Diagram, test: parkingTest },
  'pot-print': { source: potSrc, diagram: potDiagram as unknown as Diagram, test: potTest },
}
type Sketch = string

type Build = { ok: boolean; hex?: string; symbols?: { brkval?: number; heapStart?: number }; flash?: number; ram?: number; ms: number; cached: boolean; diagnostics: { line: number; message: string }[] }

async function compile(source: string): Promise<Build> {
  const res = await fetch('/api/compile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ board: 'uno', files: { 'sketch.ino': source } }),
  })
  return res.json()
}

type Point = { x: number; y: number }
type Wokwi = HTMLElement & { pinInfo?: { name: string; x: number; y: number }[] } & Record<string, any>

function pinPoint(el: Wokwi | undefined, name: string, root: DOMRect) {
  const pin = el?.pinInfo?.find((p) => p.name === name)
  if (!el || !pin) return null
  const box = el.getBoundingClientRect()
  return { x: box.left - root.left + pin.x, y: box.top - root.top + pin.y }
}

// wokwi hints: v<n> moves down, h<n> moves right. the ones before "*" walk out of the source pin,
// the ones after it walk back out of the target pin. the loose ends are joined with one elbow
function route(a: Point, b: Point, hints: string[] = []) {
  const star = hints.indexOf('*')
  const head = star < 0 ? hints : hints.slice(0, star)
  const tail = star < 0 ? [] : hints.slice(star + 1)
  const walk = (from: Point, steps: string[]) => {
    const pts = [from]
    let p = from
    for (const s of steps) {
      const n = Number(s.slice(1))
      if (!Number.isFinite(n)) continue
      p = s[0] === 'v' ? { x: p.x, y: p.y + n } : s[0] === 'h' ? { x: p.x + n, y: p.y } : p
      pts.push(p)
    }
    return pts
  }
  const start = walk(a, head)
  const end = walk(b, [...tail].reverse()).reverse()
  const s = start[start.length - 1]
  const e = end[0]
  // with no hints, leave a pin straight out first, then across, then into the other pin
  const middle = hints.length ? [{ x: e.x, y: s.y }] : [{ x: s.x, y: (s.y + e.y) / 2 }, { x: e.x, y: (s.y + e.y) / 2 }]
  return rounded([...start, ...middle, ...end])
}

function rounded(points: Point[], r = 8) {
  const pts = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y)
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]]
    const k = Math.min(r, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2)
    const toward = (q: Point) => {
      const len = Math.hypot(q.x - c.x, q.y - c.y) || 1
      return { x: c.x + ((q.x - c.x) / len) * k, y: c.y + ((q.y - c.y) / len) * k }
    }
    const a = toward(p)
    const b = toward(n)
    d += ` L ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`
  }
  const last = pts[pts.length - 1]
  return `${d} L ${last.x} ${last.y}`
}

// a passive buzzer through the speakers, quiet, a square wave like the real thing
class Speaker {
  private ctx: AudioContext | null = null
  private osc: OscillatorNode | null = null
  private gain: GainNode | null = null
  on = false
  play(hz: number) {
    if (!this.on || !hz) return this.stop()
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.gain = this.ctx.createGain()
      this.gain.gain.value = 0.04
      this.gain.connect(this.ctx.destination)
    }
    if (!this.osc) {
      this.osc = this.ctx.createOscillator()
      this.osc.type = 'square'
      this.osc.connect(this.gain!)
      this.osc.start()
    }
    this.osc.frequency.setTargetAtTime(hz, this.ctx.currentTime, 0.005)
  }
  stop() {
    this.osc?.stop()
    this.osc?.disconnect()
    this.osc = null
  }
}

const split = (ref: string) => [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)]

export default function App() {
  const canvas = useRef<HTMLDivElement>(null)
  const els = useRef<Record<string, Wokwi>>({})
  const [sketch, setSketch] = useState<Sketch>('hello-oled')
  const { diagram, source, test } = SKETCHES[sketch]
  const [testRun, setTestRun] = useState(0)
  const [steps, setSteps] = useState<StepResult[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [paths, setPaths] = useState<{ d: string; color: string }[]>([])
  const [running, setRunning] = useState(true)
  const runningRef = useRef(running)
  runningRef.current = running
  const [serial, setSerial] = useState('')
  const [simMs, setSimMs] = useState(0)
  const [ram, setRam] = useState<{ free: number; leastFree: number; heapBytes: number; crashed: boolean } | null>(null)
  const [build, setBuild] = useState<Build | null>(null)
  const [problem, setProblem] = useState('')
  const speaker = useRef(new Speaker())
  const [sound, setSound] = useState(false)
  speaker.current.on = sound
  const [sonars, setSonars] = useState<Record<string, number>>({})
  const benchRef = useRef<Bench | null>(null)

  const parsed = Circuit.parse(diagram)

  useEffect(() => {
    let stale = false
    setBuild(null)
    setProblem('')
    setTestRun(0)
    setSteps([])
    setReport(null)
    compile(source)
      .then((b) => !stale && setBuild(b))
      .catch(() => !stale && setProblem('compiler not running, start it with pnpm -C compiler start'))
    return () => {
      stale = true
    }
  }, [source])

  useLayoutEffect(() => {
    // the elements size themselves after they upgrade, so measure on the next frame
    const id = requestAnimationFrame(() => {
      const root = canvas.current!.getBoundingClientRect()
      const out: { d: string; color: string }[] = []
      for (const [from, to, color, hints] of diagram.connections) {
        if (!color) continue
        const [fa, fp] = split(from)
        const [ta, tp] = split(to)
        const a = pinPoint(els.current[fa], fp, root)
        const b = pinPoint(els.current[ta], tp, root)
        if (a && b) out.push({ d: route(a, b, hints), color })
      }
      setPaths(out)
    })
    return () => cancelAnimationFrame(id)
  }, [diagram])

  useEffect(() => {
    if (!build?.hex || !parsed.circuit) return
    const bench = new Bench(parsed.circuit, build.hex, build.symbols)
    benchRef.current = bench
    // a test plays on a fresh bench, at twice real time so people can watch it
    const scenario = testRun && test ? parseScenario(test).scenario : undefined
    const playing = scenario ? play(bench, scenario) : null
    setSteps([])
    setReport(null)
    const strips = new Map<string, number>()
    const distances: Record<string, number> = {}
    const cleanups: (() => void)[] = []
    const frames = new Map<string, number>()

    for (const [id, part] of Object.entries(bench.parts)) {
      const el = els.current[id]
      if (part.type === 'wokwi-potentiometer') {
        const onInput = () => bench.control(id, 'position', Number(el.value ?? 0) / 1023)
        el.addEventListener('input', onInput)
        cleanups.push(() => el.removeEventListener('input', onInput))
      }
      if (part.type === 'wokwi-pushbutton') {
        const down = () => bench.control(id, 'pressed', 1)
        const up = () => bench.control(id, 'pressed', 0)
        el.addEventListener('button-press', down)
        el.addEventListener('button-release', up)
        cleanups.push(() => (el.removeEventListener('button-press', down), el.removeEventListener('button-release', up)))
      }
      if (part.type === 'wokwi-hc-sr04') distances[id] = part.distance
      if (part.type === 'wokwi-ssd1306') {
        // dark until the sketch draws on it
        const px = (el.imageData as ImageData).data
        for (let i = 0; i < px.length; i++) px[i] = i % 4 === 3 ? 255 : 0
        el.redraw()
      }
    }
    setSonars(distances)
    setSerial('')
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      if (playing) {
        const until = bench.uno.ms + dt * 2
        while (bench.uno.ms < until) {
          const next = playing.next()
          if (next.done) {
            setReport(next.value)
            break
          }
          if (next.value) setSteps((s) => [...s, next.value!])
        }
      } else if (runningRef.current) bench.run(dt)
      for (const [id, part] of Object.entries(bench.parts)) {
        const el = els.current[id]
        if (part.type === 'wokwi-led') el.value = part.lit
        if (part.type === 'wokwi-servo' && part.servo) el.angle = part.servo.angle
        // a test moves the car too, keep the slider with it
        if (part.type === 'wokwi-hc-sr04' && part.distance !== distances[id]) {
          distances[id] = part.distance
          setSonars({ ...distances })
        }
        if (part.type === 'wokwi-buzzer') {
          el.hasSignal = !!part.buzzer?.hz
          speaker.current.play(part.buzzer?.hz ?? 0)
        }
        if ((part.type === 'wokwi-led-ring' || part.type === 'wokwi-neopixel') && part.strip && part.strip.frames !== strips.get(id)) {
          strips.set(id, part.strip.frames)
          const [first] = part.strip.pixels
          if (part.type === 'wokwi-neopixel') Object.assign(el, { r: first[0] / 255, g: first[1] / 255, b: first[2] / 255 })
          else part.strip.pixels.forEach(([r, g, b], i) => el.setPixel(i, { r: r / 255, g: g / 255, b: b / 255 }))
        }
        if (part.type === 'wokwi-ssd1306' && part.oled && part.oled.frames !== frames.get(id)) {
          frames.set(id, part.oled.frames)
          part.oled.paint((el.imageData as ImageData).data)
          el.redraw()
        }
      }
      const board = els.current[parsed.circuit!.board.id]
      board.led13 = bench.uno.read('D13')
      board.ledPower = true
      setSerial(bench.uno.serial)
      setSimMs(bench.uno.ms)
      const mem = bench.uno.memory()
      setRam(mem ? { ...mem, crashed: bench.uno.collidedAtMs !== undefined } : null)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      speaker.current.stop()
      benchRef.current = null
      for (const c of cleanups) c()
    }
  }, [build, testRun])

  const status =
    problem ||
    (parsed.errors.length
      ? `diagram: ${parsed.errors[0]}`
      : !build
        ? 'compiling...'
        : build.ok
          ? `compiled in ${(build.ms / 1000).toFixed(1)}s${build.cached ? ' (cached)' : ''} · flash ${build.flash} b · ram ${build.ram} of 2048 b`
          : `compile failed: line ${build.diagnostics[0]?.line} ${build.diagnostics[0]?.message}`)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-line bg-panel px-5 py-3">
        <span className="font-mono text-sm font-semibold tracking-tight text-accent">blinkproof</span>
        <span className="text-xs text-dim">wokwi for agents</span>
        <span className="font-mono text-[11px] text-dim">{status}</span>
        <div className="ml-auto flex items-center gap-2">
          {(Object.keys(SKETCHES) as Sketch[]).map((s) => (
            <button
              key={s}
              onClick={() => setSketch(s)}
              className={`rounded-md px-3 py-1.5 font-mono text-xs ${s === sketch ? 'bg-accent text-canvas' : 'bg-line text-dim hover:text-ink'}`}
            >
              {s}
            </button>
          ))}
          {test && (
            <button
              onClick={() => setTestRun((n) => n + 1)}
              className="rounded-md bg-accent/15 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent/25"
            >
              run test
            </button>
          )}
          <button
            onClick={() => setSound((v) => !v)}
            className="rounded-md bg-line px-3 py-1.5 font-mono text-xs text-ink hover:bg-[#283246]"
          >
            {sound ? 'sound on' : 'sound off'}
          </button>
          <button
            onClick={() => setRunning((r) => !r)}
            className="rounded-md bg-line px-3 py-1.5 font-mono text-xs text-ink hover:bg-[#283246]"
          >
            {running ? 'pause' : 'run'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={canvas} key={sketch} className="dots relative flex-1 overflow-hidden">
          {diagram.parts.map((p) => {
            const Tag = p.type as any
            return (
              <div key={p.id} className="part" style={{ left: p.left ?? 0, top: p.top ?? 0, display: p.hide ? 'none' : undefined }}>
                <Tag ref={(el: Wokwi | null) => el && (els.current[p.id] = el)} {...p.attrs} />
              </div>
            )
          })}
          <svg className="pointer-events-none absolute inset-0 h-full w-full">
            {paths.map((p, i) => (
              <g key={i}>
                <path d={p.d} stroke="black" strokeOpacity={0.45} strokeWidth={5} fill="none" transform="translate(0 2)" />
                <path d={p.d} stroke={p.color} strokeWidth={3} fill="none" strokeLinecap="round" />
              </g>
            ))}
          </svg>
          {Object.entries(sonars).map(([id, cm]) => {
            const p = diagram.parts.find((q) => q.id === id)!
            return (
              <label key={id} className="absolute flex items-center gap-2 rounded-md bg-panel/90 px-2 py-1 font-mono text-[11px] text-dim" style={{ left: p.left ?? 0, top: (p.top ?? 0) + 95 }}>
                distance
                <input
                  type="range"
                  min={2}
                  max={400}
                  value={cm}
                  className="w-32 accent-[#7cf29a]"
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    setSonars((s) => ({ ...s, [id]: v }))
                    benchRef.current?.control(id, 'distance', v)
                  }}
                />
                <span className="w-12 text-ink">{cm} cm</span>
              </label>
            )
          })}
          <div className="absolute bottom-3 left-4 flex items-center gap-4 font-mono text-[11px] text-dim">
            <span>sim {(simMs / 1000).toFixed(2)}s</span>
            {ram && build && (
              <span className="flex items-center gap-2" title="globals, heap and stack in the uno's 2048 bytes">
                ram
                <span className="relative h-2 w-40 overflow-hidden rounded-full bg-line">
                  <span className="absolute inset-y-0 left-0 bg-[#64748b]" style={{ width: `${((build.ram ?? 0) / 2048) * 100}%` }} />
                  <span className="absolute inset-y-0 bg-[#a78bfa]" style={{ left: `${((build.ram ?? 0) / 2048) * 100}%`, width: `${(ram.heapBytes / 2048) * 100}%` }} />
                  <span className="absolute inset-y-0 right-0 bg-[#f59e0b]" style={{ width: `${Math.max(0, 2048 - (build.ram ?? 0) - ram.heapBytes - Math.max(0, ram.leastFree)) / 2048 * 100}%` }} />
                </span>
                <span className={ram.crashed || ram.leastFree < 64 ? 'text-[#f87171]' : 'text-ink'}>
                  {ram.crashed ? 'stack hit the heap' : `${ram.leastFree} b free`}
                </span>
              </span>
            )}
          </div>
        </div>

        <aside className="flex w-80 flex-col border-l border-line bg-panel">
          {testRun > 0 && (
            <div className="border-b border-line">
              <div className="flex items-center justify-between px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-dim">
                <span>test</span>
                {report && <span className={report.ok ? 'text-accent' : 'text-[#f87171]'}>{report.ok ? 'passed' : 'failed'}</span>}
              </div>
              <ol className="max-h-72 overflow-auto px-4 pb-3 font-mono text-[11px] leading-5">
                {steps.map((st) => (
                  <li key={st.index} className="flex gap-2">
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${st.ok ? 'bg-accent' : 'bg-[#f87171]'}`} />
                    <span className={st.ok ? 'text-ink' : 'text-[#f87171]'}>
                      {st.name ?? st.kind}
                      <span className="block text-dim">{st.detail}</span>
                    </span>
                  </li>
                ))}
                {!report && <li className="text-dim">running...</li>}
              </ol>
              {report?.failed && <pre className="mx-4 mb-3 whitespace-pre-wrap rounded bg-canvas px-3 py-2 text-[10px] leading-4 text-dim">{report.failed.bench}</pre>}
            </div>
          )}
          <div className="border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-dim">serial</div>
          <pre className="flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-5 text-ink">{serial}</pre>
        </aside>
      </div>
    </div>
  )
}
