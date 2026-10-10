import { useMemo } from 'react'
import { ACCENTS, ICONS, iconPaths, type IconDef, type IconName } from './hand'

type Props = { name: IconName; size?: number; className?: string; blob?: boolean; title?: string }

// a hand drawn icon. the outline takes the text colour, the blob its accent, softer in dark mode via css
export function Icon({ name, size = 18, className = '', blob = true, title }: Props) {
  const { blob: b, ink } = useMemo(() => iconPaths(name), [name])
  const def: IconDef = ICONS[name]
  return (
    <svg width={size} height={size} viewBox="-1 -1 26 26" className={`shrink-0 ${className}`} aria-hidden={!title} role={title ? 'img' : undefined}>
      {title && <title>{title}</title>}
      {blob && b && <path d={b} className="icon-blob" fill={ACCENTS[def.accent ?? 'yellow']} />}
      {ink.map((p, i) => (
        <path key={i} d={p.d} fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      ))}
    </svg>
  )
}
