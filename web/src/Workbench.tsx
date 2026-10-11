import '@wokwi/elements'
import './elements/pico'
import { Bench, Circuit, checkRules, parseScenario, play, type Diagram, type Finding, type PartState, type Report, type StepResult } from '@blinkproof/sim'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { compile, type Build } from './lib/compile'
import { Speaker } from './lib/speaker'
import { routeAll, type Rect } from './lib/router'
import { rounded, route, split, type Point } from './lib/wires'

type Wokwi = HTMLElement & { pinInfo?: { name: string; x: number; y: number }[] } & Record<string, any>

export type BenchState = {
  status: string
  build: Build | null
  serial: string
  steps: StepResult[]
  report: Report | null
  findings: Finding[]
  // live, read by the inspector
  parts: Record<string, PartState>
  simMs: number
  zoom: number
}

type Props = {
  diagram: Diagram
  source?: string
  test?: string
  // bump to play the test on a fresh bench
  testRun?: number
  running?: boolean
  sound?: boolean
  // drop new parts in and draw new wires, for a build happening live
  reveal?: boolean
  onState?: (s: BenchState) => void
  // the frame's name above the circuit
  title?: string
  selected?: string | null
  onSelect?: (id: string | null) => void
}

// diagram types we draw ourselves
const TAGS: Record<string, string> = { 'wokwi-pi-pico': 'bp-pi-pico' }

const wireKey = (c: Diagram['connections'][number]) => `${c[0]}|${c[1]}`

