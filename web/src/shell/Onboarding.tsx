import { BaseEdge, EdgeLabelRenderer, applyNodeChanges, type NodeChange, Handle, MarkerType, Position, ReactFlow, ReactFlowProvider, getSmoothStepPath, useNodesInitialized, useReactFlow, type Edge, type EdgeProps, type Node, type NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/base.css'
import { connect, freePins, proto, schematic, type Diagram, type PARTS } from '@blinkproof/sim'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Icon, Logo, type IconName } from '../icons/Icon'
import { PART_ICON, Status } from '../icons/Status'
import { BreadboardGuide, ShoppingList } from './Breadboard'
import { SheetCard } from './Schematic'
import { PartFacts } from './Facts'
import { Account } from './Account'
import { api, pending, type Saved, type useMe } from './library'
import { useSampler, type Happening, type Live, type Point } from '../lib/live'
import { Workbench, type BenchState } from '../Workbench'
import type { Bench } from '@blinkproof/sim'
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
  // a circuit wired by hand here, and what it should do: the agent writes the code and the test for it
  onBuildCircuit: (what: string, circuit: Diagram) => void
  me: ReturnType<typeof useMe>
}

const BOARDS = ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-pi-pico']
const INPUTS = ['wokwi-pushbutton', 'wokwi-potentiometer', 'wokwi-hc-sr04', 'wokwi-photoresistor-sensor', 'wokwi-dht22', 'wokwi-pir-motion-sensor', 'wokwi-slide-switch']
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
      <Icon name="plus" size={13} className="text-icon-2 transition-colors group-hover:text-accent-line" />
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

type NodeData = { kind: 'board' | 'part'; label: string; sub?: string; icon: IconName; state: 'work' | 'done' | 'fail' | 'idle'; onPick: () => void }

type IdeaData = { label: string; sub?: string; lines?: string[]; open: boolean; badge?: string; onPick: () => void }

// what you asked for. while the agent is still picking parts it is the card you typed into, with what the agent
// says inside it. once there is a board it folds into a node at the top of the path
function IdeaNode({ data, selected }: NodeProps<Node<IdeaData>>) {
  return (
    <button className={`rise block rounded-[14px] border p-[3px] text-left transition-all duration-300 ${selected ? 'border-accent-line/60 bg-accent/10' : 'border-line/80 bg-input/60'} ${data.open ? 'w-[420px]' : 'w-[264px]'}`}>
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <span className={`block overflow-hidden rounded-[11px] border bg-panel ${selected ? 'border-accent-line' : 'border-line'}`}>
        <span className={`flex items-center gap-2.5 ${data.open ? 'border-b border-sep px-3.5 py-2.5' : 'px-3 py-2'}`}>
          <Icon name="magic-wand" size={15} className="text-icon" />
          <span className="min-w-0 flex-1">
            <span className={`block truncate font-medium text-ink ${data.open ? 'text-[14px]' : 'max-w-[230px] text-[13px]'}`}>{data.label}</span>
            {!data.open && data.sub && <span className="line-clamp-2 block max-w-[230px] text-[11px] leading-[15px] text-dim">{data.sub}</span>}
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
          It has to pass its test before you get it
        </span>
      )}
    </button>
  )
}

type Side = 'in' | 'out'
type Menu = { side: Side; type?: keyof typeof PARTS }
type Hand = { menu: Menu | null; board: string; options: (type: keyof typeof PARTS) => { pin: string; label: string }[]; onPlus: (side: Side) => void; onPart: (type: keyof typeof PARTS) => void; onPin: (pin?: string) => void; onBack: () => void }

const CHOICES: Record<Side, [keyof typeof PARTS, string, string][]> = {
  in: [
    ['wokwi-pushbutton', 'Button', 'Read a press'],
    ['wokwi-slide-switch', 'Slide switch', 'On or off, stays put'],
    ['wokwi-potentiometer', 'Knob', 'A dial read with analogRead'],
    ['wokwi-hc-sr04', 'Ultrasonic sensor', 'Distance from 2 to 400 cm'],
    ['wokwi-photoresistor-sensor', 'Light sensor', 'How bright the room is'],
    ['wokwi-dht22', 'Temperature sensor', 'Degrees and humidity, one wire'],
    ['wokwi-pir-motion-sensor', 'Motion sensor', 'Notices someone walking by'],
  ],
  out: [
    ['wokwi-led', 'LED', 'Light from a pin, resistor included'],
    ['wokwi-buzzer', 'Buzzer', 'Beeps and tunes'],
    ['wokwi-led-ring', 'LED ring', '16 colour pixels on one pin'],
    ['wokwi-rgb-led', 'RGB LED', 'Mix any colour'],
    ['wokwi-7segment', '7 segment digit', 'Shows one number'],
    ['wokwi-ssd1306', 'OLED screen', '128 by 64 pixels'],
    ['wokwi-lcd1602', 'LCD 16x2', 'Two rows of text'],
    ['wokwi-servo', 'Servo', 'Turns to an angle'],
  ],
}

// the blue + at the end of a dashed lead, it turns into a cross while its menu is open
function PlusNode({ data }: NodeProps<Node<{ open: boolean; side: Side; onClick: () => void }>>) {
  return (
    <button onClick={data.onClick} title={data.side === 'in' ? 'connect an input' : 'connect an output'} className="nodrag flex h-7 w-7 items-center justify-center rounded-[8px] bg-accent hover:bg-accent-hover text-on-accent shadow-[0_1px_3px_rgba(0,0,0,.15)] transition-transform hover:scale-105">
      <Handle type="target" id="top" position={Position.Top} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Icon name={data.open ? 'xmark' : 'plus'} size={data.open ? 11 : 15} />
    </button>
  )
}

// the menu hanging off a +: first which part, then which pin, each with a tab to go back the way it came
function MenuNode({ data }: NodeProps<Node<{ hand: Hand }>>) {
  const { hand } = data
  const menu = hand.menu!
  const choice = CHOICES[menu.side].find(([t]) => t === menu.type)
  return (
    <div className="nodrag nopan nowheel w-[290px]" onPointerDown={(e) => e.stopPropagation()}>
      <div className="flex">
        <button onClick={menu.type ? hand.onBack : undefined} className="-mb-px flex h-8 items-center gap-1.5 rounded-t-[10px] border border-b-0 border-line bg-input/70 px-3 text-[12.5px] font-medium text-dim hover:text-ink">
          {menu.type && <Icon name="chevron-left" size={11} />}
          {menu.type ? `Connect ${/^(LED|OLED|[aeiou])/i.test(choice?.[1] ?? '') ? 'an' : 'a'} ${choice?.[1]}` : `Connect ${menu.side === 'in' ? 'an input' : 'an output'} to ${hand.board}`}
        </button>
      </div>
      <Frame className="rounded-tl-none">
        {!menu.type &&
          CHOICES[menu.side].map(([type, name, line]) => (
            <button key={type} onClick={() => hand.onPart(type)} className="flex w-full items-center gap-2.5 border-t border-sep px-3 py-2 text-left first:border-t-0 hover:bg-hover">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] border border-sep bg-input/70 text-icon">
                <Icon name={PART_ICON[type] ?? 'box'} size={14} />
              </span>
              <span className="min-w-0">
                <span className="block text-[13px] font-medium text-ink">{name}</span>
                <span className="block truncate text-[11.5px] text-dim">{line}</span>
              </span>
            </button>
          ))}
        {menu.type && (
          <>
            <button onClick={() => hand.onPin()} className="flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-hover">
              <Icon name="sparkle-3" size={14} className="text-icon" />
              <span className="flex-1 text-[13px] font-medium text-ink">Pick for me</span>
              <span className="text-[11px] text-dim">a free pin that fits</span>
            </button>
            {hand.options(menu.type).slice(0, 5).map((o) => (
              <button key={o.pin} onClick={() => hand.onPin(o.pin)} className="flex w-full items-center gap-2.5 border-t border-sep px-3 py-2 text-left hover:bg-hover">
                <Icon name="wire" size={14} className="text-icon-2" />
                <span className="flex-1 font-mono text-[12.5px] text-ink">{o.label}</span>
                <span className="text-[11px] text-dim">free</span>
              </button>
            ))}
          </>
        )}
      </Frame>
    </div>
  )
}

