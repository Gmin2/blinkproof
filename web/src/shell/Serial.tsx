import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'

type Line = { ms: number; text: string }

type Props = {
  lines: Line[]
  simMs: number
  speed: number
  state: 'run' | 'pause' | 'stop'
  flash?: number
  ram?: number
  board: string
  onSend: (text: string) => void
}

const stamp = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`
}

// a line that sounds like trouble gets a red dot, one that sounds like it is up gets green
const tone = (text: string) => (/(error|fail|fault|panic|overflow|nan\b|crash)/i.test(text) ? 'bg-bad' : /(ready|ok\b|done|start|hello|pass)/i.test(text) ? 'bg-ok' : 'bg-icon-2/50')

function Card({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 px-3 py-2.5">
      <div className="flex items-center gap-1 text-[11px] text-dim" title={hint}>
        {label}
        {hint && <Icon name="circle-info" size={11} className="text-icon-2" />}
      </div>
      <div className="mt-0.5 truncate font-mono text-[15px] font-semibold text-ink">{value}</div>
    </div>
  )
}

// lines per second of sim time over the last stretch, drawn as a soft area
function Chart({ lines, simMs }: { lines: Line[]; simMs: number }) {
  const W = 268
  const H = 76
  // the window grows with the run, so a fresh boot is not squashed into the right edge
  const span = Math.max(2_000, Math.min(60_000, simMs))
  const buckets = 30
  const counts = useMemo(() => {
    const out = new Array(buckets).fill(0)
    const from = simMs - span
    for (const l of lines) {
      if (l.ms < from) continue
      const i = Math.min(buckets - 1, Math.floor(((l.ms - from) / span) * buckets))
      out[i]++
    }
    return out.map((c) => c / (span / buckets / 1000))
  }, [lines, simMs, span])
  const top = Math.max(1, ...counts)
  const pts = counts.map((c, i) => [(i / (buckets - 1)) * W, H - 4 - (c / top) * (H - 12)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ')
  return (
    <div>
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-semibold text-ink">Lines per second</span>
        <span className="text-dim">up to {top.toFixed(top < 10 ? 1 : 0)}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 block w-full" preserveAspectRatio="none" style={{ height: H }}>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--separator)" strokeDasharray="3 3" />
        <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="var(--accent)" opacity="0.08" />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinejoin="round" />
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-dim">
        <span>{stamp(Math.max(0, simMs - span)).slice(0, 5)}</span>
        <span>now</span>
      </div>
    </div>
  )
}

// the serial monitor as a live log: what the board printed, when, and a way to type back
export function Serial({ lines, simMs, speed, state, flash, ram, board, onSend }: Props) {
  const [cleared, setCleared] = useState(0)
  const [text, setText] = useState('')
  const [follow, setFollow] = useState(true)
  const list = useRef<HTMLDivElement>(null)
  const shown = lines.slice(cleared > lines.length ? 0 : cleared)

  // a fresh bench starts the log over
  useEffect(() => {
    if (lines.length < cleared) setCleared(0)
  }, [lines.length, cleared])

  useEffect(() => {
    if (follow && list.current) list.current.scrollTop = list.current.scrollHeight
  }, [shown.length, follow])

  const send = () => {
    if (state === 'stop') return
    onSend(text + '\n')
    setText('')
  }

  const liveDot = state === 'run' ? 'bg-ok animate-pulse' : 'bg-icon-2/60'

  return (
    <div className="flex h-full flex-col">
      <div className="px-4 pt-1">
        <div className="grid grid-cols-2 divide-x divide-y divide-sep overflow-hidden rounded-[10px] border border-sep">
          <Card label="Sim time" value={`${(simMs / 1000).toFixed(1)} s`} hint="time on the simulated board" />
          <Card label="Speed" value={state === 'stop' ? 'stopped' : state === 'pause' ? 'paused' : `${Math.round(speed * 100)}%`} hint="simulated time per second of real time" />
          <Card label="Lines" value={lines.length.toLocaleString()} />
          <Card label={flash ? 'Flash' : 'Board'} value={flash ? `${(flash / 1024).toFixed(1)} kb` : board} hint={ram ? `ram ${ram} b` : undefined} />
        </div>
        <div className="mt-4">
          <Chart lines={lines} simMs={simMs} />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-sep px-4 pt-3 text-[12px]">
        <span className="font-semibold text-ink">Output</span>
        <span className="flex items-center gap-3 text-[11px] text-dim">
          <button onClick={() => setCleared(lines.length)} className="hover:text-ink" title="clear the log, the board keeps running">
            Clear
          </button>
          <span className="flex items-center gap-1.5">
            <span className={`h-1.5 w-1.5 rounded-full ${liveDot}`} />
            {state === 'run' ? 'Live' : state === 'pause' ? 'Paused' : 'Stopped'}
          </span>
        </span>
      </div>

      <div
        ref={list}
        onScroll={(e) => {
          const el = e.currentTarget
          setFollow(el.scrollHeight - el.scrollTop - el.clientHeight < 24)
        }}
        className="min-h-0 flex-1 overflow-auto px-4 pb-2 pt-1.5 font-mono text-[11px] leading-[20px]"
      >
        {shown.length === 0 && <p className="pt-2 font-sans text-[11px] text-dim">{state === 'stop' ? 'Start the simulation to see what the board prints.' : 'Nothing printed yet.'}</p>}
        {shown.map((l, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-[5px] px-1 hover:bg-hover">
            <span className="shrink-0 text-dim/80">{stamp(l.ms)}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${tone(l.text)}`} />
            <span className="min-w-0 flex-1 truncate text-ink" title={l.text}>
              {l.text || ' '}
            </span>
          </div>
        ))}
      </div>
      {!follow && (
        <button onClick={() => setFollow(true)} className="pill mx-auto -mt-10 mb-2 flex h-7 items-center gap-1 px-3 text-[11px] text-ink">
          <Icon name="chevron-down" size={11} /> Newest
        </button>
      )}

      <form onSubmit={(e) => (e.preventDefault(), send())} className="flex items-center gap-2 border-t border-sep px-3 py-2.5">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={state === 'stop' ? 'Start the simulation to type here' : 'Send to the board, return sends'}
          disabled={state === 'stop'}
          className="h-8 min-w-0 flex-1 rounded-[8px] bg-input px-2.5 font-mono text-[11px] text-ink outline-none placeholder:font-sans placeholder:text-dim"
        />
        <button type="submit" disabled={state === 'stop'} className="flex h-8 w-8 items-center justify-center rounded-[8px] bg-accent text-on-accent disabled:opacity-40" title="send">
          <Icon name="paper-plane-2" size={14} />
        </button>
      </form>
    </div>
  )
}
