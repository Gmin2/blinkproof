import { FACTS } from '@blinkproof/sim'

const PICO = { fine: ['Fine on 3.3 V', 'text-ok'], careful: ['Careful on 3.3 V', 'text-warn'], no: ['Not on 3.3 V', 'text-bad'] } as const

// what a part runs on and draws, and the thing to watch for, before you wire it
export function PartFacts({ type, compact = false }: { type: string; compact?: boolean }) {
  const f = FACTS[type]
  if (!f) return null
  const rows: [string, string | undefined][] = [
    ['Supply', f.supply],
    ['Draws', f.draws],
    ['Signals', f.signal],
  ]
  const [pico, tone] = PICO[f.pico]
  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      <p className="text-[12px] leading-[18px] text-ink">{f.what}</p>
      <dl className="overflow-hidden rounded-[9px] border border-sep">
        {rows
          .filter(([, v]) => v)
          .map(([k, v], i) => (
            <div key={k} className={`flex gap-3 px-2.5 py-1.5 text-[11.5px] leading-[16px] ${i ? 'border-t border-sep' : ''}`}>
              <dt className="w-14 shrink-0 text-dim">{k}</dt>
              <dd className="text-ink">{v}</dd>
            </div>
          ))}
        <div className={`flex gap-3 border-t border-sep px-2.5 py-1.5 text-[11.5px] leading-[16px]`}>
          <dt className="w-14 shrink-0 text-dim">Pico</dt>
          <dd className={tone}>{pico}</dd>
        </div>
      </dl>
      {f.note && <p className="text-[11.5px] leading-[17px] text-dim">{f.note}</p>}
    </div>
  )
}
