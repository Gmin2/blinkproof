// the mark: a 5mm led seen side on. one filled path, viewBox 0 0 100 100.
// a round dome, the flat flange at its base, two legs, the anode a little longer.

const f = (n) => +n.toFixed(2)

const DOME = { x0: 29, x1: 71, top: 6, base: 58 }
const r = (DOME.x1 - DOME.x0) / 2
const FLANGE = { x0: 23, x1: 77, y0: 58, y1: 67, r: 3 }
const LEG = { w: 7.5, anode: 34.5, cathode: 58, anodeEnd: 96, cathodeEnd: 88 }

const dome = `M${DOME.x0} ${DOME.base} V${DOME.top + r} A${r} ${r} 0 0 1 ${DOME.x1} ${DOME.top + r} V${DOME.base} Z`
const flange = (() => {
  const { x0, x1, y0, y1, r: k } = FLANGE
  return `M${x0 + k} ${y0} H${x1 - k} Q${x1} ${y0} ${x1} ${y0 + k} V${y1 - k} Q${x1} ${y1} ${x1 - k} ${y1} H${x0 + k} Q${x0} ${y1} ${x0} ${y1 - k} V${y0 + k} Q${x0} ${y0} ${x0 + k} ${y0} Z`
})()
const leg = (x, end) => {
  const h = LEG.w / 2
  return `M${f(x)} ${FLANGE.y1 - 1} H${f(x + LEG.w)} V${f(end - h)} A${h} ${h} 0 0 1 ${f(x)} ${f(end - h)} Z`
}

export const MARK = [dome, flange, leg(LEG.anode, LEG.anodeEnd), leg(LEG.cathode, LEG.cathodeEnd)].join(' ')

export function markSvg({ fill = '#343433', size = 100, bg = null, radius = 0, pad = 0 } = {}) {
  const k = (100 - pad * 2) / 100
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    (bg ? `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>` : '') +
    `<path d="${MARK}" fill="${fill}" transform="translate(${pad} ${pad}) scale(${k})"/></svg>`
  )
}
