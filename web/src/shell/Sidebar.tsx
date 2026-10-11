import type { Diagram } from '@blinkproof/sim'
import { useState } from 'react'
import { Icon, Logo, type IconName } from '../icons/Icon'
import { PART_ICON } from '../icons/Status'
import { EXAMPLES } from './examples'

export const KIND: Record<string, string> = {
  'wokwi-arduino-uno': 'arduino uno',
  'wokwi-arduino-nano': 'arduino nano',
  'wokwi-pi-pico': 'raspberry pi pico',
  'wokwi-led': 'led',
  'wokwi-resistor': 'resistor',
  'wokwi-pushbutton': 'button',
  'wokwi-ssd1306': 'oled 128x64',
  'wokwi-potentiometer': 'potentiometer',
  'wokwi-neopixel': 'neopixel',
  'wokwi-led-ring': 'led ring',
  'wokwi-servo': 'servo',
  'wokwi-hc-sr04': 'ultrasonic',
  'wokwi-buzzer': 'buzzer',
}

export const BOARDS = ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-pi-pico']

export type Page = { kind: 'build' } | { kind: 'example'; name: string }

// a small round header button, the circled + and the collapse arrows next to "Documents"
export function HeaderButton({ icon, title, onClick }: { icon: IconName; title: string; onClick?: () => void }) {
  return (
    <button title={title} onClick={onClick} className="flex h-5 w-5 items-center justify-center rounded-full text-icon-2 hover:text-ink">
      <Icon name={icon} size={16} />
    </button>
  )
}

function Header({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex h-[30px] items-center justify-between pl-[18px] pr-4 text-[12px] font-semibold text-ink">
      <span className="flex items-center gap-1">{children}</span>
      <span className="flex items-center gap-1.5">{right}</span>
    </div>
  )
}

// one row of the layer list: inset 10, rounded 6, 15 per level, path lines on the levels above
function Row({ selected, current, soft, onClick, icon, children, depth = 0, right, dim }: {
  selected?: boolean
  current?: boolean
  soft?: boolean
  onClick?: () => void
  icon?: IconName
  children: React.ReactNode
  depth?: number
  right?: React.ReactNode
  dim?: boolean
}) {
  const tone = selected ? 'bg-accent font-semibold text-white' : soft ? 'bg-accent-soft text-accent-ink' : current ? 'bg-row text-ink' : 'text-ink hover:bg-hover'
  return (
    <div className="relative">
      {Array.from({ length: depth }, (_, i) => (
        <span key={i} className="absolute bottom-0 top-0 w-px bg-tree" style={{ left: 27 + i * 15 }} />
      ))}
      <button onClick={onClick} className={`relative mx-2.5 flex h-[25px] w-[calc(100%-20px)] items-center gap-2 rounded-[6px] pr-2 text-left text-[12px] ${tone}`} style={{ paddingLeft: 9 + depth * 15 }}>
        {icon && <Icon name={icon} size={16} className={selected ? 'text-white' : soft ? 'text-accent-ink' : 'text-icon-2'} />}
        <span className={`min-w-0 flex-1 truncate ${dim && !selected ? 'text-dim' : ''}`}>{children}</span>
        {right && <span className={selected ? 'text-white/80' : 'text-icon-2'}>{right}</span>}
      </button>
    </div>
  )
}

type Props = {
  page: Page
  onPage: (p: Page) => void
  diagram: Diagram | null
  title: string
  selected: string | null
  onSelect: (id: string | null) => void
  canReplay: boolean
  onReplay: () => void
  busy: boolean
  onParts: () => void
}

