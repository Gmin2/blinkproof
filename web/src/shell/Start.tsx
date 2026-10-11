import { useEffect, useRef, useState } from 'react'
import { Icon, Logo, type IconName } from '../icons/Icon'
import type { Saved } from './library'
import { IDEAS } from './useBuild'

type Props = {
  examples: Saved[]
  busy: boolean
  prompt: string
  onPrompt: (t: string) => void
  onDescribe: () => void
  onOpen: (id: string) => void
  onBlank: (board: 'uno' | 'nano' | 'pico') => void
}

type Step = 'menu' | 'describe' | 'examples' | 'blank'

function Item({ icon, title, line, onClick }: { icon: IconName; title: string; line: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="group flex w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left hover:bg-hover">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] border border-sep bg-panel text-icon">
        <Icon name={icon} size={16} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{title}</span>
        <span className="block truncate text-[11.5px] text-dim">{line}</span>
      </span>
      <Icon name="chevron-right" size={12} className="text-icon-2 opacity-0 transition-opacity group-hover:opacity-100" />
    </button>
  )
}

// the first thing a new build shows: what do you want to make. each choice turns the card into its next step
export function Start({ examples, busy, prompt, onPrompt, onDescribe, onOpen, onBlank }: Props) {
  const [step, setStep] = useState<Step>('menu')
  const input = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (step === 'describe') input.current?.focus()
  }, [step])

  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && step !== 'menu' && !busy && setStep('menu')
    addEventListener('keydown', esc)
    return () => removeEventListener('keydown', esc)
  }, [step, busy])

  const back = (label: string) => (
    <button onClick={() => setStep('menu')} disabled={busy} className="mx-auto mb-2 flex h-7 items-center gap-1.5 rounded-full border border-sep bg-panel px-3 text-[11.5px] text-dim hover:text-ink disabled:opacity-50">
      <Icon name="chevron-left" size={11} />
      {label}
    </button>
  )

  return (
    <div className="flex h-full items-center justify-center px-6 pb-16">
      <div className="w-full max-w-[420px]">
        <div className="mb-6 flex justify-center">
          <Logo size={34} />
        </div>

        {step === 'menu' && (
          <div className="rise float p-1.5">
            <Item icon="magic-wand" title="Describe a gadget" line="The agent wires it, writes the code, and proves it" onClick={() => setStep('describe')} />
            <Item icon="book-open" title="Start from an example" line="A parking sensor, a plant monitor, and more" onClick={() => setStep('examples')} />
            <Item icon="frame" title="Start blank" line="A board and an empty sketch, build it by hand" onClick={() => setStep('blank')} />
            <div className="mt-1 border-t border-sep px-2.5 pb-1 pt-2 text-[11px] text-dim">Every build gets its own link, and has to pass its test.</div>
          </div>
        )}

        {step === 'describe' && (
          <div className="rise">
            {back('Describe a gadget')}
            <form onSubmit={(e) => (e.preventDefault(), onDescribe())} className="float flex items-end gap-2 p-2">
              <Icon name="magic-wand" size={16} className="mb-2 ml-1.5 text-icon-2" />
              <textarea
                ref={input}
                value={prompt}
                onChange={(e) => onPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onDescribe())}
                rows={2}
                disabled={busy}
                placeholder="a night light that turns on when the room gets dark"
                className="min-h-[40px] flex-1 resize-none bg-transparent py-1.5 text-[13px] leading-5 text-ink outline-none placeholder:text-dim"
              />
              <button type="submit" disabled={busy || !prompt.trim()} title="build it, return" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] bg-accent text-on-accent disabled:opacity-40">
                {busy ? <Icon name="loader" size={14} className="animate-spin" /> : <Icon name="chevron-right" size={14} />}
              </button>
            </form>
            {busy ? (
              <p className="mt-3 text-center text-[12px] text-dim">The agent is picking parts...</p>
            ) : (
              <div className="mt-3 flex flex-wrap justify-center gap-1.5">
                {IDEAS.map((idea) => (
                  <button key={idea} onClick={() => onPrompt(idea)} className={`h-7 rounded-full border px-3 text-[11.5px] ${prompt === idea ? 'border-accent bg-accent text-on-accent' : 'border-sep bg-panel text-dim hover:text-ink'}`}>
                    {idea.split(':')[0].replace(/^./, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'examples' && (
          <div className="rise">
            {back('Start from an example')}
            <div className="float max-h-[420px] overflow-auto p-1.5">
              {examples.map((ex) => (
                <Item key={ex.id} icon={ex.diagram?.parts?.some((p) => p.type === 'wokwi-pi-pico') ? 'chip' : 'frame'} title={ex.title} line={ex.test ? 'With a test that passes' : 'A sketch to run and change'} onClick={() => onOpen(ex.id)} />
              ))}
              {!examples.length && <p className="px-2.5 py-2 text-[12px] text-dim">The examples come from the agent server, start it to see them.</p>}
            </div>
          </div>
        )}

        {step === 'blank' && (
          <div className="rise">
            {back('Start blank')}
            <div className="float p-1.5">
              <Item icon="frame" title="Arduino Uno" line="5 V, 14 digital pins, 6 analog, 2 kb of ram" onClick={() => onBlank('uno')} />
              <Item icon="frame" title="Arduino Nano" line="The Uno's chip on a small board, 8 analog pins" onClick={() => onBlank('nano')} />
              <Item icon="chip" title="Raspberry Pi Pico" line="3.3 V, rp2040 at 133 MHz, 264 kb of ram" onClick={() => onBlank('pico')} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
