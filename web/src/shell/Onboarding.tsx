import { BaseEdge, EdgeLabelRenderer, applyNodeChanges, type NodeChange, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, getSmoothStepPath, useNodesInitialized, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import type { Diagram } from '@blinkproof/sim'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, Logo, type IconName } from '../icons/Icon'
import { PART_ICON, Status } from '../icons/Status'
import { BuildGuide } from './Guide'
import { api, type Saved } from './library'
import { KIND } from './Sidebar'
import { IDEAS, type Compiled, type FeedItem, type Run, type Verdict } from './useBuild'

type Props = {
  busy: boolean
  request: string
  prompt: string
  onPrompt: (t: string) => void
  onStart: () => void
  feed: FeedItem[]
  diagram: Diagram | null
  source?: string
  test?: string
  runs: Run[]
  compiles: Compiled[]
  verdict: Verdict | null
  savedId?: string
  recent: Saved[]
  examples: Saved[]
  onEditor: (id?: string) => void
  onBlank: (board: 'uno' | 'nano' | 'pico') => void
  // back to the start card, once a build is done
  onReset: () => void
}

const BOARDS = ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-pi-pico']
const INPUTS = ['wokwi-pushbutton', 'wokwi-potentiometer', 'wokwi-hc-sr04']
const RAILS = /^(GND|5V|3\.3V|3V3|VIN|VCC|VBUS|VSYS|V\+|VDD|VSS|IOREF|AREF)/
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
const ohms = (v?: string) => {
  const n = Number(v ?? 220)
  return n >= 1000 ? `${n / 1000}k Ω` : `${n} Ω`
}

// the soft outer frame and the white card inside it, the way every surface in the flow is drawn
function Frame({ children, className = '', footer }: { children: React.ReactNode; className?: string; footer?: React.ReactNode }) {
  return (
    <div className={`rounded-[14px] border border-line/80 bg-input/60 p-[3px] ${className}`}>
      <div className="overflow-hidden rounded-[11px] border border-line bg-panel shadow-[0_1px_2px_rgba(0,0,0,.04)]">{children}</div>
      {footer}
    </div>
  )
}

function Row({ icon, title, line, onClick }: { icon: IconName; title: string; line: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 border-t border-sep px-3 py-2.5 text-left first:border-t-0 hover:bg-hover">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-sep bg-input/70 text-icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13.5px] font-medium text-ink">{title}</span>
        <span className="block truncate text-[12px] text-dim">{line}</span>
      </span>
      <Icon name="plus" size={13} className="text-icon-2 transition-colors group-hover:text-accent" />
    </button>
  )
}

// a tab that sits on top of the input it names, the way you get back out
function Tab({ label, onBack }: { label: string; onBack?: () => void }) {
  return (
    <div className="flex justify-center">
      <button onClick={onBack} disabled={!onBack} className="-mb-px flex h-8 items-center gap-1.5 rounded-t-[10px] border border-b-0 border-line bg-input/60 px-3 text-[12.5px] font-medium text-dim hover:text-ink disabled:hover:text-dim">
        <Icon name="chevron-left" size={11} />
        {label}
      </button>
    </div>
  )
}

/* ---------- the path ---------- */

type NodeData = { kind: 'source' | 'board' | 'part'; label: string; sub?: string; icon: IconName; state: 'work' | 'done' | 'fail' | 'idle'; onPick: () => void }

function SourceNode({ data }: NodeProps<Node<NodeData>>) {
  // the usb cable feeding the board, lettered round its ring like the public internet glyph
  return (
    <button onClick={data.onPick} className="relative block h-[60px] w-[60px] text-icon-2 hover:text-ink">
      <svg viewBox="0 0 60 60" className="absolute inset-0">
        <defs>
          <path id="usb-ring" d="M30 30 m-24 0 a24 24 0 1 1 48 0 a24 24 0 1 1 -48 0" />
        </defs>
        <text fontSize="6.8" letterSpacing="1.2" fill="currentColor" fontFamily="Geist Mono, monospace">
          <textPath href="#usb-ring" startOffset="2%">
            USB POWER · 5 VOLTS · USB ·
          </textPath>
        </text>
        <circle cx="30" cy="30" r="12" fill="var(--panel)" stroke="currentColor" strokeWidth="1.3" />
        <path d="M26 27.5h8v5a2 2 0 0 1-2 2h-4a2 2 0 0 1-2-2zM28 27.5v-3M32 27.5v-3M30 34.5v3" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </svg>
      <Handle type="source" position={Position.Top} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
    </button>
  )
}