export function Sidebar({ page, onPage, diagram, title, selected, onSelect, canReplay, onReplay, busy, onParts }: Props) {
  const [query, setQuery] = useState('')
  const [docsOpen, setDocsOpen] = useState(true)
  const [examplesOpen, setExamplesOpen] = useState(true)
  const [wiresOpen, setWiresOpen] = useState(false)
  const board = diagram?.parts.find((p) => BOARDS.includes(p.type))
  const q = query.trim().toLowerCase()
  const match = (s: string) => !q || s.toLowerCase().includes(q)
  const parts = (diagram?.parts.filter((p) => p !== board) ?? []).filter((p) => match(p.id) || match(KIND[p.type] ?? ''))
  const wires = (diagram?.connections ?? []).filter(([a, b]) => match(a) || match(b))
  const exampleName = page.kind === 'example' ? EXAMPLES[page.name].title.replace(/^./, (c) => c.toUpperCase()) : 'Examples'

  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-[52px] shrink-0 items-center justify-between pl-[18px] pr-[10px]">
        <span className="flex items-center gap-2 text-[13px] font-semibold tracking-tight text-ink">
          <Logo size={18} />
          blinkproof
        </span>
        <button title="parts" onClick={onParts} className="pill flex h-9 w-9 items-center justify-center text-icon">
          <Icon name="box" size={19} />
        </button>
      </div>

      <div className="h-1.5" />
      <Header right={<><HeaderButton icon="collapse" title={docsOpen ? 'collapse' : 'expand'} onClick={() => setDocsOpen((o) => !o)} /><HeaderButton icon="circle-plus" title="new build" onClick={() => onPage({ kind: 'build' })} /></>}>
        Documents
      </Header>
      {docsOpen && (
        <div className="mt-1 space-y-px">
          <Row icon="cloud" soft={page.kind === 'build'} onClick={() => onPage({ kind: 'build' })}>
            {page.kind === 'build' ? title : 'New Build'}
          </Row>
          {canReplay && (
            <Row icon="refresh-2" onClick={() => (onPage({ kind: 'build' }), onReplay())} right={busy ? <span className="text-[10px]">playing</span> : undefined}>
              Last Build
            </Row>
          )}
        </div>
      )}

      <div className="h-4" />
      <Header right={<><HeaderButton icon="collapse" title={examplesOpen ? 'collapse' : 'expand'} onClick={() => setExamplesOpen((o) => !o)} /><HeaderButton icon="circle-plus" title="new build" onClick={() => onPage({ kind: 'build' })} /></>}>
        {exampleName}
        <Icon name="chevron-expand-y" size={12} className="text-ink" />
      </Header>
      {examplesOpen && (
        <div className="mt-1 space-y-px">
          {Object.entries(EXAMPLES).map(([name, ex]) => (
            <Row key={name} current={page.kind === 'example' && page.name === name} onClick={() => onPage({ kind: 'example', name })}>
              {ex.title.charAt(0).toUpperCase() + ex.title.slice(1)}
            </Row>
          ))}
        </div>
      )}

      <div className="mx-[18px] mb-2 mt-3 border-t border-sep" />
      <div className="min-h-0 flex-1 space-y-px overflow-auto pb-3">
        {!board && <p className="px-[18px] py-1 text-[12px] text-dim">No layers yet</p>}
        {board && (
          <>
            <Row icon="frame" selected={selected === board.id} onClick={() => onSelect(board.id)}>
              {title}
            </Row>
            <Row icon="chip" depth={1} selected={false} onClick={() => onSelect(board.id)} right={<span className="text-[10px]">{KIND[board.type]}</span>}>
              {board.id}
            </Row>
            {parts.map((p) => (
              <Row key={p.id} icon={PART_ICON[p.type] ?? 'box'} depth={1} selected={selected === p.id} onClick={() => onSelect(p.id)}>
                {p.id}
              </Row>
            ))}
            {wires.length > 0 && (
              <Row icon="folder" depth={1} onClick={() => setWiresOpen((o) => !o)} right={<Icon name={wiresOpen ? 'chevron-down' : 'chevron-right'} size={12} />}>
                Wires
              </Row>
            )}
            {(wiresOpen || q) &&
              wires.map(([a, b], i) => (
                <Row key={i} icon="wire" depth={2} dim={a.includes('GND') || b.includes('GND')}>
                  {a} → {b}
                </Row>
              ))}
          </>
        )}
      </div>

      <div className="flex h-[50px] shrink-0 items-center gap-2 pl-2.5 pr-3">
        <label className="flex h-[30px] flex-1 items-center gap-2 rounded-full bg-input px-2.5">
          <Icon name="filter" size={14} className="text-icon-2" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search Layers..." className="min-w-0 flex-1 bg-transparent text-[12px] text-ink outline-none placeholder:text-dim" />
        </label>
        <button title="clear selection" onClick={() => onSelect(null)} className="text-accent">
          <Icon name="crosshairs" size={16} />
        </button>
      </div>
    </aside>
  )
}
