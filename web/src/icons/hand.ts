import rough from 'roughjs/bin/rough'

// hand drawn icons. each one is a few shapes on a 24 unit grid, roughjs wobbles the lines, and a soft blob of
// colour sits a little off the outline like a marker that missed. seeded, so an icon looks the same every time

type Shape =
  | { line: number[] }
  | { poly: number[]; close?: boolean }
  | { curve: number[] }
  | { circle: [number, number, number] }
  | { rect: [number, number, number, number] }
  | { path: string }

// the blob behind the outline, in the icon's accent colour
type Blob = { circle: [number, number, number] } | { rect: [number, number, number, number] } | { poly: number[] }

export type IconDef = { shapes: Shape[]; blob?: Blob; accent?: Accent }

export type Accent = 'yellow' | 'green' | 'pink' | 'blue' | 'orange' | 'purple'

export const ACCENTS: Record<Accent, string> = {
  yellow: '#ffd84d',
  green: '#7ee2a0',
  pink: '#ff9ec2',
  blue: '#8ec5ff',
  orange: '#ffb067',
  purple: '#c3a6ff',
}

export const ICONS = {
  // the mark: a led with a tick in it, blinkproof
  logo: {
    shapes: [
      { path: 'M6.5 13 C6.5 6.5 17.5 6.5 17.5 13 L17.5 16 L6.5 16 Z' },
      { line: [5, 16, 19, 16] },
      { line: [9, 16, 9, 21.5] },
      { line: [15, 16, 15, 20] },
      { poly: [9, 11.6, 11.2, 13.6, 15, 9.4], close: false },
      { line: [12, 2, 12, 3.6] },
      { line: [4, 5, 5.3, 6.2] },
      { line: [20, 5, 18.7, 6.2] },
    ],
    blob: { circle: [12.8, 11.6, 11.5] },
    accent: 'yellow',
  },
  build: {
    shapes: [
      { line: [4, 20, 14, 10] },
      { line: [5.6, 21.4, 15.4, 11.6] },
      { path: 'M17 2.5 L17.9 5.6 L21 6.5 L17.9 7.4 L17 10.5 L16.1 7.4 L13 6.5 L16.1 5.6 Z' },
      { path: 'M8 3 L8.5 4.7 L10.2 5.2 L8.5 5.7 L8 7.4 L7.5 5.7 L5.8 5.2 L7.5 4.7 Z' },
    ],
    blob: { circle: [17, 7, 8] },
    accent: 'yellow',
  },
  play: { shapes: [{ poly: [7, 4.5, 19, 12, 7, 19.5] }], blob: { circle: [13, 12.5, 13] }, accent: 'green' },
  pause: { shapes: [{ rect: [6.5, 5, 3.6, 14] }, { rect: [13.9, 5, 3.6, 14] }], blob: { circle: [12.5, 12.5, 13] }, accent: 'orange' },
  test: {
    shapes: [
      { line: [9, 3, 15, 3] },
      { path: 'M10 3 L10 9.5 L4.8 18.6 C4.1 19.9 5 21 6.4 21 L17.6 21 C19 21 19.9 19.9 19.2 18.6 L14 9.5 L14 3' },
      { line: [7.2, 15, 16.8, 15] },
      { circle: [10.5, 18, 1.4] },
      { circle: [14, 17.4, 0.9] },
    ],
    blob: { poly: [6.2, 15.6, 17.8, 15.6, 19.6, 20.6, 4.6, 20.6] },
    accent: 'green',
  },
  replay: {
    shapes: [
      { path: 'M19.5 12 A7.5 7.5 0 1 1 16.8 6.2' },
      { poly: [17.6, 2.6, 17.4, 7, 13, 6.6], close: false },
    ],
    blob: { circle: [12.5, 12.5, 12] },
    accent: 'blue',
  },
  'sound-on': {
    shapes: [
      { poly: [3.5, 9.5, 7.5, 9.5, 12, 5, 12, 19, 7.5, 14.5, 3.5, 14.5] },
      { path: 'M15.5 9 C17 10.6 17 13.4 15.5 15' },
      { path: 'M18.2 6.4 C21.2 9.6 21.2 14.4 18.2 17.6' },
    ],
    blob: { circle: [8.5, 12.5, 9] },
    accent: 'pink',
  },
  'sound-off': {
    shapes: [
      { poly: [3.5, 9.5, 7.5, 9.5, 12, 5, 12, 19, 7.5, 14.5, 3.5, 14.5] },
      { line: [15.5, 9.5, 20.5, 14.5] },
      { line: [20.5, 9.5, 15.5, 14.5] },
    ],
    blob: { circle: [8.5, 12.5, 9] },
    accent: 'pink',
  },
  sun: {
    shapes: [
      { circle: [12, 12, 8] },
      { line: [12, 1.5, 12, 3.5] },
      { line: [12, 20.5, 12, 22.5] },
      { line: [1.5, 12, 3.5, 12] },
      { line: [20.5, 12, 22.5, 12] },
      { line: [4.6, 4.6, 6, 6] },
      { line: [18, 18, 19.4, 19.4] },
      { line: [4.6, 19.4, 6, 18] },
      { line: [18, 6, 19.4, 4.6] },
    ],
    blob: { circle: [12.6, 12.6, 9] },
    accent: 'yellow',
  },
  moon: {
    shapes: [{ path: 'M19.5 14.5 A8.2 8.2 0 1 1 10 4 A6.4 6.4 0 0 0 19.5 14.5 Z' }, { path: 'M17 3.5 L17.5 5 L19 5.5 L17.5 6 L17 7.5 L16.5 6 L15 5.5 L16.5 5 Z' }],
    blob: { circle: [11, 13, 12] },
    accent: 'purple',
  },
  examples: {
    shapes: [
      { path: 'M12 6 C9.5 4.2 6.5 4 3 4.6 L3 19 C6.5 18.4 9.5 18.6 12 20.4 C14.5 18.6 17.5 18.4 21 19 L21 4.6 C17.5 4 14.5 4.2 12 6 Z' },
      { line: [12, 6, 12, 20.4] },
      { line: [5.5, 8.5, 9.5, 9.2] },
      { line: [5.5, 11.5, 9.5, 12.2] },
    ],
    blob: { rect: [13.5, 6.5, 7.5, 12] },
    accent: 'orange',
  },
  code: {
    shapes: [{ poly: [8, 6.5, 3, 12, 8, 17.5], close: false }, { poly: [16, 6.5, 21, 12, 16, 17.5], close: false }, { line: [13.6, 4.5, 10.4, 19.5] }],
    blob: { circle: [12.5, 12.5, 10] },
    accent: 'blue',
  },
  serial: {
    shapes: [{ rect: [2.5, 4, 19, 16] }, { poly: [6, 9, 9, 12, 6, 15], close: false }, { line: [11, 15.5, 16, 15.5] }],
    blob: { rect: [4, 6, 18, 15] },
    accent: 'green',
  },
  checks: {
    shapes: [
      { rect: [5, 4, 14, 17.5] },
      { rect: [8.5, 2.5, 7, 3] },
      { poly: [8, 12, 10.5, 14.5, 16, 9], close: false },
      { line: [8.5, 18, 15.5, 18] },
    ],
    blob: { rect: [6.5, 6, 13.5, 16] },
    accent: 'yellow',
  },
  layers: {
    shapes: [
      { poly: [12, 3.5, 21, 8, 12, 12.5, 3, 8] },
      { poly: [4.5, 11.8, 3, 12.5, 12, 17, 21, 12.5, 19.5, 11.8], close: false },
      { poly: [4.5, 16.3, 3, 17, 12, 21.5, 21, 17, 19.5, 16.3], close: false },
    ],
    blob: { poly: [12, 5, 21, 9.4, 12, 13.8, 3.4, 9.4] },
    accent: 'purple',
  },
  export: {
    shapes: [{ path: 'M4 13 L4 20 L20 20 L20 13' }, { line: [12, 15.5, 12, 3.5] }, { poly: [7.5, 8, 12, 3.5, 16.5, 8], close: false }],
    blob: { rect: [5.5, 13.5, 15.5, 7.5] },
    accent: 'blue',
  },
  zoom: {
    shapes: [{ circle: [10.5, 10.5, 13] }, { line: [15.3, 15.3, 20.5, 20.5] }, { line: [7.5, 10.5, 13.5, 10.5] }, { line: [10.5, 7.5, 10.5, 13.5] }],
    blob: { circle: [11.2, 11.2, 11] },
    accent: 'yellow',
  },
  clock: {
    shapes: [{ circle: [12, 12, 18] }, { poly: [12, 6.5, 12, 12, 16, 14.5], close: false }],
    blob: { circle: [12.6, 12.6, 15] },
    accent: 'blue',
  },
  wire: {
    shapes: [{ path: 'M3 18 C8 18 7 6 12 6 C17 6 16 18 21 18' }, { circle: [3, 18, 3] }, { circle: [21, 18, 3] }],
    blob: { rect: [6, 8, 12, 9] },
    accent: 'orange',
  },
  pass: { shapes: [{ circle: [12, 12, 17.5] }, { poly: [7.8, 12.3, 10.8, 15.2, 16.4, 9], close: false }], blob: { circle: [12.6, 12.6, 15] }, accent: 'green' },
  fail: { shapes: [{ circle: [12, 12, 17.5] }, { line: [8.6, 8.6, 15.4, 15.4] }, { line: [15.4, 8.6, 8.6, 15.4] }], blob: { circle: [12.6, 12.6, 15] }, accent: 'pink' },
  warn: {
    shapes: [{ poly: [12, 3.2, 21.5, 20, 2.5, 20] }, { line: [12, 9.5, 12, 14] }, { circle: [12, 16.9, 0.9] }],
    blob: { poly: [12, 5.5, 20.5, 20.5, 4, 20.5] },
    accent: 'orange',
  },

  // parts
  board: {
    shapes: [
      { rect: [2.5, 5, 19, 14] },
      { rect: [9, 9, 6, 6] },
      ...[5, 8, 11, 14, 17].map((x) => ({ line: [x + 1, 5, x + 1, 3] })),
      ...[5, 8, 11, 14, 17].map((x) => ({ line: [x + 1, 19, x + 1, 21] })),
    ],
    blob: { rect: [4, 6.5, 18.5, 13.5] },
    accent: 'blue',
  },
  pico: {
    shapes: [
      { rect: [7, 2, 10, 20] },
      { rect: [10, 1, 4, 2.4] },
      { rect: [9.5, 9, 5, 5] },
      ...[5, 8, 11, 14, 17, 20].map((y) => ({ line: [5, y, 7, y] })),
      ...[5, 8, 11, 14, 17, 20].map((y) => ({ line: [17, y, 19, y] })),
    ],
    blob: { rect: [8.5, 3.5, 10, 19] },
    accent: 'green',
  },
  led: {
    shapes: [{ path: 'M7 13 C7 6.5 17 6.5 17 13 L17 16 L7 16 Z' }, { line: [5.5, 16, 18.5, 16] }, { line: [9.5, 16, 9.5, 21.5] }, { line: [14.5, 16, 14.5, 20] }],
    blob: { circle: [12.6, 12, 11] },
    accent: 'pink',
  },
  resistor: {
    shapes: [{ line: [2, 12, 6, 12] }, { poly: [6, 12, 7.5, 8.5, 10.5, 15.5, 13.5, 8.5, 16.5, 15.5, 18, 12], close: false }, { line: [18, 12, 22, 12] }],
    blob: { rect: [6.5, 8.5, 12.5, 8] },
    accent: 'orange',
  },
  button: {
    shapes: [{ rect: [4, 6, 16, 12] }, { circle: [12, 12, 7] }, { line: [6, 6, 6, 3.5] }, { line: [18, 6, 18, 3.5] }, { line: [6, 18, 6, 20.5] }, { line: [18, 18, 18, 20.5] }],
    blob: { circle: [12.6, 12.6, 9] },
    accent: 'pink',
  },
  screen: {
    shapes: [{ rect: [2.5, 4.5, 19, 15] }, { rect: [5, 7.5, 14, 8.5] }, { line: [7, 10.5, 12, 10.5] }, { line: [7, 13.2, 15, 13.2] }],
    blob: { rect: [5.5, 8, 14.5, 9.5] },
    accent: 'blue',
  },
  knob: {
    shapes: [{ rect: [3.5, 3.5, 17, 17] }, { circle: [12, 12, 11] }, { line: [12, 12, 15.2, 8.2] }],
    blob: { circle: [12.6, 12.6, 12] },
    accent: 'purple',
  },
  ring: {
    shapes: Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2
      return { circle: [12 + Math.cos(a) * 7.5, 12 + Math.sin(a) * 7.5, 3.4] as [number, number, number] }
    }),
    blob: { circle: [12.6, 12.6, 19] },
    accent: 'green',
  },
  servo: {
    shapes: [{ rect: [3, 9, 15, 10] }, { circle: [8, 14, 5] }, { path: 'M8 14 L8 3.5 C8 2.5 10.5 2.5 10.5 3.5 L10 14' }, { line: [18, 13, 21.5, 13] }],
    blob: { rect: [4.5, 10.5, 15, 10] },
    accent: 'orange',
  },
  sonar: {
    shapes: [{ rect: [2, 6, 20, 12] }, { circle: [7.5, 12, 7] }, { circle: [16.5, 12, 7] }, { circle: [7.5, 12, 2.5] }, { circle: [16.5, 12, 2.5] }],
    blob: { rect: [3.5, 7.5, 20, 12] },
    accent: 'blue',
  },
  buzzer: {
    shapes: [{ circle: [11, 12, 15] }, { circle: [11, 12, 5] }, { path: 'M19.5 7.5 C21 9.8 21 14.2 19.5 16.5' }],
    blob: { circle: [11.6, 12.6, 15] },
    accent: 'yellow',
  },
  pixel: {
    shapes: [{ rect: [5, 5, 14, 14] }, { circle: [12, 12, 6] }, { line: [12, 1.5, 12, 3.5] }, { line: [12, 20.5, 12, 22.5] }],
    blob: { circle: [12.6, 12.6, 9] },
    accent: 'pink',
  },
} satisfies Record<string, IconDef>

