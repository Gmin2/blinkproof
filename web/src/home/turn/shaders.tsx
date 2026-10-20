/*
 * Render treatments for the wireframe.
 *
 * Everything here paints the geometry we already compute — per-tier stroke
 * colour plus an SVG filter — so nothing is rasterised and nothing is imported.
 * The tier index runs 0 (nearest) to 5 (furthest), which is the only depth cue
 * the engine exposes, and every treatment is some reading of it.
 */

export type Shader = {
  id: string
  label: string
  /** page ground when this treatment takes over the whole page */
  ground?: string
  /** ink for tier i of n */
  ink(i: number, n: number): string
  /** filter id for tier i, if any */
  filter?(i: number, n: number): string | undefined
  /** multiplier on the tier's base opacity */
  alpha?(i: number, n: number): number
  /** stroke width multiplier */
  weight?(i: number, n: number): number
}

function mix(a: string, b: string, t: number) {
  const p = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16))
  const [r1, g1, b1] = p(a)
  const [r2, g2, b2] = p(b)
  const c = (x: number, y: number) => Math.round(x + (y - x) * t)
  return `rgb(${c(r1, r2)}, ${c(g1, g2)}, ${c(b1, b2)})`
}

export const SHADERS: Shader[] = [
  {
    id: 'ink',
    label: 'Ink — flat line',
    ink: () => '#1c1c1c',
  },
  {
    // far tiers go soft, the way a real lens or a drafting overlay drops off
    id: 'depth',
    label: 'Depth of field',
    ink: () => '#1c1c1c',
    filter: (i, n) => (i < n - 3 ? undefined : `dof-${i - (n - 4)}`),
    alpha: (i, n) => 1 + (i / (n - 1)) * 0.5,
  },
  {
    // distance reads as hue, not just as lightness
    id: 'spectral',
    label: 'Spectral depth',
    ink: (i, n) => mix('#0a0a0a', '#3835de', i / (n - 1)),
    alpha: (i, n) => 1 + (i / (n - 1)) * 0.7,
  },
  {
    // near edges carry a little light, so the object sits off the ground
    id: 'bloom',
    label: 'Bloom',
    ink: (i, n) => mix('#101018', '#3835de', (i / (n - 1)) * 0.8),
    filter: (i) => (i < 2 ? 'bloom' : undefined),
    alpha: (i, n) => 1 + (i / (n - 1)) * 0.4,
  },
  {
    id: 'blueprint',
    label: 'Blueprint',
    ground: '#0d1626',
    ink: (i, n) => mix('#e8f0ff', '#3f6bb0', i / (n - 1)),
    alpha: (i, n) => 1.15 - (i / (n - 1)) * 0.15,
    weight: () => 1.1,
  },
  {
    // the house halftone: strokes broken into dots by a turbulence threshold
    id: 'halftone',
    label: 'Halftone',
    ink: (i, n) => mix('#12213f', '#5c7fc9', i / (n - 1)),
    filter: () => 'halftone',
    alpha: (i, n) => 1.5 - (i / (n - 1)) * 0.2,
    weight: () => 2.8,
  },
]

export const shaderById = (id: string) => SHADERS.find((s) => s.id === id) ?? SHADERS[0]

/**
 * How filled faces are painted. `none` is the old see-through wireframe; every
 * other option occludes, which is the whole point — a stack of nested solids is
 * unreadable until the front hides the back.
 */
export type Surface = {
  id: string
  label: string
  /** three tones, lightest first: up-facing, angled, turned away */
  tints?: [string, string, string]
  /** flat or patterned fill, used when there are no tints */
  fill?: string
  stroke?: string
  strokeWidth?: number
  /** wireframe colour; overrides the shader's ink so outlines match the tints */
  line?: string
  /** page ground this treatment wants behind it */
  ground?: string
}

