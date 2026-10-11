// outline pictograms for the og grid, the parts a gadget is made of. each one lives on a 100 grid
// and is drawn as a stroke only, so the line weight can stay the same at any size.

const circle = (x, y, r) => `M${x - r} ${y} A${r} ${r} 0 1 0 ${x + r} ${y} A${r} ${r} 0 1 0 ${x - r} ${y} Z`
const rr = (x, y, w, h, r) => `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`

// scalloped badge: a circle with soft bumps
function badge(cx, cy, r, bumps = 8, depth = 0.11) {
  let d = ''
  for (let i = 0; i <= 160; i++) {
    const t = (i / 160) * Math.PI * 2
    const k = r * (1 + depth * Math.cos(bumps * t))
    d += `${i ? 'L' : 'M'}${(cx + k * Math.cos(t)).toFixed(2)} ${(cy + k * Math.sin(t)).toFixed(2)} `
  }
  return d + 'Z'
}

// a square wave with soft corners: high between each pair of edges
function wave(xs, hi, lo, r) {
  let d = `M${xs[0]} ${lo}`
  for (let i = 1; i < xs.length - 1; i++) {
    const x = xs[i], up = i % 2 === 1
    const [from, to] = up ? [lo, hi] : [hi, lo]
    const s = up ? -1 : 1
    d += ` H${x - r} Q${x} ${from} ${x} ${from + s * r} V${to - s * r} Q${x} ${to} ${x + r} ${to}`
  }
  return d + ` H${xs[xs.length - 1]}`
}

export const PICTOS = {
  // the mark as an outline
  led: `M29 58 V27 A21 21 0 0 1 71 27 V58 ${rr(21, 58, 58, 10, 5)} M38 68 V94 M62 68 V86`,
  resistor: `${rr(22, 36, 56, 28, 14)} M4 50 H22 M78 50 H96 M38 36 V64 M50 36 V64 M62 36 V64`,
  chip: `${rr(24, 16, 52, 68, 6)} M43 16 A7 7 0 0 0 57 16 M24 30 H12 M24 44 H12 M24 58 H12 M24 72 H12 M76 30 H88 M76 44 H88 M76 58 H88 M76 72 H88`,
  button: `${rr(14, 14, 72, 72, 14)} ${circle(50, 50, 20)}`,
  knob: `${circle(50, 50, 34)} M50 50 L50 24`,
  proof: `${badge(50, 50, 36)} M35 51 L45 61 L66 39`,
  blink: wave([4, 20, 40, 60, 80, 96], 34, 66, 6),
  // the body, and a horn: a capsule pivoting on the shaft, with a hole near its tip
  servo: `${rr(8, 48, 60, 36, 8)} M27.7 36.6 L74.7 13.6 A8 8 0 0 1 81.7 28 L34.7 51 A8 8 0 0 1 27.7 36.6 Z ${circle(31, 44, 4)} ${circle(76, 21, 3)}`,
  // a jumper wire with a plug on each end
  wire: `M20 74 C20 40 80 60 80 26 ${rr(13, 74, 14, 18, 3)} ${rr(73, 8, 14, 18, 3)} M20 92 V98 M80 8 V2`,
  bolt: 'M56 6 L24 56 H48 L42 94 L76 42 H52 Z',
}

export const PICTO_NAMES = Object.keys(PICTOS)

// one pictogram placed at x, y and `size` px wide, stroke `w` px whatever the size
export function picto(name, x, y, size, { stroke = '#D1CAC2', w = 3.5, rotate = 0 } = {}) {
  const k = size / 100
  return `<g transform="translate(${x} ${y}) rotate(${rotate} ${size / 2} ${size / 2}) scale(${k})"><path d="${PICTOS[name]}" fill="none" stroke="${stroke}" stroke-width="${(w / k).toFixed(3)}" stroke-linecap="round" stroke-linejoin="round"/></g>`
}