export type IconName = keyof typeof ICONS

export type IconPath = { d: string; stroke?: string; strokeWidth?: number; fill?: string }

const gen = rough.generator()

// the ink outline and the accent blob as plain path data on the 24 grid, ink drawn in currentColor
export function iconPaths(name: IconName, seed = 7): { blob?: string; ink: IconPath[] } {
  const def: IconDef = ICONS[name]
  const ink = { stroke: 'currentColor', strokeWidth: 1.5, roughness: 0.7, bowing: 0.9, seed, preserveVertices: false }
  const drawables = def.shapes.map((s, i) => {
    const o = { ...ink, seed: seed + i }
    if ('line' in s) return gen.line(s.line[0], s.line[1], s.line[2], s.line[3], o)
    if ('poly' in s) {
      const pts: [number, number][] = []
      for (let k = 0; k < s.poly.length; k += 2) pts.push([s.poly[k], s.poly[k + 1]])
      return s.close === false ? gen.linearPath(pts, o) : gen.polygon(pts, o)
    }
    if ('curve' in s) {
      const pts: [number, number][] = []
      for (let k = 0; k < s.curve.length; k += 2) pts.push([s.curve[k], s.curve[k + 1]])
      return gen.curve(pts, o)
    }
    if ('circle' in s) return gen.circle(s.circle[0], s.circle[1], s.circle[2], o)
    if ('rect' in s) return gen.rectangle(s.rect[0], s.rect[1], s.rect[2], s.rect[3], o)
    return gen.path(s.path, o)
  })
  let blob: string | undefined
  if (def.blob) {
    const o = { roughness: 1.6, bowing: 2, seed: seed + 99, fill: 'x', fillStyle: 'solid', stroke: 'none' }
    const b = def.blob
    const d =
      'circle' in b
        ? gen.circle(b.circle[0], b.circle[1], b.circle[2], o)
        : 'rect' in b
          ? gen.rectangle(b.rect[0], b.rect[1], b.rect[2], b.rect[3], o)
          : gen.polygon(
              b.poly.reduce<[number, number][]>((a, v, k) => (k % 2 ? (a[a.length - 1][1] = v, a) : [...a, [v, 0]]), []),
              o,
            )
    blob = gen.toPaths(d).find((p) => p.fill && p.fill !== 'none')?.d
  }
  return { blob, ink: drawables.flatMap((d) => gen.toPaths(d)).map((p) => ({ d: p.d, strokeWidth: p.strokeWidth })) }
}
