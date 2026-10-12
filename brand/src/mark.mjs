// the mark: an led the way a schematic draws it. viewBox 0 0 100 100, two filled shapes.
// BODY is the diode in ink: the two leads, the triangle and the bar. LIGHT is the two arrows it gives off, in lit.

const rr = (x, y, w, h, r) => `M${x + r} ${y} H${x + w - r} A${r} ${r} 0 0 1 ${x + w} ${y + r} V${y + h - r} A${r} ${r} 0 0 1 ${x + w - r} ${y + h} H${x + r} A${r} ${r} 0 0 1 ${x} ${y + h - r} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} Z`

export const BODY = [rr(4.5, 56.5, 23.5, 7, 3.5), 'M28 38 L60 60 L28 82 Z', rr(58.5, 34, 7, 52, 3.5), rr(62, 56.5, 33.5, 7, 3.5)].join(' ')

// each arrow runs up and right at 45 degrees: a 5.5 wide shaft and a head 9 long, 12 across
export const LIGHT =
  'M58.94 31.94 L69.58 21.31 L71.88 23.61 L74 13 L63.39 15.12 L65.69 17.42 L55.06 28.06 Z ' +
  'M71.94 44.94 L82.58 34.31 L84.88 36.61 L87 26 L76.39 28.12 L78.69 30.42 L68.06 41.06 Z'

export const LIT = '#F2552C'

// lit defaults to the brand orange; pass the fill again for a one colour version
export function markSvg({ fill = '#343433', lit = LIT, size = 100, bg = null, radius = 0, pad = 0 } = {}) {
  const k = (100 - pad * 2) / 100
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    (bg ? `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>` : '') +
    `<g transform="translate(${pad} ${pad}) scale(${k})"><path d="${BODY}" fill="${fill}"/><path d="${LIGHT}" fill="${lit}"/></g></svg>`
  )
}