function CardNode({ data, selected }: NodeProps<Node<NodeData>>) {
  const dot = data.state === 'done' ? 'bg-ok' : data.state === 'fail' ? 'bg-bad' : data.state === 'work' ? 'bg-accent hover:bg-accent-hover animate-pulse' : 'bg-icon-2/50'
  const big = data.kind === 'board'
  return (
    <button className={`rise block rounded-[12px] border p-[3px] transition-colors ${selected ? 'border-accent-line/60 bg-accent/10' : 'border-line/80 bg-input/60'}`}>
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="target" id="top" position={Position.Top} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <span className={`flex items-center gap-2.5 rounded-[9px] border bg-panel ${selected ? 'border-accent-line' : 'border-line'} ${big ? 'px-3.5 py-2.5' : 'px-3 py-2'}`}>
        <Icon name={data.icon} size={big ? 17 : 15} className="text-icon" />
        <span className="text-left">
          <span className={`block font-medium text-ink ${big ? 'text-[14px]' : 'text-[13px]'}`}>{data.label}</span>
          {data.sub && <span className="block max-w-[170px] truncate text-[11px] text-dim">{data.sub}</span>}
        </span>
        <span className={`ml-1.5 h-2.5 w-2.5 rounded-full ${dot}`} />
      </span>
    </button>
  )
}

export type StepData = { title: string; line: string; icon: IconName; state: 'wait' | 'work' | 'done' | 'fail' | 'next'; onPick?: () => void }

