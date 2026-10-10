import '@wokwi/elements'
import { SSD1306, Uno } from '@blinkproof/sim'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import blinkSrc from '../../sketches/blink/blink.ino?raw'
import oledSrc from '../../sketches/hello-oled/hello-oled.ino?raw'

const SKETCHES = { blink: blinkSrc, 'hello-oled': oledSrc } as const
type Sketch = keyof typeof SKETCHES

type Build = { ok: boolean; hex?: string; flash?: number; ram?: number; ms: number; cached: boolean; diagnostics: { line: number; message: string }[] }

async function compile(source: string): Promise<Build> {
  const res = await fetch('/api/compile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ board: 'uno', files: { 'sketch.ino': source } }),
  })
  return res.json()
}

type Part = { id: string; tag: string; x: number; y: number; attrs?: Record<string, string> }

const PARTS: Part[] = [
  { id: 'uno', tag: 'wokwi-arduino-uno', x: 60, y: 150 },
  { id: 'led', tag: 'wokwi-led', x: 470, y: 70, attrs: { color: 'red' } },
  { id: 'oled', tag: 'wokwi-ssd1306', x: 560, y: 300 },
  { id: 'pot', tag: 'wokwi-potentiometer', x: 330, y: 470 },
]

// [from, to, colour]
const WIRES: [string, string, string][] = [
  ['uno:13', 'led:A', '#f59e0b'],
  ['led:C', 'uno:GND.1', '#94a3b8'],
  ['oled:VIN', 'uno:5V', '#ef4444'],
  ['oled:GND', 'uno:GND.2', '#94a3b8'],
  ['oled:CLK', 'uno:A5', '#38bdf8'],
  ['oled:DATA', 'uno:A4', '#a78bfa'],
  ['pot:VCC', 'uno:5V', '#ef4444'],
  ['pot:GND', 'uno:GND.3', '#94a3b8'],
  ['pot:SIG', 'uno:A0', '#22c55e'],
]

type Pin = { name: string; x: number; y: number }
type Wokwi = HTMLElement & { pinInfo?: Pin[] } & Record<string, any>

function pinPoint(el: Wokwi, name: string, root: DOMRect) {
  const pin = el.pinInfo?.find((p) => p.name === name)
  if (!pin) return null
  const box = el.getBoundingClientRect()
  return { x: box.left - root.left + pin.x, y: box.top - root.top + pin.y }
}

// leave the pin straight up or down first, then across, then into the other pin
function wirePath(a: { x: number; y: number }, b: { x: number; y: number }) {
  const midY = a.y + (b.y - a.y) / 2
  const r = Math.min(8, Math.abs(b.y - a.y) / 2, Math.abs(b.x - a.x) / 2)
  const sx = Math.sign(b.x - a.x) || 1
  const sy = Math.sign(b.y - a.y) || 1
  return [
    `M ${a.x} ${a.y}`,
    `L ${a.x} ${midY - sy * r}`,
    `Q ${a.x} ${midY} ${a.x + sx * r} ${midY}`,
    `L ${b.x - sx * r} ${midY}`,
    `Q ${b.x} ${midY} ${b.x} ${midY + sy * r}`,
    `L ${b.x} ${b.y}`,
  ].join(' ')
}

export default function App() {
  const canvas = useRef<HTMLDivElement>(null)
  const els = useRef<Record<string, Wokwi>>({})
  const [paths, setPaths] = useState<{ d: string; color: string }[]>([])
  const [sketch, setSketch] = useState<Sketch>('hello-oled')
  const [running, setRunning] = useState(true)
  const runningRef = useRef(running)
  runningRef.current = running
  const [serial, setSerial] = useState('')
  const [simMs, setSimMs] = useState(0)
  const [build, setBuild] = useState<Build | null>(null)
  const [compileError, setCompileError] = useState('')

  useEffect(() => {
    let stale = false
    setBuild(null)
    setCompileError('')
    compile(SKETCHES[sketch])
      .then((b) => !stale && setBuild(b))
      .catch(() => !stale && setCompileError('compiler not running, start it with pnpm -C compiler start'))
    return () => {
      stale = true
    }
  }, [sketch])

  useLayoutEffect(() => {
    // the elements size themselves after they upgrade, so measure on the next frame
    const id = requestAnimationFrame(() => {
      const root = canvas.current!.getBoundingClientRect()
      const out: { d: string; color: string }[] = []
      for (const [from, to, color] of WIRES) {
        const [fa, fp] = from.split(':')
        const [ta, tp] = to.split(':')
        const a = pinPoint(els.current[fa], fp, root)
        const b = pinPoint(els.current[ta], tp, root)
        if (a && b) out.push({ d: wirePath(a, b), color })
      }
      setPaths(out)
    })
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (!build?.hex) return
    const uno = new Uno(build.hex)
    const oled = uno.i2c.add(new SSD1306()) as SSD1306
    const { led, oled: screen, pot, uno: board } = els.current
    const image = screen.imageData as ImageData
    const setPot = () => uno.setVolts('A0', (Number(pot.value ?? 0) / 1023) * 5)
    setPot()
    pot.addEventListener('input', setPot)
    setSerial('')
    let raf = 0
    let last = performance.now()
    let frames = -1

    const tick = (now: number) => {
      const dt = Math.min(50, now - last)
      last = now
      if (runningRef.current) uno.run(dt)
      led.value = uno.read('D13')
      board.led13 = uno.read('D13')
      board.ledPower = true
      if (oled.frames !== frames) {
        frames = oled.frames
        oled.paint(image.data)
        screen.redraw()
      }
      setSerial(uno.serial)
      setSimMs(uno.ms)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      pot.removeEventListener('input', setPot)
    }
  }, [build])

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-line bg-panel px-5 py-3">
        <span className="font-mono text-sm font-semibold tracking-tight text-accent">blinkproof</span>
        <span className="text-xs text-dim">wokwi for agents</span>
        <span className="font-mono text-[11px] text-dim">
          {compileError ||
            (!build
              ? 'compiling...'
              : build.ok
                ? `compiled in ${(build.ms / 1000).toFixed(1)}s${build.cached ? ' (cached)' : ''} · flash ${build.flash} b · ram ${build.ram} of 2048 b`
                : `compile failed: line ${build.diagnostics[0]?.line} ${build.diagnostics[0]?.message}`)}
        </span>
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
          <button
            onClick={() => setRunning((r) => !r)}
            className="rounded-md bg-line px-3 py-1.5 font-mono text-xs text-ink hover:bg-[#283246]"
          >
            {running ? 'pause' : 'run'}
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div ref={canvas} className="dots relative flex-1 overflow-hidden">
          {PARTS.map((p) => {
            const Tag = p.tag as any
            return (
              <div key={p.id} className="part" style={{ left: p.x, top: p.y }}>
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
          <div className="absolute bottom-3 left-4 font-mono text-[11px] text-dim">sim {(simMs / 1000).toFixed(2)}s</div>
        </div>

        <aside className="flex w-80 flex-col border-l border-line bg-panel">
          <div className="border-b border-line px-4 py-2 font-mono text-[11px] uppercase tracking-wider text-dim">serial</div>
          <pre className="flex-1 overflow-auto px-4 py-3 font-mono text-xs leading-5 text-ink">{serial}</pre>
        </aside>
      </div>
    </div>
  )
}