export const SURFACES: Surface[] = [
  { id: 'none', label: 'None — see-through' },
  { id: 'solid', label: 'Solid', fill: '#fbfbfb', stroke: 'rgba(10,10,10,0.30)', strokeWidth: 0.5 },
  {
    // the isometric-diagram look: flat tones by face orientation, blue line
    id: 'iso',
    label: 'Iso — blue',
    tints: ['#dfe5fb', '#bcc8f4', '#9aaaea'],
    stroke: '#4657e0',
    strokeWidth: 0.95,
    line: '#5b6ae6',
    ground: '#f1f4fe',
  },
  {
    // the same flat tones in the site's warm greys, ink line
    id: 'iso-warm',
    label: 'Iso — warm',
    tints: ['#fbfaf8', '#ece8e3', '#d9d3cc'],
    stroke: '#3a3835',
    strokeWidth: 0.9,
    line: '#3a3835',
    ground: '#f8f7f5',
  },
  {
    id: 'iso-slate',
    label: 'Iso — slate',
    tints: ['#eaedf1', '#d0d6df', '#b2bac8'],
    stroke: '#3d4757',
    strokeWidth: 0.95,
    line: '#3d4757',
    ground: '#f7f8fa',
  },
  {
    id: 'iso-lime',
    label: 'Iso — lime',
    tints: ['#eff6dd', '#dbeaad', '#c3dc84'],
    stroke: '#4a5d1c',
    strokeWidth: 0.95,
    line: '#4d5f1f',
    ground: '#fafcf3',
  },
  { id: 'hatch', label: 'Hatched', fill: 'url(#p-hatch)', stroke: 'rgba(10,10,10,0.34)', strokeWidth: 0.5 },
  { id: 'dots', label: 'Dot screen', fill: 'url(#p-dots)', stroke: 'rgba(10,10,10,0.30)', strokeWidth: 0.5 },
  { id: 'cross', label: 'Cross-hatch', fill: 'url(#p-cross)', stroke: 'rgba(10,10,10,0.34)', strokeWidth: 0.5 },
  { id: 'paper', label: 'Paper — no outline', fill: '#fbfbfb', stroke: 'none', strokeWidth: 0 },
]

export const surfaceById = (id: string) => SURFACES.find((s) => s.id === id) ?? SURFACES[0]

/** The filter bank, mounted once inside the wire layer. */
export function ShaderDefs() {
  return (
    <defs>
      {[1, 2, 3].map((k) => (
        <filter key={k} id={`dof-${k}`} x="-12%" y="-12%" width="124%" height="124%">
          <feGaussianBlur stdDeviation={k * 1.15} />
        </filter>
      ))}
      <filter id="bloom" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.9" result="glow" />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
      <filter id="halftone" x="-5%" y="-5%" width="110%" height="110%">
        <feTurbulence type="fractalNoise" baseFrequency="0.17" numOctaves="1" seed="4" result="n" />
        <feColorMatrix in="n" type="matrix" result="mask"
          values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.4 0 0 0 -0.62" />
        <feComposite in="SourceGraphic" in2="mask" operator="in" />
      </filter>
      <pattern id="p-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="5" height="5" fill="#fbfbfb" />
        <line x1="0" y1="0" x2="0" y2="5" stroke="#0a0a0a" strokeWidth="0.55" opacity="0.42" />
      </pattern>
      <pattern id="p-cross" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">
        <rect width="5" height="5" fill="#fbfbfb" />
        <line x1="0" y1="0" x2="0" y2="5" stroke="#0a0a0a" strokeWidth="0.5" opacity="0.36" />
        <line x1="0" y1="0" x2="5" y2="0" stroke="#0a0a0a" strokeWidth="0.5" opacity="0.36" />
      </pattern>
      <pattern id="p-dots" width="4.4" height="4.4" patternUnits="userSpaceOnUse">
        <rect width="4.4" height="4.4" fill="#fbfbfb" />
        <circle cx="2.2" cy="2.2" r="0.78" fill="#0a0a0a" opacity="0.4" />
      </pattern>
      <filter id="grain" x="0%" y="0%" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="9" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
    </defs>
  )
}