// one stop on the line, saying in a few words what the agent is doing there. not reached yet it is dashed and faint
function StepNode({ data, selected }: NodeProps<Node<StepData>>) {
  const wait = data.state === 'wait'
  const dot = data.state === 'done' ? 'bg-ok' : data.state === 'fail' ? 'bg-bad' : data.state === 'work' ? 'bg-accent hover:bg-accent-hover animate-pulse' : data.state === 'next' ? 'hidden' : 'bg-icon-2/40'
  return (
    <button disabled={wait} className={`block w-[212px] rounded-[12px] border p-[3px] text-left transition-all duration-300 ${wait ? 'border-dashed border-line opacity-55' : selected ? 'border-accent-line/60 bg-accent/10' : data.state === 'work' ? 'border-accent-line/40 bg-accent/5' : 'border-line/80 bg-input/60'}`}>
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="source" position={Position.Right} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="target" id="top" position={Position.Top} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Handle type="source" id="bottom" position={Position.Bottom} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <span className={`flex items-center gap-2.5 rounded-[9px] px-3 py-2 ${wait ? '' : `border bg-panel ${selected ? 'border-accent-line' : 'border-line'}`}`}>
        <Icon name={data.state === 'work' ? 'loader' : data.icon} size={15} className={data.state === 'work' ? 'animate-spin text-accent-line' : 'text-icon'} />
        <span className="min-w-0 flex-1">
          <span className="block text-[13px] font-medium text-ink">{data.title}</span>
          <span className={`block truncate text-[11px] ${data.state === 'fail' ? 'text-bad' : 'text-dim'}`}>{data.line}</span>
        </span>
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dot}`} />
      </span>
    </button>
  )
}

type Chip = { text: string; icon?: IconName }

// an edge with the wiring on it: the pin it lands on, and the resistor it goes through, as little chips
function ChipEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, style }: EdgeProps<Edge<{ chips: Chip[]; hot?: boolean; at?: 'source' | 'target' }>>) {
  const [path] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, borderRadius: 10 })
  // the chips sit on the part's own leg of the edge, so branches off one pin do not pile them up
  const [lx, ly] = data?.at === 'source' ? [sourceX, sourceY + 30] : [targetX, targetY - 30]
  const chips = data?.chips ?? []
  return (
    <>
      <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />
      <EdgeLabelRenderer>
        {chips.length > 0 && (
          <div className="nodrag nopan absolute flex items-center gap-1" style={{ transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)` }}>
            {chips.map((c, i) => (
              <span key={i} className={`flex h-6 items-center gap-1 rounded-[7px] border bg-panel px-1.5 font-mono text-[10.5px] shadow-[0_1px_1px_rgba(0,0,0,.04)] ${data?.hot ? 'border-accent-line text-accent-line' : 'border-line text-dim'}`}>
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

type Sim = { diagram: Diagram; source: string; title: string; onState: (s: BenchState) => void; bench: { current: Bench | null } }

// the end of the line: the gadget itself, drawn the way the editor draws it and running the firmware that passed.
// press its button, turn its knob, slide the car closer
function SimNode({ data }: NodeProps<Node<{ sim: Sim }>>) {
  const { sim } = data
  const flow = useReactFlow()
  const [close, setClose] = useState(false)
  const fly = () => {
    const duration = document.visibilityState === 'visible' ? 450 : 0
    if (close) flow.fitView({ padding: 0.08, duration })
    else flow.fitView({ nodes: [{ id: 'sim' }], padding: 0.04, maxZoom: 2, duration })
    setClose(!close)
  }
  return (
    <div className="rise nodrag nopan nowheel w-[660px] cursor-default">
      <Handle type="target" position={Position.Left} className="!h-1 !w-1 !min-w-0 !border-0 !bg-transparent" />
      <Frame>
        <div className="flex items-center gap-2.5 border-b border-sep px-3.5 py-2.5">
          <Icon name="play" size={14} className="text-icon" />
          <span className="flex-1 text-[13.5px] font-medium text-ink">Simulation</span>
          <span className="flex items-center gap-1.5 text-[11.5px] text-dim">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-ok" />
            running, try the parts
          </span>
          <button onClick={fly} title={close ? 'back to the whole line' : 'zoom in on the circuit'} className="ml-1 flex h-7 items-center gap-1.5 rounded-[7px] border border-line px-2 text-[11.5px] font-medium text-ink hover:bg-hover">
            <Icon name={close ? 'collapse' : 'full-screen-2'} size={12} />
            {close ? 'Back' : 'Zoom in'}
          </button>
        </div>
        <div className="h-[420px]">
          <Workbench diagram={sim.diagram} source={sim.source} title={sim.title} compact running onState={sim.onState} benchOut={sim.bench} />
        </div>
      </Frame>
    </div>
  )
}

const nodeTypes = { step: StepNode, sim: SimNode, card: CardNode, idea: IdeaNode, plus: PlusNode, menu: MenuNode }
const edgeTypes = { chip: ChipEdge }

type Idea = Omit<IdeaData, 'onPick' | 'open'>
export type Stop = StepData & { id: string }

const line = (hot: boolean, faint?: boolean) => ({ stroke: hot ? 'var(--accent-line)' : 'var(--icon-2)', strokeWidth: 1.5, ...(faint ? { strokeDasharray: '4 4', opacity: 0.6 } : {}) })
const arrow = (hot: boolean) => ({ type: MarkerType.ArrowClosed, width: 14, height: 14, color: hot ? 'var(--accent-line)' : 'var(--icon-2)' })

// one line read left to right: what you asked, the board with its parts hanging off it, then the firmware, the
// test and the result. inputs sit above the board and feed down into it, outputs hang below it
function layout(d: Diagram | null, idea: Idea | null, picked: string | null, onPick: (id: string) => void, state: NodeData['state'], fresh: string | undefined, hand?: Hand, lines?: Record<string, string>, stops: Stop[] = [], sim?: Sim) {
  const board = d?.parts.find((p) => BOARDS.includes(p.type))
  const nodes: Node[] = []
  const edges: Edge[] = []
  const open = !!idea && !board
  if (idea) nodes.push({ id: 'idea', type: 'idea', position: { x: 0, y: open ? -40 : -6 }, data: { ...idea, open, badge: open ? idea.badge : undefined, onPick: () => onPick('idea') }, selected: picked === 'idea', draggable: false })
  const x0 = !idea ? 0 : open ? 500 : 340
  const GAP = 270
  let prev = idea ? 'idea' : null
  const link = (to: string, s: Stop['state']) => {
    if (prev) edges.push({ id: `${prev}-${to}`, source: prev, target: to, type: 'smoothstep', markerEnd: arrow(s === 'work'), style: line(s === 'work', s === 'wait'), animated: s === 'work' })
    prev = to
  }
  // no board yet: a stop that says the agent is picking parts
  if (!board) {
    const pick: Stop = { id: 'idea-parts', title: 'Board and parts', line: 'picking parts...', icon: 'chip', state: 'work', onPick: () => onPick('idea') }
    nodes.push({ id: pick.id, type: 'step', position: { x: x0, y: 0 }, data: pick, draggable: false })
    link(pick.id, 'work')
  }
  if (board) {
    const resistors = new Set(d!.parts.filter((p) => p.type === 'wokwi-resistor').map((p) => p.id))
    const peers = (ref: string) => d!.connections.filter(([a, b]) => a === ref || b === ref).map(([a, b]) => (a === ref ? b : a))
    // what a part's signal pins reach on the board, straight or through a resistor
    const reach = (id: string) => {
      const pins: string[] = []
      let through: string | undefined
      for (const [a, b] of d!.connections) {
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
    const items = d!.parts
      .filter((p) => p !== board && !p.hide && !resistors.has(p.id))
      .map((p) => {
        const r = reach(p.id)
        if (r.through) used.add(r.through)
        return { p, ...r }
      })
    // a resistor that is not in front of anything shows up as a part of its own
    for (const id of resistors) if (!used.has(id)) items.push({ p: d!.parts.find((q) => q.id === id)!, signal: reach(id).signal, through: undefined })
    const ins = items.filter((i) => INPUTS.includes(i.p.type))
    const outs = items.filter((i) => !INPUTS.includes(i.p.type))
    const card = (id: string, kind: NodeData['kind'], x: number, y: number, label: string, icon: IconName, sub?: string): Node => ({
      id,
      type: 'card',
      position: { x, y },
      data: { kind, label, sub, icon, state: kind === 'board' ? state : 'done', onPick: () => onPick(id) },
      selected: picked === id,
      draggable: false,
    })
    nodes.push(card(board.id, 'board', x0, -2, cap(KIND[board.type] ?? board.type), 'chip', `${items.length} ${items.length === 1 ? 'part' : 'parts'}`))
    link(board.id, state === 'work' && !stops.some((s) => s.state !== 'wait') ? 'work' : 'done')
    // a row of parts centred on the board, room left at the end for the + when wiring by hand
    const row = (n: number, i: number) => x0 + 100 + (i - (n - 1) / 2 + (hand ? -0.5 : 0)) * 220 - 95
    const chipsOf = (i: (typeof items)[number]): Chip[] => [
      ...(i.signal.length ? [{ text: i.signal.map((s) => (/^\d+$/.test(s) ? `D${s}` : s)).join(' · ') }] : []),
      ...(i.through ? [{ text: ohms(d!.parts.find((q) => q.id === i.through)?.attrs?.value), icon: 'resistor' as IconName }] : []),
    ]
    ins.forEach((i, k) => {
      nodes.push(card(i.p.id, 'part', row(ins.length, k), -170, i.p.id, PART_ICON[i.p.type] ?? 'box', lines?.[i.p.id] ?? KIND[i.p.type]))
      edges.push({ id: `in-${i.p.id}`, source: i.p.id, sourceHandle: 'bottom', target: board.id, targetHandle: 'top', type: 'chip', data: { chips: chipsOf(i), hot: fresh === i.p.id, at: 'source' as const }, markerEnd: arrow(fresh === i.p.id), style: line(fresh === i.p.id) })
    })
    outs.forEach((i, k) => {
      nodes.push(card(i.p.id, 'part', row(outs.length, k), 170, i.p.id, PART_ICON[i.p.type] ?? 'box', lines?.[i.p.id] ?? KIND[i.p.type]))
      edges.push({ id: `out-${i.p.id}`, source: board.id, sourceHandle: 'bottom', target: i.p.id, targetHandle: 'top', type: 'chip', data: { chips: chipsOf(i), hot: fresh === i.p.id, at: 'target' as const }, markerEnd: arrow(fresh === i.p.id), style: line(fresh === i.p.id) })
    })
    // building by hand: a + at the end of each row, and the menu of whichever is open
    if (hand) {
      for (const side of ['in', 'out'] as Side[]) {
        const list = side === 'in' ? ins : outs
        const at = { x: row(list.length + 1, list.length) + 80, y: side === 'in' ? -150 : 182 }
        const isOpen = hand.menu?.side === side
        nodes.push({ id: `plus-${side}`, type: 'plus', position: at, data: { open: isOpen, side, onClick: () => hand.onPlus(side) }, draggable: false })
        const lead = { stroke: isOpen ? 'var(--accent-line)' : 'var(--icon-2)', strokeWidth: 1.5, strokeDasharray: '4 4' }
        edges.push(side === 'in' ? { id: 'lead-in', source: 'plus-in', sourceHandle: 'bottom', target: board.id, targetHandle: 'top', type: 'smoothstep', style: lead } : { id: 'lead-out', source: board.id, sourceHandle: 'bottom', target: 'plus-out', targetHandle: 'top', type: 'smoothstep', style: lead })
        if (isOpen) nodes.push({ id: 'menu', type: 'menu', position: { x: at.x + 44, y: side === 'in' ? at.y - 150 : at.y - 30 }, data: { hand }, draggable: false, zIndex: 10 })
      }
    }
  }
  // the line runs to the proof, what you do with it after hangs down from there like a checklist
  const main = stops.filter((st) => st.state !== 'next')
  main.forEach((st, i) => {
    nodes.push({ id: st.id, type: 'step', position: { x: x0 + GAP * (i + 1), y: 0 }, data: { ...st, onPick: st.state === 'wait' ? undefined : () => onPick(st.id) }, selected: picked === st.id, draggable: false })
    link(st.id, st.state)
  })
  if (sim) {
    const from = prev
    nodes.push({ id: 'sim', type: 'sim', position: { x: x0 + GAP * (main.length + 1), y: -212 }, data: { sim }, draggable: false })
    edges.push({ id: `${from}-sim`, source: from!, target: 'sim', type: 'smoothstep', markerEnd: arrow(false), style: line(false) })
  }
  stops
    .filter((st) => st.state === 'next')
    .forEach((st, k) => {
      nodes.push({ id: st.id, type: 'step', position: { x: x0 + GAP * main.length, y: 104 + k * 96 }, data: { ...st, onPick: () => onPick(st.id) }, selected: picked === st.id, draggable: false })
      edges.push({ id: `${prev}-${st.id}`, source: prev!, sourceHandle: 'bottom', target: st.id, targetHandle: 'top', type: 'smoothstep', markerEnd: arrow(false), style: line(false) })
      prev = st.id
    })
  return { nodes, edges }
}

function Path({ diagram, idea, picked, onPick, state, hand, lines, stops, sim }: { diagram: Diagram | null; idea: Idea | null; picked: string | null; onPick: (id: string | null) => void; state: NodeData['state']; hand?: Hand; lines?: Record<string, string>; stops?: Stop[]; sim?: Sim }) {
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
  const liveKey = lines ? Object.entries(lines).map(([k, v]) => k + v).join('|') : ''
  const stopKey = (stops ?? []).map((s) => s.id + s.state + s.line).join('|')
  const laid = useMemo(() => layout(diagram, idea, picked, onPick, state, fresh, hand, lines, stops, sim), [diagram, idea?.label, idea?.sub, idea?.badge, idea?.lines?.join('\n'), picked, state, fresh, hand?.menu?.side, hand?.menu?.type, !!hand, liveKey, stopKey, sim?.source, sim?.diagram])
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
      const pad = { top: 80, bottom: 60, left: 60, right: picked ? (picked === 'wiring' ? 680 : picked === 'schematic' ? 620 : 440) : 60 }
      const w = r.width - pad.left - pad.right
      const h = r.height - pad.top - pad.bottom
      // the open request card stays at reading size, a path gets fitted
      const zoom = Math.min(1.1, w / b.width, h / b.height)
      flow.setViewport({ x: pad.left + (w - b.width * zoom) / 2 - b.x * zoom, y: pad.top + (h - b.height * zoom) / 2 - b.y * zoom, zoom }, { duration: document.visibilityState === 'visible' ? 500 : 0 })
    }, 40)
    return () => clearTimeout(t)
  }, [ready, nodes.length, picked === null, picked === 'wiring', picked === 'schematic', hasBoard])
  return (
    <div ref={box} className="h-full w-full">
      <ReactFlow nodes={nodes} edges={edges} onNodesChange={onNodesChange} nodeTypes={nodeTypes} edgeTypes={edgeTypes} proOptions={{ hideAttribution: true }} nodesConnectable={false} elementsSelectable={false} panOnScroll minZoom={0.35} onNodeClick={(_, n) => (n.data as { onPick?: () => void }).onPick?.()} onPaneClick={() => onPick(null)} />
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

const stamp = (ms: number) => {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}.${String(Math.floor(ms % 1000)).padStart(3, '0')}`
}

// one value over the last stretch of the run, a soft area under a line
function Chart({ points, max, unit, title }: { points: Point[]; max?: number; unit?: string; title: string }) {
  const W = 340
  const H = 96
  const top = Math.max(1, max ?? 0, ...points.map((p) => p.v))
  const from = points[0]?.ms ?? 0
  const to = points[points.length - 1]?.ms ?? 1
  const x = (ms: number) => ((ms - from) / Math.max(1, to - from)) * W
  const y = (v: number) => H - 6 - (v / top) * (H - 14)
  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.ms).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ')
  return (
    <div>
      <div className="mb-2 flex items-center justify-between text-[12.5px]">
        <span className="font-semibold text-ink">{title}</span>
        <span className="text-[11.5px] text-dim">
          up to {top}
          {unit ? ` ${unit}` : ''}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="block w-full" style={{ height: H }}>
        <line x1="0" x2={W} y1={H / 2} y2={H / 2} stroke="var(--separator)" />
        {points.length > 1 && (
          <>
            <path d={`${line} L${W} ${H} L0 ${H} Z`} fill="var(--accent-line)" opacity="0.09" />
            <path d={line} fill="none" stroke="var(--accent-line)" strokeWidth="1.6" strokeLinejoin="round" />
          </>
        )}
      </svg>
      <div className="mt-1 flex justify-between font-mono text-[10.5px] text-dim">
        <span>{stamp(from).slice(0, 5)}</span>
        <span>now</span>
      </div>
    </div>
  )
}

function Logs({ items, live }: { items: Happening[]; live: boolean }) {
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (list.current) list.current.scrollTop = list.current.scrollHeight
  }, [items.length])
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-[12.5px]">
        <span className="font-semibold text-ink">Logs</span>
        <span className="flex items-center gap-1.5 text-[11.5px] text-dim">
          <span className={`h-1.5 w-1.5 rounded-full ${live ? 'animate-pulse bg-ok' : 'bg-icon-2/60'}`} />
          {live ? 'Live' : 'Off'}
        </span>
      </div>
      <div ref={list} className="max-h-[220px] overflow-auto font-mono text-[11.5px] leading-[22px]">
        {items.length === 0 && <p className="font-sans text-[12px] text-dim">Nothing yet.</p>}
        {items.map((h, i) => (
          <div key={i} className="flex items-center gap-2.5 rounded-[5px] px-1 hover:bg-hover">
            <span className="shrink-0 text-dim">{stamp(h.ms)}</span>
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${h.tone === 'bad' ? 'bg-bad' : h.tone === 'ok' ? 'bg-ok' : 'bg-icon-2/50'}`} />
            <span className="min-w-0 flex-1 truncate text-ink" title={h.text}>
              {h.text || '\u00a0'}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

// a person at the bench: turn the knob, move the hand in front of the sensor, hold the button
function Control({ type, id, live, value }: { type: string; id: string; live: Live; value?: number }) {
  if (type === 'wokwi-potentiometer')
    return (
      <label className="flex items-center gap-3 rounded-[9px] border border-sep px-3 py-2.5 text-[12px] text-dim">
        Turn it
        <input type="range" min={0} max={100} defaultValue={value ?? 0} onChange={(e) => live.control(id, 'position', Number(e.target.value) / 100)} className="min-w-0 flex-1 accent-[var(--accent-line)]" />
      </label>
    )
  if (type === 'wokwi-hc-sr04')
    return (
      <label className="flex items-center gap-3 rounded-[9px] border border-sep px-3 py-2.5 text-[12px] text-dim">
        Distance
        <input type="range" min={2} max={400} defaultValue={value ?? 200} onChange={(e) => live.control(id, 'distance', Number(e.target.value))} className="min-w-0 flex-1 accent-[var(--accent-line)]" />
      </label>
    )
  if (type === 'wokwi-photoresistor-sensor')
    return (
      <label className="flex items-center gap-3 rounded-[9px] border border-sep px-3 py-2.5 text-[12px] text-dim">
        Dark
        <input type="range" min={0} max={100} defaultValue={Math.round(20 * Math.log10(value ?? 500))} onChange={(e) => live.control(id, 'lux', Math.round(10 ** (Number(e.target.value) / 20) * 10) / 10)} className="min-w-0 flex-1 accent-[var(--accent-line)]" />
        Bright
      </label>
    )
  if (type === 'wokwi-slide-switch')
    return (
      <label className="flex items-center gap-3 rounded-[9px] border border-sep px-3 py-2.5 text-[12px] text-dim">
        <input type="checkbox" defaultChecked={!!value} onChange={(e) => live.control(id, 'value', e.target.checked ? 1 : 0)} className="accent-[var(--accent-line)]" />
        Flip it on
      </label>
    )
  if (type === 'wokwi-pir-motion-sensor')
    return (
      <button onPointerDown={() => live.control(id, 'motion', 1)} onPointerUp={() => live.control(id, 'motion', 0)} onPointerLeave={() => live.control(id, 'motion', 0)} className="h-9 w-full rounded-[9px] border border-line bg-input text-[12.5px] font-medium text-ink active:bg-accent hover:bg-accent-hover active:text-on-accent">
        Hold to walk past it
      </button>
    )
  if (type === 'wokwi-dht22')
    return (
      <div className="space-y-1.5">
        <label className="flex items-center gap-3 rounded-[9px] border border-sep px-3 py-2.5 text-[12px] text-dim">
          <span className="w-[74px]">Temperature</span>
          <input type="range" min={-40} max={80} step={0.5} defaultValue={value ?? 24} onChange={(e) => live.control(id, 'temperature', Number(e.target.value))} className="min-w-0 flex-1 accent-[var(--accent-line)]" />
        </label>
        <label className="flex items-center gap-3 rounded-[9px] border border-sep px-3 py-2.5 text-[12px] text-dim">
          <span className="w-[74px]">Humidity</span>
          <input type="range" min={0} max={100} defaultValue={live.readings[id]?.cards[1]?.[1] ? parseFloat(live.readings[id].cards[1][1]) : 40} onChange={(e) => live.control(id, 'humidity', Number(e.target.value))} className="min-w-0 flex-1 accent-[var(--accent-line)]" />
        </label>
      </div>
    )
  if (type === 'wokwi-pushbutton')
    return (
      <button onPointerDown={() => live.control(id, 'pressed', 1)} onPointerUp={() => live.control(id, 'pressed', 0)} onPointerLeave={() => live.control(id, 'pressed', 0)} className="h-9 w-full rounded-[9px] border border-line bg-input text-[12.5px] font-medium text-ink active:bg-accent hover:bg-accent-hover active:text-on-accent">
        Hold to press
      </button>
    )
  return null
}

function LivePart({ id, type, live }: { id: string; type: string; live: Live }) {
  const r = live.readings[id]
  if (live.state === 'off') return null
  if (!r) return <p className="mb-4 text-[12px] text-dim">{live.state === 'compiling' ? 'Compiling and starting the board...' : live.state === 'failed' ? `It did not compile: ${live.error}` : 'Waiting for the first reading...'}</p>
  const h = live.history[id] ?? []
  return (
    <div className="mb-5 space-y-4">
      <div>
        <div className="mb-2 flex items-center justify-between text-[12.5px]">
          <span className="font-semibold text-ink">Metrics</span>
          <span className="text-[11.5px] text-dim">sim {(live.simMs / 1000).toFixed(1)} s</span>
        </div>
        <Cards items={r.cards} />
      </div>
      <Control type={type} id={id} live={live} value={h[h.length - 1]?.v} />
      {r.value !== undefined && <Chart points={h} max={r.max} unit={r.unit} title={r.unit === '%' ? 'Over time' : r.unit ? `${cap(r.unit === 'cm' ? 'distance' : r.unit === 'hz' ? 'tone' : 'angle')} over time` : 'Over time'} />}
      <Logs items={live.log[id] ?? []} live={live.state === 'running'} />
    </div>
  )
}

function Panel({ id, props, live }: { id: string; props: Props; live: Live }) {
  const { diagram, source, test, runs, compiles, verdict, feed, request } = props
  const tools = feed.filter((f): f is Extract<FeedItem, { kind: 'tool' }> => f.kind === 'tool')
  if (id === 'parts') return diagram ? <div className="-mx-4 -mt-1"><ShoppingList diagram={diagram} /></div> : null
  if (id === 'schematic')
    return diagram ? (
      <>
        <p className="mb-4 rounded-[9px] bg-input px-3 py-2.5 text-[12.5px] leading-[19px] text-ink">The same circuit drawn the way an engineer reads it: each part as its symbol, power and ground as marks, and signals joined by their names.</p>
        <SheetCard diagram={diagram} title={cap(request.split(/[:.]/)[0])} />
        {props.savedId && (
          <a href={`/b/${props.savedId}/schematic`} className="mt-4 flex h-9 items-center justify-between rounded-[9px] border border-line px-3 text-[12.5px] font-medium text-ink hover:bg-hover">
            Open the full schematic
            <Icon name="chevron-right" size={12} />
          </a>
        )}
      </>
    ) : null
  if (id === 'wiring')
    return diagram ? (
      <>
        {props.savedId && (
          <a href={`/b/${props.savedId}/build`} className="mb-3 flex h-9 items-center justify-between rounded-[9px] border border-line px-3 text-[12.5px] font-medium text-ink hover:bg-hover">
            Open the full build view
            <Icon name="chevron-right" size={12} />
          </a>
        )}
        <BreadboardGuide key={JSON.stringify(diagram.connections)} diagram={diagram} />
      </>
    ) : null
  if (id === 'proven') {
    const run = runs[runs.length - 1]
    const steps = run?.steps.length ?? test?.match(/^\s*- /gm)?.length ?? 0
    return (
      <>
        <p className="rounded-[9px] bg-input px-3 py-2.5 text-[12.5px] leading-[19px] text-ink">{verdict?.text || (test ? 'This one passes its test in the simulator, so the code does what it says on this wiring.' : 'This one has no test yet.')}</p>
        <div className="mt-4">
          <Cards items={[['Test steps', String(steps || '-')], ['Runs', String(runs.length || (test ? 1 : 0))], ['Turns', verdict?.turns ? String(verdict.turns) : '-'], ['Tokens', verdict?.tokens ? `${(verdict.tokens / 1000).toFixed(1)}k` : '-']]} />
        </div>
        <p className="mt-4 text-[12px] leading-[18px] text-dim">Next along the line: get the parts, wire them the same way, and flash the board with the firmware that passed.</p>
      </>
    )
  }
  if (id === 'flash') {
    const pico = diagram?.parts.some((p) => p.type === 'wokwi-pi-pico')
    const nano = diagram?.parts.some((p) => p.type === 'wokwi-arduino-nano')
    const save = (name: string, data: BlobPart, type = 'application/octet-stream') => {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(new Blob([data], { type }))
      a.download = name
      a.click()
      setTimeout(() => URL.revokeObjectURL(a.href), 1000)
    }
    const file = live.build?.uf2 ? () => save('sketch.uf2', Uint8Array.from(atob(live.build!.uf2!), (c) => c.charCodeAt(0))) : live.build?.hex ? () => save('sketch.hex', live.build!.hex!, 'text/plain') : undefined
    const how = pico
      ? ['Hold the BOOTSEL button on the Pico and plug it in over usb.', 'It shows up as a drive called RPI-RP2.', 'Drop sketch.uf2 onto it. The Pico reboots running your code.']
      : [`Plug the ${nano ? 'Nano' : 'Uno'} in over usb.`, `Open sketch.ino in the Arduino IDE, pick Arduino ${nano ? 'Nano' : 'Uno'} and its port, then press Upload.`, 'Or flash the hex straight from a terminal with avrdude, below.']
    return (
      <>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={file} disabled={!file} className="flex h-9 items-center justify-center gap-1.5 rounded-[9px] bg-accent hover:bg-accent-hover text-[12.5px] font-semibold text-on-accent disabled:opacity-40">
            <Icon name="export" size={13} />
            {pico ? 'sketch.uf2' : 'sketch.hex'}
          </button>
          <button onClick={() => source && save('sketch.ino', source, 'text/plain')} disabled={!source} className="flex h-9 items-center justify-center gap-1.5 rounded-[9px] border border-line text-[12.5px] font-medium text-ink hover:bg-hover disabled:opacity-40">
            <Icon name="code" size={13} />
            sketch.ino
          </button>
        </div>
        {!file && <p className="mt-2 text-[11.5px] text-dim">{live.state === 'failed' ? live.error : 'Compiling the firmware...'}</p>}
        <Heading>How</Heading>
        <ol className="space-y-1.5">
          {how.map((h, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[12px] leading-[18px] text-ink">
              <span className="mt-[1px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-input font-mono text-[10px] text-dim">{i + 1}</span>
              {h}
            </li>
          ))}
        </ol>
        {!pico && <pre className="mt-3 overflow-auto rounded-[9px] bg-input px-3 py-2.5 font-mono text-[10.5px] leading-[17px] text-ink">{`avrdude -p m328p -c arduino -b ${nano ? 57600 : 115200} \\\n  -P /dev/tty.usbmodem* -U flash:w:sketch.hex`}</pre>}
      </>
    )
  }
  if (id === 'keep') {
    const link = props.savedId ? `${location.origin}/b/${props.savedId}` : ''
    const guide = link && `${link}/build`
    return (
      <>
        <p className="text-[12px] leading-[18px] text-dim">Every build gets its own link. Open it later, send it to someone, or keep changing it in the editor.</p>
        <div className="mt-3 flex items-center gap-1.5 rounded-[9px] border border-line bg-input py-1 pl-3 pr-1">
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink">{link || 'saving...'}</span>
          <button onClick={() => link && navigator.clipboard.writeText(link)} disabled={!link} className="flex h-7 items-center rounded-[7px] border border-line bg-panel px-2.5 text-[11.5px] font-medium text-ink hover:bg-hover disabled:opacity-40">
            Copy
          </button>
        </div>
        <p className="mt-4 text-[12px] leading-[18px] text-dim">The build guide has its own link too, for whoever is building it on a breadboard.</p>
        <div className="mt-2 flex items-center gap-1.5 rounded-[9px] border border-line bg-input py-1 pl-3 pr-1">
          <span className="min-w-0 flex-1 truncate font-mono text-[11.5px] text-ink">{guide || 'saving...'}</span>
          <button onClick={() => guide && navigator.clipboard.writeText(guide)} disabled={!guide} className="flex h-7 items-center rounded-[7px] border border-line bg-panel px-2.5 text-[11.5px] font-medium text-ink hover:bg-hover disabled:opacity-40">
            Copy
          </button>
        </div>
        <button onClick={props.onReset} className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] border border-line text-[12.5px] font-medium text-ink hover:bg-hover">
          <Icon name="plus" size={12} />
          Make another
        </button>
      </>
    )
  }
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
        {tools.length > 0 && (
          <>
            <Heading right={`${tools.length} steps`}>What it did</Heading>
            <div className="space-y-px">
              {tools.map((t, i) => (
                <div key={i} className="flex items-start gap-2 rounded-[6px] px-1 py-1 text-[11.5px] leading-4 hover:bg-hover">
                  <Status ok={t.ok} size={14} />
                  <span className="min-w-0 flex-1">
                    <span className="font-mono text-ink">{t.name}</span>
                    <span className="block break-words text-dim">{t.note}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </>
    )
  if (id === 'firmware') {
    const last = compiles[compiles.length - 1]
    const num = (s?: string) => s?.split(' ')[0]
    return (
      <>
        <Cards items={[['Lines', source ? String(source.split('\n').length) : '-'], ['Compiles', String(compiles.length)], ['Flash', live.build?.flash ? `${(live.build.flash / 1024).toFixed(1)} kb` : num(last?.flash) ? `${num(last?.flash)} b` : '-'], ['Ram', num(last?.ram) ? `${num(last?.ram)} b` : '-']]} />
        <Heading right={live.state === 'running' ? 'running now' : undefined}>sketch.ino</Heading>
        <pre className="max-h-[60vh] overflow-auto rounded-[9px] bg-input px-3 py-2.5 font-mono text-[11px] leading-[18px] text-ink">{source || 'Not written yet.'}</pre>
      </>
    )
  }
  if (id === 'test') {
    const run = runs[runs.length - 1]
    return (
      <>
        <Cards items={[['Runs', String(runs.length)], ['Result', verdict ? (verdict.ok ? 'proven' : 'not proven') : run ? (run.ok ? 'passing' : 'fixing') : '-']]} />
        {run && (
          <>
            <Heading right={`run ${runs.length}`}>Last run</Heading>
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
        <Heading>test.yaml</Heading>
        <pre className="max-h-[50vh] overflow-auto rounded-[9px] bg-input px-3 py-2.5 font-mono text-[11px] leading-[17px] text-ink">{test || 'Not written yet.'}</pre>
      </>
    )
  }
  const part = diagram?.parts.find((p) => p.id === id)
  if (!part || !diagram) return null
  const wires = diagram.connections.filter(([a, b]) => a.startsWith(`${part.id}:`) || b.startsWith(`${part.id}:`))
  if (BOARDS.includes(part.type)) {
    const last = compiles[compiles.length - 1]
    const run = runs[runs.length - 1]
    const num = (s?: string) => s?.split(' ')[0]
    const lines = live.serial
    const perSecond = (() => {
      // serial lines per second of sim, in one second buckets
      const out: Point[] = []
      if (!lines.length) return out
      // buckets grow with the run: a fresh boot gets quarter seconds, a long run whole ones
      const end = live.simMs
      const step = Math.max(250, Math.min(1000, end / 20))
      for (let t = Math.max(step, end - step * 20); t <= end; t += step) out.push({ ms: t, v: Math.round(lines.filter((l) => l.ms > t - step && l.ms <= t).length * (1000 / step)) })
      return out
    })()
    return (
      <>
        {live.state !== 'off' && (
          <div className="mb-5 space-y-4">
            <div>
              <div className="mb-2 flex items-center justify-between text-[12.5px]">
                <span className="font-semibold text-ink">Metrics</span>
                <span className="text-[11.5px] text-dim">{live.state === 'running' ? 'running now' : live.state}</span>
              </div>
              <Cards items={[['Sim time', `${(live.simMs / 1000).toFixed(1)} s`], ['Speed', `${Math.round(live.speed * 100)}%`], ['Serial lines', String(lines.length)], ['Flash', live.build?.flash ? `${(live.build.flash / 1024).toFixed(1)} kb` : '-']]} />
            </div>
            {live.state === 'failed' && <p className="text-[12px] text-bad">{live.error}</p>}
            <Chart points={perSecond} title="Serial lines per second" />
            <Logs items={lines} live={live.state === 'running'} />
          </div>
        )}
        {(live.state === 'off' || runs.length > 0) && <Cards items={[['Flash', num(last?.flash) ? `${num(last?.flash)} b` : '-'], ['Ram', num(last?.ram) ? `${num(last?.ram)} b` : '-'], ['Test runs', String(runs.length)], ['Result', verdict ? (verdict.ok ? 'proven' : 'not proven') : run ? (run.ok ? 'passing' : 'fixing') : '-']]} />}
        <Heading>What you asked</Heading>
        <p className="rounded-[9px] bg-input px-3 py-2.5 text-[12.5px] leading-[19px] text-ink">{request}</p>
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
      <LivePart id={part.id} type={part.type} live={live} />
      {/* the stored values only when nothing is running, the live ones say it better */}
      {!live.readings[part.id] && <Cards items={cards.slice(0, 4)} />}
      <Heading>About it</Heading>
      <PartFacts type={part.type} />
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

const HEAD: Record<string, [IconName, string]> = {
  idea: ['magic-wand', 'What you asked'],
  firmware: ['code', 'Firmware'],
  test: ['flask', 'Test'],
  proven: ['circle-check', 'Proven'],
  schematic: ['resistor', 'See the schematic'],
  parts: ['box', 'Get the parts'],
  wiring: ['wire', 'Build it on a breadboard'],
  flash: ['bolt', 'Flash your board'],
  keep: ['link', 'Keep it'],
}

// the first thing someone sees: say what to make, or pick a board, and watch it come together as a path
export function Onboarding(props: Props) {
  const { busy, request, prompt, onPrompt, onStart, verdict, savedId, recent, examples, onEditor, onReset, onBuildCircuit, diagram, compiles, runs, feed } = props
  const [step, setStep] = useState<Step>('menu')
  const [picked, setPicked] = useState<string | null>(null)
  const [focus, setFocus] = useState(false)
  // an example opened from the card grows on the same canvas, it needs no agent
  const [shown, setShown] = useState<Saved | null>(null)
  // a circuit being wired by hand on the canvas, and the menu open off one of its +
  const [own, setOwn] = useState<Diagram | null>(null)
  const [menu, setMenu] = useState<Menu | null>(null)
  const [what, setWhat] = useState('')
  // the gadget running behind the path, once there is firmware that passed: a proven build or an example
  const simOn = shown ? !!shown.sketch && !!shown.diagram : !!verdict?.ok && !busy && !!diagram && !!props.source
  const simSource = shown ? shown.sketch : props.source
  const { live, onState, bench } = useSampler(simOn, `${shown?.id ?? savedId}|${simSource}`)
  const simDiagram = shown ? (shown.diagram ?? null) : diagram
  const sim = useMemo<Sim | undefined>(() => (simOn && simDiagram && simSource ? { diagram: simDiagram, source: simSource, title: shown?.title ?? cap(request.split(/[:.]/)[0]), onState, bench } : undefined), [simOn, simDiagram, simSource])
  // a little while with the gadget running, then on into the editor with it open. touching anything means
  // you are trying it out, so the countdown goes away and does not come back for this build
  const WAIT = 15
  const [left, setLeft] = useState<number | null>(null)
  const stayed = useRef<string | null>(null)
  const target = shown?.id ?? savedId
  useEffect(() => {
    if (!simOn || !target || stayed.current === target) return setLeft(null)
    setLeft(WAIT)
    const t = setInterval(() => setLeft((n) => (n === null ? null : n - 1)), 1000)
    return () => clearInterval(t)
  }, [simOn, target])
  useEffect(() => {
    if (left === 0 && target) onEditor(target)
  }, [left])
  const stay = () => {
    if (left === null) return
    stayed.current = target ?? null
    setLeft(null)
  }
  const liveLines = Object.fromEntries(Object.entries(live.readings).map(([id, r]) => [id, r.line]))
  const started = busy || !!request
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (step === 'describe') input.current?.focus()
  }, [step])
  // back from signing in: pick up what you were about to build
  useEffect(() => {
    const p = pending.take()
    if (p?.prompt) (onPrompt(p.prompt), setStep('describe'))
    if (p?.circuit) (setOwn(p.circuit), setWhat(p.what ?? ''))
  }, [])
  // a proven build opens what you need to build it

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
  const startOver = () => {
    if (busy) return
    setShown(null)
    setOwn(null)
    setMenu(null)
    setPicked(null)
    setStep('menu')
    onReset()
  }
  const top = (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex h-14 items-center justify-between px-5">
      <button
        onClick={startOver}
        title={busy ? 'the agent is building' : 'start over'}
        className="pointer-events-auto flex items-center gap-2 text-[13px] font-semibold text-ink"
      >
        <Logo size={18} />
        blinkproof
      </button>
      <span className={`pointer-events-auto flex items-center gap-1.5 transition-[margin] duration-300 ease-out ${picked === 'wiring' ? 'mr-[620px]' : picked === 'schematic' ? 'mr-[560px]' : picked ? 'mr-[380px]' : ''}`}>
        {(started || shown) && (
          <button onClick={() => onEditor(openId)} disabled={!openId} className="flex h-8 items-center rounded-[8px] px-2.5 text-[12px] font-medium text-dim hover:bg-hover hover:text-ink disabled:opacity-40">
            Open in the editor
          </button>
        )}
        <Account me={props.me} />
        <button onClick={() => onEditor()} title="skip onboarding and go to the editor" className="flex h-8 items-center gap-1 rounded-[8px] border border-line bg-panel px-3 text-[12px] font-medium text-ink hover:bg-hover">
          Skip
          <Icon name="chevron-right" size={11} />
        </button>
      </span>
    </div>
  )

  // wiring by hand: the same canvas, a + off each side of the board
  const hand: Hand | undefined = own
    ? {
        menu,
        board: own.parts[0].id,
        options: (type) => freePins(own, type),
        onPlus: (side) => setMenu((m) => (m?.side === side ? null : { side })),
        onPart: (type) => (freePins(own, type).length ? setMenu((m) => m && { ...m, type }) : addPart(type)),
        onPin: (pin) => menu?.type && addPart(menu.type, pin),
        onBack: () => setMenu((m) => m && { side: m.side }),
      }
    : undefined
  function addPart(type: keyof typeof PARTS, pin?: string) {
    if (!own) return
    const added = connect(own, type, { left: 400, top: own.parts.length * 90 }, { pin })
    if (added.error) return
    setOwn({ ...own, parts: [...own.parts, ...added.parts], connections: [...own.connections, ...added.connections] })
    setMenu(null)
  }

  if (own && !started)
    return (
      <div className="relative flex h-full overflow-hidden bg-canvas">
        {top}
        <div className="min-w-0 flex-1">
          <ReactFlowProvider>
            <Path diagram={own} idea={null} picked={picked} onPick={(id) => (setPicked(id), setMenu(null))} state="idle" hand={hand} />
          </ReactFlowProvider>
        </div>
        {own.parts.length > 1 && (
          <div className="rise absolute inset-x-0 bottom-6 z-30 flex justify-center px-6">
            <div className="w-full max-w-[480px]">
              <Tab label="What should it do?" />
              <Frame>
                <form onSubmit={(e) => (e.preventDefault(), what.trim() && (onBuildCircuit(what, own), setOwn(null)))} className="flex items-center">
                  <Icon name="magic-wand" size={16} className="ml-3 text-icon-2" />
                  <input value={what} onChange={(e) => setWhat(e.target.value)} placeholder="light the led while the button is held" className="h-11 min-w-0 flex-1 bg-transparent px-2.5 text-[14px] text-ink outline-none placeholder:text-dim" />
                  <button type="submit" disabled={!what.trim()} title="write the code and prove it" className="flex h-11 items-center gap-1.5 border-l border-sep px-3.5 text-[12.5px] font-medium text-ink hover:bg-hover disabled:opacity-40">
                    Build it
                    <Icon name="chevron-right" size={12} />
                  </button>
                </form>
              </Frame>
            </div>
          </div>
        )}
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
              <Row icon="frame" title="Arduino Uno" line="5 V, 14 digital pins, 6 analog, 2 kb of ram" onClick={() => (setOwn({ version: 1, author: 'blinkproof', editor: 'blinkproof', parts: [{ type: 'wokwi-arduino-uno', id: 'uno', left: 0, top: 0 }], connections: [] } as unknown as Diagram), setMenu({ side: 'out' }))} />
              <Row icon="frame" title="Arduino Nano" line="The Uno's chip on a small board" onClick={() => (setOwn({ version: 1, author: 'blinkproof', editor: 'blinkproof', parts: [{ type: 'wokwi-arduino-nano', id: 'nano', left: 0, top: 0 }], connections: [] } as unknown as Diagram), setMenu({ side: 'out' }))} />
              <Row icon="chip" title="Raspberry Pi Pico" line="3.3 V, rp2040, 264 kb of ram" onClick={() => (setOwn({ version: 1, author: 'blinkproof', editor: 'blinkproof', parts: [{ type: 'wokwi-pi-pico', id: 'pico', left: 0, top: 0 }], connections: [] } as unknown as Diagram), setMenu({ side: 'out' }))} />
            </Frame>
          </div>
        )}
        {step === 'example' && (
          <div className="rise w-full max-w-[400px]">
            <Tab label="Open an example" onBack={() => setStep('menu')} />
            <Frame>
              <div className="max-h-[360px] overflow-auto">
                {examples.map((ex) => (
                  <Row key={ex.id} icon={ex.diagram?.parts.some((p) => p.type === 'wokwi-pi-pico') ? 'chip' : 'frame'} title={ex.title} line={ex.status === 'proven' ? 'With a test that passes' : 'A sketch to run and change'} onClick={() => api.get(ex.id).then((full) => full && (setShown(full), setPicked(null)))} />
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
    : { label: cap(request.split(/[:.]/)[0]), sub: ideaLines[ideaLines.length - 1] ?? (verdict ? (verdict.ok ? 'proven' : 'not proven') : 'the agent is building it'), lines: ideaLines, badge: 'Building' }
  const pathDiagram = shown ? (shown.diagram ?? null) : diagram
  // once it is proven the line keeps going, into what you do with it: get the parts, wire them, flash the board
  const after = (d?: Diagram | null): Stop[] => {
    if (!d) return []
    // counted the way the shopping list counts: the board, every part, and the breadboard
    const p = proto(d)
    const pieces = p ? p.placed.length + p.beside.length + 2 : 0
    const sheet = schematic(d)
    const parts = sheet ? sheet.symbols.filter((y) => y.kind !== 'board').length : 0
    const pico = d.parts.some((p) => p.type === 'wokwi-pi-pico')
    return [
      ...(sheet ? [{ id: 'schematic', title: 'See the schematic', icon: 'resistor', state: 'next', line: `${sheet.nets.length} nets, ${parts} ${parts === 1 ? 'part' : 'parts'}` } as Stop] : []),
      { id: 'parts', title: 'Get the parts', icon: 'box', state: 'next', line: `${pieces} pieces, where to buy` },
      { id: 'wiring', title: 'Build it on a breadboard', icon: 'wire', state: 'next', line: 'step by step, hole by hole' },
      { id: 'flash', title: 'Flash your board', icon: 'bolt', state: 'next', line: pico ? 'drop the uf2 on it' : 'upload it over usb' },
      { id: 'keep', title: 'Keep it', icon: 'link', state: 'next', line: 'its own link, open it later' },
    ]
  }
  // the stops after the board, each saying what is happening there right now
  const stops: Stop[] = (() => {
    const running = live.state === 'running' ? `running, ${(live.simMs / 1000).toFixed(0)} s in` : undefined
    if (shown) {
      const n = shown.test?.match(/^\s*- /gm)?.length ?? 0
      return [
        { id: 'firmware', title: 'Firmware', icon: 'code', state: shown.sketch ? 'done' : 'wait', line: running ?? (shown.sketch ? `${shown.sketch.split('\n').length} lines` : 'none yet') },
        { id: 'test', title: 'Test', icon: 'flask', state: shown.test ? 'done' : 'wait', line: shown.test ? `${n} steps, all pass` : 'no test for this one' },
        { id: 'proven', title: shown.test ? 'Proven' : 'No test yet', icon: shown.test ? 'circle-check' : 'circle-info', state: shown.test ? 'done' : 'wait', line: shown.test ? 'it does what it says' : 'write one in the editor' },
        ...after(shown.diagram),
      ]
    }
    const source = props.source
    const last = compiles[compiles.length - 1]
    const run = runs[runs.length - 1]
    const writing = busy && (lastTool === 'write_sketch' || (!!diagram && !source))
    const firmware: Stop = !diagram
      ? { id: 'firmware', title: 'Firmware', icon: 'code', state: 'wait', line: 'after the wiring' }
      : !source
        ? { id: 'firmware', title: 'Firmware', icon: 'code', state: busy ? 'work' : 'wait', line: 'writing the code...' }
        : busy && (writing || lastTool === 'compile' || (last && !last.ok))
          ? { id: 'firmware', title: 'Firmware', icon: 'code', state: 'work', line: lastTool === 'compile' ? 'compiling...' : last && !last.ok ? 'did not compile, fixing' : `writing, ${source.split('\n').length} lines` }
          : { id: 'firmware', title: 'Firmware', icon: 'code', state: last && !last.ok ? 'fail' : 'done', line: running ?? `${source.split('\n').length} lines${last?.flash ? `, ${last.flash.split(' ')[0]} b` : ''}` }
    const failed = run ? run.steps.findIndex((st) => st.startsWith('FAIL')) + 1 : 0
    const test: Stop = verdict
      ? { id: 'test', title: 'Test', icon: 'flask', state: run?.ok ? 'done' : 'fail', line: run ? (run.ok ? `${run.steps.length} of ${run.steps.length} pass` : `step ${failed} failed`) : 'never ran' }
      : run
        ? { id: 'test', title: 'Test', icon: 'flask', state: 'work', line: run.ok ? `run ${runs.length}, all pass` : lastTool === 'run_test' ? `run ${runs.length}, step ${failed} failed` : `fixing step ${failed}...` }
        : props.test || lastTool === 'write_test'
          ? { id: 'test', title: 'Test', icon: 'flask', state: busy ? 'work' : 'wait', line: lastTool === 'write_test' ? 'writing the test...' : 'waiting to run' }
          : { id: 'test', title: 'Test', icon: 'flask', state: 'wait', line: 'after the firmware' }
    const result: Stop = verdict
      ? { id: 'proven', title: verdict.ok ? 'Proven' : 'Not proven', icon: verdict.ok ? 'circle-check' : 'circle-xmark', state: verdict.ok ? 'done' : 'fail', line: verdict.ok ? (verdict.turns ? `in ${verdict.turns} turns` : 'it does what you asked') : 'open it in the editor to fix' }
      : { id: 'proven', title: 'Proven', icon: 'circle-check', state: 'wait', line: 'once the test passes' }
    return [firmware, test, result, ...(verdict?.ok ? after(diagram) : [{ id: 'sim', title: 'Simulation', icon: 'play', state: 'wait', line: 'runs once it is proven' } as Stop])]
  })()
  const pathState: NodeData['state'] = shown ? (shown.test ? 'done' : 'idle') : boardState
  return (
    <div className="relative flex h-full overflow-hidden bg-canvas" onPointerDownCapture={(e) => !(e.target as HTMLElement).closest('[data-countdown]') && stay()}>
      {top}
      {left !== null && left > 0 && (
        <div data-countdown className="rise absolute inset-x-0 bottom-6 z-40 flex justify-center px-6">
          <div className="float flex items-center gap-3 overflow-hidden py-1.5 pl-3.5 pr-1.5">
            <svg width="22" height="22" viewBox="0 0 22 22" className="-rotate-90 text-accent-line">
              <circle cx="11" cy="11" r="9" fill="none" stroke="var(--sep)" strokeWidth="2" />
              <circle cx="11" cy="11" r="9" fill="none" stroke="currentColor" strokeWidth="2" strokeDasharray={2 * Math.PI * 9} strokeDashoffset={2 * Math.PI * 9 * (left / WAIT)} strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }} />
            </svg>
            <span className="text-[12.5px] text-ink">
              Opening it in the editor in <span className="font-mono">{left}s</span>
            </span>
            <button onClick={stay} className="flex h-8 items-center rounded-[8px] px-2.5 text-[12px] font-medium text-dim hover:bg-hover hover:text-ink">
              Stay here
            </button>
            <button onClick={() => target && onEditor(target)} className="flex h-8 items-center gap-1 rounded-[8px] bg-accent hover:bg-accent-hover px-3 text-[12px] font-semibold text-on-accent">
              Go now
              <Icon name="chevron-right" size={11} />
            </button>
          </div>
        </div>
      )}
      {!shown && (
        <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex justify-center">
          <button onClick={() => verdict?.ok && setPicked('parts')} className={`pointer-events-auto flex h-8 items-center gap-2 rounded-full border bg-panel px-3.5 text-[12px] font-medium text-ink shadow-[0_1px_2px_rgba(0,0,0,.04)] ${verdict ? (verdict.ok ? 'border-ok/40' : 'border-bad/40') : 'border-line'}`}>
            {verdict ? <Status ok={verdict.ok} size={14} /> : <span className="h-2 w-2 animate-pulse rounded-full bg-accent hover:bg-accent-hover" />}
            {phase}
            {verdict?.ok && <span className="text-dim">· now build it for real</span>}
          </button>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <ReactFlowProvider>
          <Path diagram={pathDiagram} idea={idea} picked={picked} onPick={setPicked} state={pathState} lines={liveLines} stops={stops} sim={sim} />
        </ReactFlowProvider>
      </div>
      <aside className={`absolute bottom-0 right-0 top-0 z-30 flex flex-col border-l border-line bg-panel transition-[transform,width] duration-300 ease-out ${picked === 'wiring' ? 'w-[620px]' : picked === 'schematic' ? 'w-[560px]' : 'w-[380px]'} ${picked ? 'translate-x-0 shadow-[-16px_0_40px_rgba(0,0,0,.06)]' : 'translate-x-full'}`}>
        {picked && (
          <>
            <div className="flex h-12 shrink-0 items-center justify-between border-b border-sep px-4">
              <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-medium text-ink">
                <Icon name={HEAD[picked]?.[0] ?? PART_ICON[(shown?.diagram ?? diagram)?.parts.find((p) => p.id === picked)?.type ?? ''] ?? 'chip'} size={15} className="text-icon" />
                <span className="truncate">{HEAD[picked]?.[1] ?? picked}</span>
              </span>
              <button onClick={() => setPicked(null)} title="close" className="flex h-7 w-7 items-center justify-center rounded-full text-icon-2 hover:bg-hover hover:text-ink">
                <Icon name="xmark" size={12} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-4">
              <Panel id={picked} live={live} props={shown ? { ...props, diagram: shown.diagram ?? null, source: shown.sketch, test: shown.test, request: shown.title, runs: [], compiles: [], verdict: null, feed: [], savedId: shown.id, onReset: startOver } : { ...props, onReset: startOver }} />
            </div>
            {openId && (
              <div className="border-t border-sep p-3">
                <button onClick={() => onEditor(openId)} className="flex h-9 w-full items-center justify-center gap-1.5 rounded-[9px] bg-accent hover:bg-accent-hover text-[12.5px] font-semibold text-on-accent">
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
