import { useEffect, useRef, useState } from 'react'
import { Icon } from '../icons/Icon'

type Model = { id: string; provider: string; label: string }

// a name the way the maker writes it: "claude haiku 4.5" -> "Claude Haiku 4.5"
const pretty = (label: string) => label.replace(/\b[a-z]/g, (c) => c.toUpperCase())
const maker = (m: Model) => (/^claude/.test(m.id) ? 'Anthropic' : /^nova/.test(m.id) ? 'Amazon' : /^(gpt|o\d)/.test(m.id) ? 'OpenAI' : 'Other')
// what picking it means, in a few words
function note(m: Model) {
  const id = m.id
  if (/haiku/.test(id)) return 'Fast and cheap, the default'
  if (/sonnet/.test(id)) return 'Stronger at tricky wiring, slower'
  if (/opus/.test(id)) return 'The strongest, the slowest'
  if (/fable/.test(id)) return 'Newest, for hard builds'
  if (/micro/.test(id)) return 'Smallest, quickest, simple gadgets'
  if (/lite/.test(id)) return 'Light and cheap'
  if (/pro/.test(id)) return 'Amazon, the bigger one'
  return m.provider === 'litellm' ? 'Through the hackathon credits' : `Your ${m.provider} key`
}
const ORDER = ['Anthropic', 'Amazon', 'OpenAI', 'Other']

// who builds it: a button with the model's name, and a menu of every model the server has keys for
export function ModelMenu({ model, models, onModel }: { model: string; models: Model[]; onModel: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const current = models.find((m) => m.id === model)
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    addEventListener('pointerdown', away)
    addEventListener('keydown', esc)
    return () => (removeEventListener('pointerdown', away), removeEventListener('keydown', esc))
  }, [open])
  const groups = ORDER.map((name) => [name, models.filter((m) => maker(m) === name)] as const).filter(([, list]) => list.length)
  return (
    <div ref={box} className="relative">
      <button onClick={() => setOpen(!open)} title="the model that builds it" className={`flex h-9 items-center gap-2 rounded-full border pl-1 pr-2.5 text-[12px] font-medium text-ink transition-colors ${open ? 'border-accent/50 bg-hover' : 'border-line bg-panel hover:bg-hover'}`}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-on-accent">{pretty((current?.label ?? model).replace(/^claude /, '')).charAt(0)}</span>
        <span className="max-w-[110px] truncate">{pretty((current?.label ?? model).replace(/^claude /, ''))}</span>
        <Icon name="chevron-down" size={11} className={`text-icon-2 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="rise absolute right-0 top-[calc(100%+6px)] z-50 w-[270px] overflow-hidden rounded-[12px] border border-line bg-panel py-1 shadow-[0_12px_32px_rgba(0,0,0,.12)]">
          {groups.map(([name, list], gi) => (
            <div key={name} className={gi ? 'mt-1 border-t border-sep pt-1' : ''}>
              <div className="flex items-center justify-between px-3 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[.06em] text-dim">
                {name}
                {list[0].provider === 'litellm' && <span className="normal-case tracking-normal">neatHack credits</span>}
              </div>
              {list.map((m) => (
                <button key={m.id} onClick={() => (onModel(m.id), setOpen(false))} className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left hover:bg-hover ${m.id === model ? 'bg-hover/60' : ''}`}>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-medium text-ink">{pretty(m.label)}</span>
                    <span className="block truncate text-[11px] text-dim">{note(m)}</span>
                  </span>
                  {m.id === model && <Icon name="check" size={13} className="text-accent" />}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