type IdeaData = { label: string; sub?: string; lines?: string[]; open: boolean; badge?: string; onPick: () => void }

// what you asked for. while the agent is still picking parts it is the card you typed into, with what the agent
// says inside it. once there is a board it folds into a node at the top of the path
function IdeaNode({ data, selected }: NodeProps<Node<IdeaData>>) {
  return (
    <button onClick={data.onPick} className={`rise block rounded-[14px] border p-[3px] text-left transition-all duration-300 ${selected ? 'border-accent/60 bg-accent/10' : 'border-line/80 bg-input/60'} ${data.open ? 'w-[420px]' : ''}`}>
      <Handle type="source" position={Position.Bottom} className="!h-1.5 !w-1.5 !min-w-0 !rounded-[2px] !border-0 !bg-icon-2" />
      <span className={`block overflow-hidden rounded-[11px] border bg-panel ${selected ? 'border-accent' : 'border-line'}`}>
        <span className={`flex items-center gap-2.5 ${data.open ? 'border-b border-sep px-3.5 py-2.5' : 'px-3 py-2'}`}>
          <Icon name="magic-wand" size={15} className="text-icon" />
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-medium text-ink ${data.open ? 'text-[14px]' : 'max-w-[220px] text-[13px]'}`}>{data.label}</span>
            {!data.open && data.sub && <span className="block text-[11px] text-dim">{data.sub}</span>}
          </span>
          {data.badge && (
            <span className="flex shrink-0 items-center gap-1.5 rounded-full border border-line px-2 py-0.5 text-[11.5px] font-medium text-ink">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-warn" />
              {data.badge}
            </span>
          )}
        </span>
        {data.open && (
          <span className="block space-y-1.5 px-3.5 py-3 text-[12.5px] leading-[18px] text-dim">
            {(data.lines?.length ? data.lines : ['Reading what you asked for...']).map((l, i) => (
              <span key={i} className="line-clamp-2 block">
                {l}
              </span>
            ))}
          </span>
        )}
      </span>
      {data.open && (
        <span className="flex items-center gap-2 px-3.5 py-2 text-[12px] text-dim">
          <Icon name="loader" size={13} className="animate-spin" />
          Picking a board and parts, it has to pass a test before you get it
        </span>
      )}
    </button>
  )
}

function CardNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const dot = data.state === 'done' ? 'bg-ok' : data.state === 'fail' ? 'bg-bad' : data.state === 'work' ? 'bg-accent animate-pulse' : 'bg-icon-2/50'
  const big = data.kind === 'board'
  return (
    <button onClick={data.onPick} className={`rise block rounded-[12px] border p-[3px] transition-colors ${selected ? 'border-accent/60 bg-accent/10' : 'border-line/80 bg-input/60'}`}>
      <Handle type="target" position={Position.Left} className="!h-1.5 !w-1.5 !min-w-0 !rounded-[2px] !border-0 !bg-icon-2" />
      <Handle type="source" position={Position.Right} className="!h-1.5 !w-1.5 !min-w-0 !rounded-[2px] !border-0 !bg-icon-2" />
      <Handle type="target" id="top" position={Position.Top} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="target" id="bottom" position={Position.Bottom} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <span className={`flex items-center gap-2.5 rounded-[9px] border bg-panel ${selected ? 'border-accent' : 'border-line'} ${big ? 'px-3.5 py-2.5' : 'px-3 py-2'}`}>
        <Icon name={data.icon} size={big ? 17 : 15} className="text-icon" />
        <span className="text-left">
          <span className={`block font-medium text-ink ${big ? 'text-[14px]' : 'text-[13px]'}`}>{data.label}</span>
          {data.sub && <span className="block text-[11px] text-dim">{data.sub}</span>}
        </span>
        <span className={`ml-1.5 h-2.5 w-2.5 rounded-full ${dot}`} />
      </span>
    </button>
  )
}

type Chip = { text: string; icon?: IconName }

// an edge with the wiring on it: the pin it lands on, and the resistor it goes through, as little chips
function ChipEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }: EdgeProps<Edge<{ chips: Chip[]; hot?: boolean; at?: 'source' | 'target' }>>) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10 })
  // the chips sit on the part's own leg of the edge, so branches off one pin do not pile them up
  const [lx, ly] = data?.at === 'source' ? [sourceX + 70, sourceY] : [targetX - 70, targetY]
  const chips = data?.chips ?? []
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {chips.length > 0 && (
          <div className="nodrag nopan absolute flex items-center gap-1" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}>
            {chips.map((c, i) => (
              <span key={i} className={`flex h-6 items-center gap-1 rounded-[7px] border bg-panel px-1.5 font-mono text-[10.5px] shadow-[0_1px_1px_rgba(0,0,0,.04)] ${data?.hot ? 'border-accent text-accent' : 'border-line text-dim'}`}>
                {c.icon && <Icon name={c.icon} size={11} />}
                {c.text}
              </span>
            ))}
          </div>
        )}
      </EdgeLabelRenderer>
    </>
  )
}

const nodeTypes = { source: SourceNode, card: CardNode, idea: IdeaNode }
const edgeTypes = { chip: ChipEdge }

// the circuit as a signal path: inputs come in from the left, the board in the middle, outputs go out to the right
type Idea = Omit<IdeaData, 'onPick' | 'open'>

function layout(d: Diagram | null, idea: Idea, picked: string | null, onPick: (id: string) => void, state: NodeData['state'], fresh: string | undefined) {
  const board = d?.parts.find((p) => BOARDS.includes(p.type))
  const ideaNode = (open: boolean): Node => ({ id: 'idea', type: 'idea', position: { x: open ? -110 : 0, y: open ? -60 : -170 }, data: { ...idea, open, badge: open ? idea.badge : undefined, onPick: () => onPick('idea') }, selected: picked === 'idea', draggable: false })
  // nothing to draw yet but the request: the card you typed into, still open
  if (!d || !board) return { nodes: [ideaNode(true)], edges: [] as Edge[] }
  const resistors = new Set(d.parts.filter((p) => p.type === 'wokwi-resistor').map((p) => p.id))
  const peers = (ref: string) => d.connections.filter(([a, b]) => a === ref || b === ref).map(([a, b]) => (a === ref ? b : a))
  // what a part's signal pins reach on the board, straight or through a resistor
  const reach = (id: string) => {
    const pins: string[] = []
    let through: string | undefined
    for (const [a, b] of d.connections) {
      const mine = a.startsWith(`${id}:`) ? a : b.startsWith(`${id}:`) ? b : null
      if (!mine) continue
      const other = mine === a ? b : a
      const [oid, opin] = other.split(':')
      if (oid === board.id) pins.push(opin)
      else if (resistors.has(oid)) {
        through = oid
        for (const r of peers(`${oid}:${opin === '1' ? '2' : '1'}`)) if (r.startsWith(`${board.id}:`)) pins.push(r.split(':')[1])
      }
    }
    const signal = [...new Set(pins.map((p) => p.replace(/\.\d$/, '')))].filter((p) => !RAILS.test(p))
    return { signal, through }
  }
  const used = new Set<string>()
  const parts = d.parts.filter((p) => p !== board && !p.hide && !resistors.has(p.id))
  const items = parts.map((p) => {
    const r = reach(p.id)
    if (r.through) used.add(r.through)
    return { p, ...r }
  })
  // a resistor that is not in front of anything shows up as a part of its own
  for (const id of resistors) if (!used.has(id)) items.push({ p: d.parts.find((q) => q.id === id)!, signal: reach(id).signal, through: undefined })
  const ins = items.filter((i) => INPUTS.includes(i.p.type))
  const outs = items.filter((i) => !INPUTS.includes(i.p.type))
  const node = (id: string, kind: NodeData['kind'], x: number, y: number, label: string, icon: IconName, sub?: string): Node => ({
    id,
    type: kind === 'source' ? 'source' : 'card',
    position: { x, y },
    data: { kind, label, sub, icon, state: kind === 'board' ? state : 'done', onPick: () => onPick(id) },
    selected: picked === id,
    draggable: false,
  })
  const column = (n: number, i: number) => (i - (n - 1) / 2) * 78
  const nodes: Node[] = [
    ideaNode(false),
    node('usb', 'source', 50, 132, 'USB', 'bolt'),
    node(board.id, 'board', 0, 0, cap(KIND[board.type] ?? board.type), 'chip', `${items.length} ${items.length === 1 ? 'part' : 'parts'}`),
    ...ins.map((i, k) => node(i.p.id, 'part', -340, column(ins.length, k), i.p.id, PART_ICON[i.p.type] ?? 'box', KIND[i.p.type])),
    ...outs.map((i, k) => node(i.p.id, 'part', 360, column(outs.length, k), i.p.id, PART_ICON[i.p.type] ?? 'box', KIND[i.p.type])),
  ]
  const chipsOf = (i: (typeof items)[number]): Chip[] => [
    ...(i.signal.length ? [{ text: i.signal.map((s) => (/^\d+$/.test(s) ? `D${s}` : s)).join(' · ') }] : []),
    ...(i.through ? [{ text: ohms(d.parts.find((q) => q.id === i.through)?.attrs?.value), icon: 'resistor' as IconName }] : []),
  ]
  const line = (hot: boolean) => ({ stroke: hot ? 'var(--accent)' : 'var(--icon-2)', strokeWidth: 1.5 })
  const arrow = (hot: boolean) => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color: hot ? 'var(--accent)' : 'var(--icon-2)' })
  const edges: Edge[] = [
    { id: 'idea', source: 'idea', target: board.id, targetHandle: 'top', type: 'smoothstep', markerEnd: arrow(false), style: line(false), animated: state === 'work' },
    { id: 'usb', source: 'usb', target: board.id, targetHandle: 'bottom', type: 'smoothstep', style: { ...line(false), strokeDasharray: '4 3' } },
    ...ins.map((i) => ({ id: `in-${i.p.id}`, source: i.p.id, target: board.id, type: 'chip', data: { chips: chipsOf(i), hot: fresh === i.p.id, at: 'source' as const }, markerEnd: arrow(fresh === i.p.id), style: line(fresh === i.p.id) })),
    ...outs.map((i) => ({ id: `out-${i.p.id}`, source: board.id, target: i.p.id, type: 'chip', data: { chips: chipsOf(i), hot: fresh === i.p.id, at: 'target' as const }, markerEnd: arrow(fresh === i.p.id), style: line(fresh === i.p.id) })),
  ]
  return { nodes, edges }
}

function Path({ diagram, idea, picked, onPick, state }: { diagram: Diagram | null; idea: Idea; picked: string | null; onPick: (id: string | null) => void; state: NodeData['state'] }) {
  const flow = useReactFlow()
  // the part that came in last glows for a moment, the way a new connection lights up
  const seen = useRef(new Set<string>())
  const [fresh, setFresh] = useState<string>()
  useEffect(() => {
    const ids = (diagram?.parts ?? []).filter((p) => !BOARDS.includes(p.type)).map((p) => p.id)
    const added = ids.filter((id) => !seen.current.has(id))
    ids.forEach((id) => seen.current.add(id))
    if (added.length) {
      setFresh(added[added.length - 1])
      const t = setTimeout(() => setFresh(undefined), 1600)
      return () => clearTimeout(t)
    }
  }, [diagram])
  const laid = useMemo(() => layout(diagram, idea, picked, onPick, state, fresh), [diagram, idea.label, idea.sub, idea.badge, idea.lines?.join('\n'), picked, state, fresh])
  const hasBoard = !!diagram?.parts.some((p) => BOARDS.includes(p.type))
  const edges = laid.edges
  // react flow measures nodes through onNodesChange, so they live in state and keep their sizes across relayouts
  const [nodes, setNodes] = useState<Node[]>(laid.nodes)
  useEffect(() => {
    setNodes((old) => laid.nodes.map((n) => ({ ...old.find((o) => o.id === n.id), ...n, measured: old.find((o) => o.id === n.id)?.measured })))
  }, [laid])
  const onNodesChange = (changes: NodeChange[]) => setNodes((n) => applyNodeChanges(changes, n))
  // keep the whole path in view as it grows, and when the panel opens or closes. only once every node
  // has been measured, a fit before that leaves the new ones out
  const ready = useNodesInitialized()
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!ready || !box.current) return
    const t = setTimeout(() => {
      // centred in the room that is left: with the panel open the path moves over beside it
      const r = box.current!.getBoundingClientRect()
      const b = flow.getNodesBounds(flow.getNodes())
      const pad = { top: 80, bottom: 60, left: 60, right: picked ? 440 : 60 }
      const w = r.width - pad.left - pad.right
      const h = r.height - pad.top - pad.bottom
      // the open request card stays at reading size, a path gets fitted
      const zoom = Math.min(hasBoard ? 1.25 : 1, w / b.width, h / b.height)
      flow.setViewport({ x: pad.left + (w - b.width * zoom) / 2 - b.x * zoom, y: pad.top + (h - b.height * zoom) / 2 - b.y * zoom, zoom }, { duration: document.visibilityState === 'visible' ? 500 : 0 })
    }, 40)
    return () => clearTimeout(t)
  }, [ready, nodes.length, picked === null, hasBoard])
  return (
    <div ref={box} className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes} proOptions={{ hideAttribution: true }} nodesConnectable={false} elementsSelectable={false} panOnScroll minZoom={0.35} onPaneClick={() => onPick(null)} />
    </div>
  )
}

/* ---------- the panel ---------- */

function Cards({ items }: { items: [string, string][] }) {
  return (
    <div className="grid grid-cols-2 overflow-hidden rounded-[10px] border border-sep">
      {items.map(([k, v], i) => (
        <div key={k} className={`min-w-0 px-3 py-2.5 ${i % 2 ? 'border-l border-sep' : ''} ${i > 1 ? 'border-t border-sep' : ''}`}>
          <div className="text-[11.5px] text-dim">{k}</div>
          <div className="mt-0.5 truncate font-mono text-[15px] font-semibold text-ink">{v}</div>
        </div>
      ))}
    </div>
  )
}

function Heading({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-5 flex items-center justify-between text-[12.5px]">
      <span className="font-semibold text-ink">{children}</span>
      {right && <span className="text-[11.5px] text-dim">{right}</span>}
    </div>
  )
}

function Panel({ id, props }: { id: string; props: Props }) {
  const { diagram, source, test, runs, compiles, verdict, feed, request } = props
  if (id === 'guide') return diagram ? <BuildGuide diagram={diagram} /> : null
  if (id === 'idea')
    return (
      <>
        <p className="rounded-[9px] bg-input px-3 py-2.5 text-[13px] leading-5 text-ink">{request}</p>
        <Heading>What the agent said</Heading>
        <div className="space-y-1.5">
          {feed
            .filter((f) => f.kind === 'say')
            .map((f, i) => (
              <p key={i} className="text-[12px] leading-[18px] text-dim">
                {(f as { text: string }).text}
              </p>
            ))}
        </div>
      </>
    )
  if (id === 'usb')
    return (
      <>
        <Cards items={[['Supply', '5 V'], ['From', 'USB'], ['Limit', '500 mA'], ['Ground', 'shared']]} />
        <p className="mt-4 text-[12px] leading-[18px] text-dim">The board runs off the usb cable. Parts that need 5 V take it from the board, and every part shares its ground.</p>
      </>
    )
  const part = diagram?.parts.find((p) => p.id === id)
  if (!part || !diagram) return null
  const wires = diagram.connections.filter(([a, b]) => a.startsWith(`${part.id}:`) || b.startsWith(`${part.id}:`))
  if (BOARDS.includes(part.type)) {
    const last = compiles[compiles.length - 1]
    const run = runs[runs.length - 1]
    const num = (s?: string) => s?.split(' ')[0]
    return (
      <>
        <Cards items={[['Flash', num(last?.flash) ? `${num(last?.flash)} b` : '-'], ['Ram', num(last?.ram) ? `${num(last?.ram)} b` : '-'], ['Test runs', String(runs.length)], ['Result', verdict ? (verdict.ok ? 'proven' : 'not proven') : run ? (run.ok ? 'passing' : 'fixing') : '-']]} />
        <Heading>What you asked</Heading>
        <p className="rounded-[9px] bg-input px-3 py-2.5 text-[12.5px] leading-[19px] text-ink">{request}</p>
        {run && (
          <>
            <Heading right={`run ${runs.length}`}>Test</Heading>
            <div className="space-y-px">
              {run.steps.map((st, i) => (
                <div key={i} className="flex items-start gap-2 rounded-[6px] px-1 py-1 text-[11.5px] leading-4 hover:bg-hover">
                  <Status ok={!st.startsWith('FAIL')} size={14} />
                  <span className={`min-w-0 flex-1 break-words font-mono ${st.startsWith('FAIL') ? 'text-bad' : 'text-ink'}`}>{st.replace(/^(pass|FAIL) \d+ /, '')}</span>
                </div>
              ))}
            </div>
          </>
        )}
        <Heading right={source ? `${source.split('\n').length} lines` : undefined}>Firmware</Heading>
        <pre className="max-h-[38vh] overflow-auto rounded-[9px] bg-input px-3 py-2.5 font-mono text-[11px] leading-[18px] text-ink">{source || 'Not written yet.'}</pre>
        {test && (
          <>
            <Heading>test.yaml</Heading>
            <pre className="max-h-[30vh] overflow-auto rounded-[9px] bg-input px-3 py-2.5 font-mono text-[11px] leading-[17px] text-ink">{test}</pre>
          </>
        )}
        <Heading>The agent</Heading>
        <div className="space-y-1.5">
          {feed
            .filter((f) => f.kind === 'say')
            .slice(-6)
            .map((f, i) => (
              <p key={i} className="text-[12px] leading-[18px] text-dim">
                {(f as { text: string }).text}
              </p>
            ))}
        </div>
      </>
    )
  }
  const attrs = Object.entries(part.attrs ?? {})
  const cards: [string, string][] = [['Part', cap(KIND[part.type] ?? part.type)], ['Wires', String(wires.length)], ...attrs.map(([k, v]) => [cap(k), part.type === 'wokwi-resistor' && k === 'value' ? ohms(v) : v] as [string, string])]
  return (
    <>
      <Cards items={cards.slice(0, 4)} />
      <Heading>Wiring</Heading>
      <div className="space-y-px font-mono text-[11.5px]">
        {wires.map(([a, b, color], i) => {
          const mine = a.startsWith(`${part.id}:`) ? a : b
          const other = mine === a ? b : a
          return (
            <div key={i} className="flex items-center gap-2 rounded-[6px] px-1 py-1 hover:bg-hover">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: color || 'var(--icon-2)' }} />
              <span className="text-ink">{mine.split(':')[1]}</span>
              <Icon name="chevron-right" size={10} className="text-icon-2" />
              <span className="text-dim">{other}</span>
            </div>
          )
        })}
      </div>
    </>
  )
}

/* ---------- the page ---------- */

type Step = 'menu' | 'describe' | 'board' | 'example'

// the first thing someone sees: say what to make, or pick a board, and watch it come together as a path
export function Onboarding(props: Props) {
  const { busy, request, prompt, onPrompt, onStart, verdict, savedId, recent, examples, onEditor, onBlank, onReset, diagram, compiles, runs, feed } = props
  const [step, setStep] = useState<Step>('menu')
  const [picked, setPicked] = useState<string | null>(null)
  const [focus, setFocus] = useState(false)
  // an example opened from the card grows on the same canvas, it needs no agent
  const [shown, setShown] = useState<Saved | null>(null)
  const started = busy || !!request
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'describe') input.current?.focus()
  }, [step])
  // a proven build opens what you need to build it
  useEffect(() => {
    if (verdict?.ok) setPicked('guide')
  }, [verdict])

  // ideas and earlier requests that match what is being typed
  const q = prompt.trim().toLowerCase()
  const suggestions = [...IDEAS, ...recent.map((r) => r.request).filter((r): r is string => !!r)].filter((s, i, all) => all.indexOf(s) === i && (!q || s.toLowerCase().includes(q)) && s !== prompt).slice(0, 5)

  // where the agent is, in a few words for the pill at the top
  const tools = feed.filter((f) => f.kind === 'tool').map((f) => (f as { name: string }).name)
  const lastTool = tools[tools.length - 1]
  const phase = verdict
    ? verdict.ok
      ? 'Proven'
      : 'Not proven'
    : !diagram
      ? 'Picking a board and parts'
      : lastTool === 'write_sketch' || !props.source
        ? 'Writing the firmware'
        : lastTool === 'write_test'
          ? 'Writing the test'
          : lastTool === 'compile'
            ? 'Compiling'
            : lastTool === 'run_test'
              ? `Testing, run ${runs.length}`
              : compiles.length
                ? 'Fixing what failed'
                : 'Wiring'
  const boardState: NodeData['state'] = verdict ? (verdict.ok ? 'done' : 'fail') : busy ? 'work' : 'idle'

  const openId = shown?.id ?? savedId
  const top = (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-5">
      <button
        onClick={() => {
          if (busy) return
          setShown(null)
          setPicked(null)
          setStep('menu')
          onReset()
        }}
        title={busy ? 'the agent is building' : 'start over'}
        className="pointer-events-auto flex items-center gap-2 text-[13px] font-semibold text-ink"
      >
        <Logo size={18} />
        blinkproof
      </button>
      <span className={`pointer-events-auto flex items-center gap-1.5 transition-[margin] duration-300 ease-out ${picked ? 'mr-[380px]' : ''}`}>
        {(started || shown) && (
          <button onClick={() => onEditor(openId)} disabled={!openId} className="flex h-8 items-center rounded-[8px] px-2.5 text-[12px] font-medium text-dim hover:bg-hover hover:text-ink disabled:opacity-40">
            Open in the editor
          </button>
        )}
        <button onClick={() => onEditor()} title="skip onboarding and go to the editor" className="flex h-8 items-center gap-1 rounded-[8px] border border-line bg-panel px-3 text-[12px] font-medium text-ink hover:bg-hover">
          Skip
          <Icon name="chevron-right" size={11} />
        </button>
      </span>
    </div>
  )

  if (!started && !shown)
    return (
      <div className="relative flex h-full flex-col items-center justify-center bg-canvas px-6 pb-20">
        {top}
        <div className="mb-7">
          <Logo size={40} />
        </div>
        {step === 'menu' && (
          <div className="rise w-full max-w-[400px]">
            <Frame
              footer={
                <button onClick={() => onEditor()} className="flex w-full items-center justify-between px-3.5 py-2.5 text-[13px] text-dim hover:text-ink">
                  Open the editor
                  <Icon name="chevron-right" size={12} />
                </button>
              }
            >
              <Row icon="magic-wand" title="Describe a gadget" line="The agent builds it and proves it works" onClick={() => setStep('describe')} />
              <Row icon="chip" title="Pick a board" line="An Uno, a Nano or a Pico, wire it yourself" onClick={() => setStep('board')} />
              <Row icon="book-open" title="Open an example" line="A parking sensor, a plant monitor and more" onClick={() => setStep('example')} />
            </Frame>
          </div>
        )}
        {step === 'describe' && (
          <div className="rise w-full max-w-[460px]">
            <Tab label="Describe a gadget" onBack={() => setStep('menu')} />
            <Frame>
              <form onSubmit={(e) => (e.preventDefault(), prompt.trim() && onStart())} className="flex items-center">
                <Icon name="magic-wand" size={16} className="ml-3 text-icon-2" />
                <input
                  ref={input}
                  value={prompt}
                  onChange={(e) => onPrompt(e.target.value)}
                  onFocus={() => setFocus(true)}
                  onBlur={() => setTimeout(() => setFocus(false), 120)}
                  onKeyDown={(e) => e.key === 'Escape' && setStep('menu')}
                  placeholder="a night light that turns on when you press a button"
                  className="h-11 min-w-0 flex-1 bg-transparent px-2.5 text-[14px] text-ink outline-none placeholder:text-dim"
                />
                <button type="submit" disabled={!prompt.trim()} title="build it" className="flex h-11 w-11 items-center justify-center border-l border-sep text-icon hover:bg-hover disabled:opacity-40">
                  <Icon name="chevron-right" size={14} />
                </button>
              </form>
            </Frame>
            {focus && suggestions.length > 0 && (
              <div className="rise mx-auto mt-1.5 w-[86%] overflow-hidden rounded-[10px] border border-line bg-panel py-1 shadow-[0_8px_24px_rgba(0,0,0,.08)]">
                {suggestions.map((s) => (
                  <button key={s} onMouseDown={(e) => (e.preventDefault(), onPrompt(s))} className="block w-full truncate px-3.5 py-2 text-left text-[13px] text-ink hover:bg-hover">
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {step === 'board' && (
          <div className="rise w-full max-w-[400px]">
            <Tab label="Pick a board" onBack={() => setStep('menu')} />
            <Frame>
              <Row icon="frame" title="Arduino Uno" line="5 V, 14 digital pins, 6 analog, 2 kb of ram" onClick={() => onBlank('uno')} />
              <Row icon="frame" title="Arduino Nano" line="The Uno's chip on a small board" onClick={() => onBlank('nano')} />
              <Row icon="chip" title="Raspberry Pi Pico" line="3.3 V, rp2040, 264 kb of ram" onClick={() => onBlank('pico')} />
            </Frame>
          </div>
        )}
        {step === 'example' && (
          <div className="rise w-full max-w-[400px]">
            <Tab label="Open an example" onBack={() => setStep('menu')} />
            <Frame>
              <div className="max-h-[360px] overflow-auto">
                {examples.map((ex) => (
                  <Row key={ex.id} icon={ex.diagram?.parts.some((p) => p.type === 'wokwi-pi-pico') ? 'chip' : 'frame'} title={ex.title} line={ex.status === 'proven' ? 'With a test that passes' : 'A sketch to run and change'} onClick={() => api.get(ex.id).then((full) => full && (setShown(full), setPicked('guide')))} />
                ))}
              </div>
            </Frame>
          </div>
        )}
      </div>
    )

  // the same canvas from here on: the request is the first node, and the board and its parts grow from it
  const ideaLines = feed.filter((f) => f.kind === 'say').slice(-3).map((f) => (f as { text: string }).text)
  const idea = shown
    ? { label: shown.title, sub: shown.test ? 'example, with a passing test' : 'example' }
    : { label: cap(request.split(/[:.]/)[0]), sub: verdict ? (verdict.ok ? 'proven' : 'not proven') : 'the agent is building it', lines: ideaLines, badge: 'Building' }
  const pathDiagram = shown ? (shown.diagram ?? null) : diagram
  const pathState: NodeData['state'] = shown ? (shown.test ? 'done' : 'idle') : boardState
  return (
    <div className="relative flex h-full overflow-hidden bg-canvas">
      {top}
      {!shown && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
          <button onClick={() => verdict?.ok && setPicked('guide')} className={`pointer-events-auto flex h-8 items-center gap-2 rounded-full border bg-panel px-3.5 text-[12px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,.04)] ${verdict ? (verdict.ok ? 'border-ok/40' : 'border-bad/40') : 'border-line'}`}>
            {verdict ? <Status ok={verdict.ok} size={14} /> : <span className="h-2 w-2 animate-pulse rounded-full bg-accent" />}
            {phase}
            {verdict?.ok && <span className="text-dim">· what you need to build it</span>}
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <ReactFlowProvider>
          <Path diagram={pathDiagram} idea={idea} picked={picked} onPick={setPicked} state={pathState} />
        </ReactFlowProvider>
      </div>
      <aside className={`absolute bottom-0 right-0 top-0 z-30 flex w-[380px] flex-col border-l border-line bg-panel transition-transform duration-300 ease-out ${picked ? 'translate-x-0 shadow-[-16px_0_40px_rgba(0,0,0,.06)]' : 'translate-x-full'}`}>
        {picked && (
          <>
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-sep px-4">
              <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium text-ink">
                <Icon name={picked === 'guide' ? 'box' : picked === 'usb' ? 'bolt' : picked === 'idea' ? 'magic-wand' : (PART_ICON[diagram?.parts.find((p) => p.id === picked)?.type ?? ''] ?? 'chip')} size={15} className="text-icon" />
                <span className="truncate">{picked === 'guide' ? 'What you need to build it' : picked === 'usb' ? 'Power' : picked === 'idea' ? 'What you asked' : picked}</span>
              </span>
              <button onClick={() => setPicked(null)} title="close" className="flex h-7 w-7 items-center justify-center rounded-full text-icon-2 hover:bg-hover hover:text-ink">
                <Icon name="xmark" size={12} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <Panel id={picked} props={shown ? { ...props, diagram: shown.diagram ?? null, source: shown.sketch, test: shown.test, request: shown.title, runs: [], compiles: [], verdict: null, feed: [] } : props} />
            </div>
            {openId && (
              <div className="border-t border-sep p-3">
                <button onClick={() => onEditor(openId)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-accent text-[12.5px] font-semibold text-on-accent">
                  Open in the editor
                  <Icon name="chevron-right" size={12} />
                </button>
              </div>
            )}
          </>
        )}
      </aside>
    </div>
  )
}
