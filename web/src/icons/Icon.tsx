import { NUCLEO } from './nucleo'

// the few line icons nucleo has no match for, drawn on the same 18 grid at 1.5
const OWN = {
  frame: '<path d="M5 2.5v13M13 2.5v13M2.5 5h13M2.5 13h13" />',
  play: '<path d="M5.5 3.6v10.8a.8.8 0 0 0 1.2.7l8.6-5.4a.8.8 0 0 0 0-1.4L6.7 2.9a.8.8 0 0 0-1.2.7Z" />',
  'square-stop': '<rect x="4" y="4" width="10" height="10" rx="2" />',
  rotate: '<path d="M14.5 9a5.5 5.5 0 1 1-1.6-3.9" /><path d="M13.5 2.5v3h-3" />',
  pause: '<rect x="4.5" y="3" width="3" height="12" rx="1" /><rect x="10.5" y="3" width="3" height="12" rx="1" />',
  prototype: '<circle cx="4" cy="14" r="1.75" /><path d="M5.5 12.5c1-4 3-6 6-6.5" /><path d="M10.5 3.5 13.5 6l-2.7 2.8" />',
  flask: '<path d="M7 2.5h4M7.5 2.5v4.2L3.4 13.6a1.3 1.3 0 0 0 1.1 1.9h9a1.3 1.3 0 0 0 1.1-1.9L10.5 6.7V2.5" /><path d="M5.2 10.5h7.6" />',
  code: '<path d="m6 5.5-3.5 3.5L6 12.5M12 5.5l3.5 3.5-3.5 3.5M10.2 3.5 7.8 14.5" />',
  terminal: '<rect x="2" y="3" width="14" height="12" rx="2.5" /><path d="m5 7 2 2-2 2M9 11.5h4" />',
  resistor: '<path d="M1.5 9h2.5l1.3-3 2.4 6 2.4-6 2.4 6 1.5-3h2.5" />',
  button: '<rect x="2.5" y="2.5" width="13" height="13" rx="2.5" /><circle cx="9" cy="9" r="3.25" />',
  servo: '<rect x="2" y="6" width="14" height="8.5" rx="2" /><circle cx="6" cy="10.25" r="1.75" /><path d="M6 8.5 9.5 3" />',
  chip: '<rect x="4.5" y="4.5" width="9" height="9" rx="1.5" /><path d="M7 2v2.5M11 2v2.5M7 13.5V16M11 13.5V16M2 7h2.5M2 11h2.5M13.5 7H16M13.5 11H16" />',
  wire: '<path d="M2.5 14.5c3.5 0 3-11 6.5-11s3 11 6.5 11" /><circle cx="2.5" cy="14.5" r="1" /><circle cx="15.5" cy="14.5" r="1" />',
  share: '<path d="M9 2.5v8.5M5.75 5.5 9 2.25l3.25 3.25" /><path d="M6 7.5H5A2.5 2.5 0 0 0 2.5 10v3A2.5 2.5 0 0 0 5 15.5h8a2.5 2.5 0 0 0 2.5-2.5v-3A2.5 2.5 0 0 0 13 7.5h-1" />',
  collapse: '<path d="M9 1.75v5M6.5 4.5 9 7l2.5-2.5M9 16.25v-5M6.5 13.5 9 11l2.5 2.5M3 9h12" />',
  sun: '<circle cx="9" cy="9" r="3.25" /><path d="M9 1.75v1.5M9 14.75v1.5M1.75 9h1.5M14.75 9h1.5M3.9 3.9l1.05 1.05M13.05 13.05l1.05 1.05M3.9 14.1l1.05-1.05M13.05 4.95l1.05-1.05" />',
  moon: '<path d="M14.9 11.4A6.25 6.25 0 0 1 6.6 3.1a6.25 6.25 0 1 0 8.3 8.3Z" />',
} as const

export type IconName = keyof typeof NUCLEO | keyof typeof OWN

type Props = { name: IconName; size?: number; className?: string; title?: string }

export function Icon({ name, size = 18, className = '', title }: Props) {
  const own = name in OWN
  const [box, body] = own ? ['0 0 18 18', `<g fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${OWN[name as keyof typeof OWN]}</g>`] : NUCLEO[name as keyof typeof NUCLEO]
  return (
    <svg
      width={size}
      height={size}
      viewBox={box}
      className={`shrink-0 ${className}`}
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      dangerouslySetInnerHTML={{ __html: (title ? `<title>${title}</title>` : '') + body }}
    />
  )
}

// our mark: a 5mm led side on, from brand/src/mark.mjs. it takes the text colour
const MARK = 'M29 58 V27 A21 21 0 0 1 71 27 V58 Z M26 58 H74 Q77 58 77 61 V64 Q77 67 74 67 H26 Q23 67 23 64 V61 Q23 58 26 58 Z M34.5 66 H42 V92.25 A3.75 3.75 0 0 1 34.5 92.25 Z M58 66 H65.5 V84.25 A3.75 3.75 0 0 1 58 84.25 Z'

export function Logo({ size = 20, className = 'text-ink' }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`shrink-0 ${className}`} aria-hidden>
      <path d={MARK} fill="currentColor" />
    </svg>
  )
}