export function Workbench({ diagram, source, test, testRun = 0, running = true, sound = false, reveal = false, onState, title, selected, onSelect }: Props) {
  const box = useRef<HTMLDivElement>(null)
  const els = useRef<Record<string, Wokwi>>({})
  const [paths, setPaths] = useState<{ key: string; d: string; color: string }[]>([])
  const [fit, setFit] = useState({ x: 40, y: 40, scale: 1 })
  // the frame around everything, in diagram units
  const [frame, setFrame] = useState({ x: 0, y: 0, w: 0, h: 0 })
  const [rects, setRects] = useState<Record<string, Rect>>({})
  const [hover, setHover] = useState<string | null>(null)
  const [live, setLive] = useState<Record<string, PartState>>({})
  const [serial, setSerial] = useState('')
  const [simMs, setSimMs] = useState(0)
  const [ram, setRam] = useState<{ leastFree: number; heapBytes: number; crashed: boolean } | null>(null)
  const [build, setBuild] = useState<Build | null>(null)
  const [problem, setProblem] = useState('')
  const [steps, setSteps] = useState<StepResult[]>([])
  const [report, setReport] = useState<Report | null>(null)
  const [sonars, setSonars] = useState<Record<string, number>>({})
  const benchRef = useRef<Bench | null>(null)
  const runningRef = useRef(running)
  runningRef.current = running
  const speaker = useRef(new Speaker())
  speaker.current.on = sound

  // what has already been shown, so a rewrite only animates what is new
  const shownParts = useRef(new Set<string>())
  const shownWires = useRef(new Set<string>())
  const fresh = useMemo(() => {
    const parts = diagram.parts.filter((p) => !shownParts.current.has(p.id)).map((p) => p.id)
    const wires = diagram.connections.filter((c) => !shownWires.current.has(wireKey(c))).map(wireKey)
    return { parts, wires }
  }, [diagram])
  useEffect(() => {
    for (const p of diagram.parts) shownParts.current.add(p.id)
    for (const c of diagram.connections) shownWires.current.add(wireKey(c))
  }, [diagram])

  const parsed = useMemo(() => Circuit.parse(diagram), [diagram])
  const findings = useMemo(() => (parsed.circuit ? checkRules(parsed.circuit, source) : []), [parsed, source])

  const board = diagram.parts.some((p) => p.type === 'wokwi-pi-pico') ? 'pico' : diagram.parts.some((p) => p.type === 'wokwi-arduino-nano') ? 'nano' : 'uno'

  useEffect(() => {
    if (!source) return
    let stale = false
    setBuild(null)
    setProblem('')
    compile(source, board)
      .then((b) => !stale && setBuild(b))
      .catch(() => !stale && setProblem('compiler not running, start it with pnpm -C compiler start'))
    return () => {
      stale = true
    }
  }, [source, board])

  // wires come from where each part sits plus its pin offsets, so they stay put while parts animate in
  useLayoutEffect(() => {
    const measure = () => {

      const rects: Record<string, Rect> = {}
      for (const p of diagram.parts) {
        const el = els.current[p.id]
        if (el) rects[p.id] = { x: p.left ?? 0, y: p.top ?? 0, w: el.offsetWidth, h: el.offsetHeight }
      }
      setRects(rects)
      const out: { key: string; d: string; color: string }[] = []
      const auto: { key: string; color: string; a: Point; b: Point; ra?: Rect; rb?: Rect }[] = []
      for (const c of diagram.connections) {
        const [from, to, color, hints] = c
        if (!color) continue
        const end = (ref: string) => {
          const [id, pin] = split(ref)
          const p = diagram.parts.find((q) => q.id === id)
          const info = els.current[id]?.pinInfo?.find((q) => q.name === pin)
          return p && info ? { at: { x: (p.left ?? 0) + info.x, y: (p.top ?? 0) + info.y }, rect: rects[id] } : null
        }
        const a = end(from)
        const b = end(to)
        if (!a || !b) continue
        // hand placed wires keep their wokwi hints, the rest go around the parts
        if (hints?.length) out.push({ key: wireKey(c), d: route(a.at, b.at, hints), color })
        else auto.push({ key: wireKey(c), color, a: a.at, b: b.at, ra: a.rect, rb: b.rect })
      }
      const points: Point[] = []
      if (auto.length) {
        const routes = routeAll(auto, Object.values(rects))
        auto.forEach((w, i) => out.push({ key: w.key, d: rounded(routes[i], 6), color: w.color }))
        points.push(...routes.flat())
      }
      setPaths(out)

      // fit the parts and every wire into the canvas
      const xs = [...Object.values(rects).flatMap((r) => [r.x, r.x + r.w]), ...points.map((p) => p.x)]
      const ys = [...Object.values(rects).flatMap((r) => [r.y, r.y + r.h + 40]), ...points.map((p) => p.y)]
      if (xs.length) {
        // the frame hugs the circuit with some room, then the view fits the frame under the toolbar pills
        const m = 36
        const [minX, maxX, minY, maxY] = [Math.min(...xs) - m, Math.max(...xs) + m, Math.min(...ys) - m, Math.max(...ys) + m]
        setFrame({ x: minX, y: minY, w: maxX - minX, h: maxY - minY })
        const area = box.current!.getBoundingClientRect()
        const top = 92
        const bottom = 80
        const scale = Math.min(1.2, (area.width - 80) / (maxX - minX), (area.height - top - bottom) / (maxY - minY))
        const x = (area.width - (maxX - minX) * scale) / 2 - minX * scale
        const y = top + (area.height - top - bottom - (maxY - minY) * scale) / 2 - minY * scale
        setFit({ x, y, scale })
      }
    }
    // parts size themselves after they upgrade, and some only once they render: measure now, soon, and on resize
    const id = requestAnimationFrame(measure)
    const later = setTimeout(measure, 350)
    addEventListener('resize', measure)
    return () => {
      cancelAnimationFrame(id)
      clearTimeout(later)
      removeEventListener('resize', measure)
    }
  }, [diagram])

  useEffect(() => {
    const firmware = build?.hex ?? build?.uf2
    if (!firmware || !parsed.circuit) return
    const bench = new Bench(parsed.circuit, firmware, build?.symbols)
    benchRef.current = bench
    // a test plays on a fresh bench at twice real time, so people can watch it
    const scenario = testRun && test ? parseScenario(test).scenario : undefined
    const playing = scenario ? play(bench, scenario) : null
    setSteps([])
    setReport(null)
    const strips = new Map<string, number>()
    const frames = new Map<string, number>()
    const distances: Record<string, number> = {}
    const cleanups: (() => void)[] = []

    for (const [id, part] of Object.entries(bench.parts)) {
      const el = els.current[id]
      if (!el) continue
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
      if (part.type === 'wokwi-led-ring') el.reset?.()
    }
    setSonars(distances)
    setSerial('')
    let raf = 0
    let last = performance.now()

    const tick = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      if (playing) {
        const until = bench.board.ms + dt * 2
        while (bench.board.ms < until) {
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
        if (!el) continue
        if (part.type === 'wokwi-led') {
          el.value = part.lit
          el.brightness = part.brightness
        }
        if (part.type === 'wokwi-servo' && part.servo) el.angle = part.servo.angle
        if (part.type === 'wokwi-pushbutton' && playing) el.pressed = part.pressed
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
      if (board) {
        if (parsed.circuit!.board.type === 'wokwi-pi-pico') board.led = bench.board.read('GP25')
        else {
          board.led13 = bench.board.read('D13')
          board.ledPower = true
        }
      }
      setSerial(bench.board.serial)
      setSimMs(Math.floor(bench.board.ms / 100) * 100)
      setLive(bench.parts)
      const mem = bench.board.memory()
      setRam(mem ? { ...mem, crashed: bench.board.collidedAtMs !== undefined } : null)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      speaker.current.stop()
      benchRef.current = null
      for (const c of cleanups) c()
    }
  }, [build, testRun, parsed])

  const status =
    problem ||
    (parsed.errors.length
      ? `diagram: ${parsed.errors[0]}`
      : !source
        ? ''
        : !build
          ? 'compiling...'
          : build.ok
            ? `compiled in ${(build.ms / 1000).toFixed(1)}s${build.cached ? ' (cached)' : ''} · flash ${build.flash} b · ram ${build.ram} of 2048 b`
            : `compile failed: line ${build.diagnostics[0]?.line} ${build.diagnostics[0]?.message}`)

  useEffect(() => {
    onState?.({ status, build, serial, steps, report, findings, parts: live, simMs, zoom: fit.scale })
  }, [status, build, serial, steps, report, findings, simMs, fit.scale])

  const partDelay = (id: string) => fresh.parts.indexOf(id) * 0.15
  const wireDelay = (key: string) => fresh.parts.length * 0.15 + 0.3 + fresh.wires.indexOf(key) * 0.08

  return (
    <div ref={box} className="dots relative h-full w-full overflow-hidden" onPointerDown={(e) => e.target === e.currentTarget && onSelect?.(null)}>
      <div className="absolute left-0 top-0 origin-top-left" style={{ transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`, transition: 'transform .5s ease' }}>
        {frame.w > 0 && (
          <>
            <div
              className="absolute select-none whitespace-nowrap text-[var(--frame-label)]"
              style={{ left: frame.x, top: frame.y - 20 / fit.scale, fontSize: 11 / fit.scale, lineHeight: 1 }}
            >
              {title ?? 'circuit'}
            </div>
            <div className="absolute bg-frame" style={{ left: frame.x, top: frame.y, width: frame.w, height: frame.h }} onPointerDown={() => onSelect?.(null)} />
          </>
        )}
        {diagram.parts.map((p) => {
          const Tag = (TAGS[p.type] ?? p.type) as any
          const isNew = reveal && fresh.parts.includes(p.id)
          return (
            <div
              key={p.id}
              className={`part ${isNew ? 'drop' : ''}`}
              style={{ left: p.left ?? 0, top: p.top ?? 0, display: p.hide ? 'none' : undefined, animationDelay: isNew ? `${partDelay(p.id)}s` : undefined }}
              onPointerDown={() => onSelect?.(p.id)}
              onPointerEnter={() => setHover(p.id)}
              onPointerLeave={() => setHover((h) => (h === p.id ? null : h))}
            >
              <Tag ref={(el: Wokwi | null) => el && (els.current[p.id] = el)} {...p.attrs} />
            </div>
          )
        })}
        <svg className="pointer-events-none absolute left-0 top-0 overflow-visible" width={1} height={1}>
          {paths.map((p) => {
            const isNew = reveal && fresh.wires.includes(p.key)
            const style = isNew ? { animationDelay: `${wireDelay(p.key)}s` } : undefined
            return (
              <g key={p.key}>
                <path d={p.d} pathLength={1} className={isNew ? 'draw' : ''} style={style} stroke="black" strokeOpacity={0.45} strokeWidth={5} fill="none" transform="translate(0 2)" />
                <path d={p.d} pathLength={1} className={isNew ? 'draw' : ''} style={style} stroke={p.color} strokeWidth={3} fill="none" strokeLinecap="round" />
              </g>
            )
          })}
        </svg>
        {[hover, selected].map((id, k) => {
          const r = id ? rects[id] : undefined
          if (!r || (k === 0 && id === selected)) return null
          const s = 7 / fit.scale
          const line = 1 / fit.scale
          return (
            <div key={k} className="pointer-events-none absolute" style={{ left: r.x, top: r.y, width: r.w, height: r.h, outline: `${line}px solid var(--accent)` }}>
              {k === 1 &&
                [[0, 0], [1, 0], [0, 1], [1, 1]].map(([x, y]) => (
                  <span key={`${x}${y}`} className="absolute rounded-[1px] bg-accent" style={{ width: s, height: s, left: `calc(${x * 100}% - ${s / 2}px)`, top: `calc(${y * 100}% - ${s / 2}px)` }} />
                ))}
            </div>
          )
        })}
        {Object.entries(sonars).map(([id, cm]) => {
          const p = diagram.parts.find((q) => q.id === id)
          if (!p) return null
          return (
            <label key={id} className="pill absolute flex items-center gap-2 px-3 py-1 font-mono text-[11px] text-dim" style={{ left: p.left ?? 0, top: (p.top ?? 0) + 95 }}>
              distance
              <input
                type="range"
                min={2}
                max={400}
                value={cm}
                className="w-32 accent-[var(--accent)]"
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
      </div>

      {/* the minimap, a little card in the corner with every part as a block */}
      {frame.w > 0 && (
        <div className="pill absolute bottom-3 left-3 overflow-hidden p-1.5" style={{ borderRadius: 12 }}>
          <svg width={112} height={112 * Math.min(0.7, frame.h / frame.w)} viewBox={`${frame.x} ${frame.y} ${frame.w} ${frame.h}`} preserveAspectRatio="xMidYMid meet" className="block">
            <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} fill="var(--frame)" />
            {Object.entries(rects).map(([id, r]) => (
              <rect key={id} x={r.x} y={r.y} width={r.w} height={r.h} rx={6} fill={id === selected ? 'var(--accent)' : 'var(--icon-2)'} opacity={id === selected ? 0.9 : 0.35} />
            ))}
          </svg>
        </div>
      )}

      {/* a canvas notification: how far the sim got, what the build cost */}
      <div className={`pill absolute bottom-3 left-1/2 flex h-9 -translate-x-1/2 items-center gap-4 whitespace-nowrap px-4 font-mono text-[11px] text-dim ${build ? '' : 'hidden'}`}>
        {build && !build.ok ? <span className="text-bad">{status}</span> : <span>sim {(simMs / 1000).toFixed(2)}s</span>}
        {build?.ok && <span>flash {build.flash} b</span>}
        {ram && build && (
          <span className="flex items-center gap-2" title="globals, heap and stack in the uno's 2048 bytes">
            ram
            <span className="relative h-1.5 w-28 overflow-hidden rounded-full bg-input">
              <span className="absolute inset-y-0 left-0 bg-[#64748b]" style={{ width: `${((build.ram ?? 0) / 2048) * 100}%` }} />
              <span className="absolute inset-y-0 bg-[#a78bfa]" style={{ left: `${((build.ram ?? 0) / 2048) * 100}%`, width: `${(ram.heapBytes / 2048) * 100}%` }} />
              <span className="absolute inset-y-0 right-0 bg-[#f59e0b]" style={{ width: `${(Math.max(0, 2048 - (build.ram ?? 0) - ram.heapBytes - Math.max(0, ram.leastFree)) / 2048) * 100}%` }} />
            </span>
            <span className={ram.crashed || ram.leastFree < 64 ? 'text-bad' : 'text-ink'}>{ram.crashed ? 'stack hit the heap' : `${ram.leastFree} b free`}</span>
          </span>
        )}
      </div>
    </div>
  )
}
