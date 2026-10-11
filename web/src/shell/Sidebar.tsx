import type { Diagram } from '@blinkproof/sim'
import { Icon } from '../icons/Icon'
import type { IconName } from '../icons/hand'
import { EXAMPLES } from './examples'

export const PART_ICON: Record<string, IconName> = {
  'wokwi-arduino-uno': 'board',
  'wokwi-arduino-nano': 'board',
  'wokwi-pi-pico': 'pico',
  'wokwi-led': 'led',
  'wokwi-resistor': 'resistor',
  'wokwi-pushbutton': 'button',
  'wokwi-ssd1306': 'screen',
  'wokwi-potentiometer': 'knob',
  'wokwi-neopixel': 'pixel',
  'wokwi-led-ring': 'ring',
  'wokwi-servo': 'servo',
  'wokwi-hc-sr04': 'sonar',
  'wokwi-buzzer': 'buzzer',
}

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

export type Page = { kind: 'build' } | { kind: 'example'; name: string }

function Header({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex h-8 items-center justify-between px-[18px] text-[12px] font-semibold text-ink">
      <span>{title}</span>
      <span className="flex items-center gap-1.5 text-icon">{children}</span>
    </div>
  )
}

function Row({ active, current, onClick, icon, children, indent = 0, right }: { active?: boolean; current?: boolean; onClick: () => void; icon: IconName; children: React.ReactNode; indent?: number; right?: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`mx-2.5 flex h-[26px] w-[calc(100%-20px)] items-center gap-2 rounded-md pr-2 text-left text-[12px] ${
        active ? 'bg-accent font-semibold text-white' : current ? 'bg-row text-ink' : 'text-ink hover:bg-hover'
      }`}
      style={{ paddingLeft: 8 + indent * 15 }}
    >
      <Icon name={icon} size={16} blob={!active} className={active ? 'text-white' : 'text-icon'} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {right}
    </button>
  )
}

type Props = {
  page: Page
  onPage: (p: Page) => void
  diagram: Diagram | null
  selected: string | null
  onSelect: (id: string | null) => void
  canReplay: boolean
  onReplay: () => void
  busy: boolean
}

// sketch's left column: documents and pages up top, the layer list below
export function Sidebar({ page, onPage, diagram, selected, onSelect, canReplay, onReplay, busy }: Props) {
  const board = diagram?.parts.find((p) => ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-pi-pico'].includes(p.type))
  const parts = diagram?.parts.filter((p) => p !== board) ?? []
  return (
    <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-panel">
      <div className="flex h-[52px] items-center gap-2 px-[18px]">
        <Icon name="logo" size={22} className="text-ink" />
        <span className="text-[13px] font-semibold tracking-tight text-ink">blinkproof</span>
      </div>

      <Header title="Builds" />
      <Row icon="build" active={false} current={page.kind === 'build'} onClick={() => onPage({ kind: 'build' })}>
        new build
      </Row>
      {canReplay && (
        <Row icon="replay" onClick={() => (onPage({ kind: 'build' }), onReplay())} right={busy ? <span className="text-[10px] text-dim">playing</span> : undefined}>
          last build
        </Row>
      )}

      <div className="mt-3" />
      <Header title="Examples" />
      <div className="space-y-px">
        {Object.entries(EXAMPLES).map(([name, ex]) => (
          <Row key={name} icon={PART_ICON[ex.diagram.parts[0].type] ?? 'board'} current={page.kind === 'example' && page.name === name} onClick={() => onPage({ kind: 'example', name })}>
            {ex.title}
          </Row>
        ))}
      </div>

      <div className="mx-[18px] my-3 border-t border-line" />
      <Header title="Layers" />
      <div className="min-h-0 flex-1 space-y-px overflow-auto pb-3">
        {!board && <p className="px-[18px] text-[12px] text-dim">nothing on the bench yet</p>}
        {board && (
          <Row icon={PART_ICON[board.type]} active={selected === board.id} onClick={() => onSelect(board.id)} right={<span className={`text-[10px] ${selected === board.id ? 'text-white/70' : 'text-dim'}`}>{KIND[board.type]}</span>}>
            {board.id}
          </Row>
        )}
        {parts.map((p) => (
          <div key={p.id} className="relative">
            <span className="absolute bottom-0 left-[26px] top-0 w-px bg-line" />
            <Row
              icon={PART_ICON[p.type] ?? 'board'}
              indent={1}
              active={selected === p.id}
              onClick={() => onSelect(p.id)}
              right={<span className={`text-[10px] ${selected === p.id ? 'text-white/70' : 'text-dim'}`}>{KIND[p.type]}</span>}
            >
              {p.id}
            </Row>
          </div>
        ))}
      </div>
    </aside>
  )
}
