// the blinkproof firefly. viewBox 0 0 100 100.
// one egg body cut in two by a curved gap: the head on top, the lantern below. the lantern
// is the only part that ever lights up, and only when the gadget is proven.
// solids wind clockwise and holes counter clockwise, so the mark is one path with fill-rule nonzero.

const f = (n) => +n.toFixed(2)

// the egg: a wider top half, a slightly shorter bottom half
const CX = 50, CY = 57, RX = 31, RY_TOP = 36, RY_BOT = 37
const egg = (t) => [CX + RX * Math.cos(t), CY + (Math.sin(t) < 0 ? RY_TOP : RY_BOT) * Math.sin(t)]

// the gap is a smile across the belly, GAP thick
const GAP_Y = 58, BEND = 0.0065, GAP = 6
const curve = (x, off = 0) => GAP_Y + off + BEND * (x - CX) ** 2

// angle on the right side of the egg where it meets a gap curve
function meet(off) {
  let lo = 0, hi = Math.PI / 2
  for (let i = 0; i < 50; i++) {
    const mid = (lo + hi) / 2
    const [x, y] = egg(mid)
    if (y < curve(x, off)) lo = mid
    else hi = mid
  }
  return lo
}

// shoelace in screen space: positive is clockwise. solids are forced clockwise
const cw = (list) => (list.reduce((a, [x, y], i) => { const [x2, y2] = list[(i + 1) % list.length]; return a + (x * y2 - x2 * y) }, 0) < 0 ? [...list].reverse() : list)
const pts = (list) => 'M' + cw(list).map(([x, y]) => `${f(x)} ${f(y)}`).join(' L') + ' Z'

function arcPts(from, to, n = 64) {
  const out = []
  for (let i = 0; i <= n; i++) out.push(egg(from + ((to - from) * i) / n))
  return out
}

function curvePts(x0, x1, off, n = 24) {
  const out = []
  for (let i = 0; i <= n; i++) {
    const x = x0 + ((x1 - x0) * i) / n
    out.push([x, curve(x, off)])
  }
  return out
}

// head: from the left meeting point over the top to the right one, back along the gap
const tHead = meet(0)
const HEAD_PTS = (() => {
  const a = arcPts(-Math.PI - tHead, tHead, 96)
  return [...a, ...curvePts(a[a.length - 1][0], a[0][0], 0).slice(1, -1)]
})()

// lantern: the egg below the lower edge of the gap, right round the bottom to left
const tLamp = meet(GAP)
const LAMP_PTS = (() => {
  const a = arcPts(tLamp, Math.PI - tLamp, 64)
  return [...a, ...curvePts(a[a.length - 1][0], a[0][0], GAP).slice(1, -1)]
})()

// the body leans back so the lantern trails low right like a tail, and never reads as a mouth
const TILT = (-30 * Math.PI) / 180, SCALE = 0.84, DX = 0, DY = 6
const lean = ([x, y]) => {
  const ux = x - CX, uy = y - CY
  return [CX + DX + SCALE * (ux * Math.cos(TILT) - uy * Math.sin(TILT)), CY + DY + SCALE * (ux * Math.sin(TILT) + uy * Math.cos(TILT))]
}
export const HEAD = pts(HEAD_PTS.map(lean))
export const LANTERN = pts(LAMP_PTS.map(lean))

// antennae: two thin stalks ending in round pads, like a solder pad on a wire end
function stalk(x0, y0, cx, cy, x1, y1, w) {
  const left = [], right = []
  for (let i = 0; i <= 20; i++) {
    const t = i / 20
    const x = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1
    const y = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1
    const dx = 2 * (1 - t) * (cx - x0) + 2 * t * (x1 - cx)
    const dy = 2 * (1 - t) * (cy - y0) + 2 * t * (y1 - cy)
    const len = Math.hypot(dx, dy)
    left.push([x - (dy / len) * w / 2, y + (dx / len) * w / 2])
    right.push([x + (dy / len) * w / 2, y - (dx / len) * w / 2])
  }
  return pts([...left, ...right.reverse()])
}

const circle = (x, y, r, ccw = false) =>
  ccw
    ? `M${f(x + r)} ${f(y)} A${r} ${r} 0 1 0 ${f(x - r)} ${f(y)} A${r} ${r} 0 1 0 ${f(x + r)} ${f(y)} Z`
    : `M${f(x - r)} ${f(y)} A${r} ${r} 0 1 1 ${f(x + r)} ${f(y)} A${r} ${r} 0 1 1 ${f(x - r)} ${f(y)} Z`

// the face stays upright on the leaning head
const [HX, HY] = lean([50, 37])
const [AL, AR] = [lean([41, 23]), lean([58, 21.5])]
export const ANTENNAE = [stalk(AL[0], AL[1], AL[0] - 3, AL[1] - 11, AL[0] - 10, AL[1] - 16, 3.2), stalk(AR[0], AR[1], AR[0] + 1, AR[1] - 11, AR[0] + 9, AR[1] - 17, 3.2)].join(' ')
const PAD_AT = [[AL[0] - 11, AL[1] - 16.5], [AR[0] + 10, AR[1] - 17.5]]
export const PADS = PAD_AT.map(([x, y]) => circle(x, y, 5)).join(' ')

// wings: two lobes folded along the back, kept clear of the body
function lobe(cx, cy, rx, ry, deg) {
  const a = (deg * Math.PI) / 180
  const out = []
  for (let i = 0; i < 48; i++) {
    const t = (i / 48) * Math.PI * 2
    const x = rx * Math.cos(t), y = ry * Math.sin(t)
    out.push([cx + x * Math.cos(a) - y * Math.sin(a), cy + x * Math.sin(a) + y * Math.cos(a)])
  }
  return pts(out)
}
// one wing, a long teardrop lying along the back from the shoulder toward the tail
function wing() {
  const out = []
  for (let i = 0; i < 64; i++) {
    const t = (i / 64) * Math.PI * 2
    // fatter near the tail end, so it reads as a wing and not a leaf
    const w = 8.5 * (1 + 0.35 * Math.sin(t))
    out.push(lean([92 + w * Math.cos(t) * 0.9, 50 + 25 * Math.sin(t)]))
  }
  return pts(out)
}
export const WINGS = wing()

// eyes, as holes (counter clockwise)
const EYE_Y = HY + 2
const EYE_X = [HX - 7, HX + 11]

const dot = (x, y, r) => circle(x, y, r, true)

function slit(x, y, w, h) {
  const r = h / 2
  return `M${f(x + w / 2 - r)} ${f(y - r)} H${f(x - w / 2 + r)} A${r} ${r} 0 0 0 ${f(x - w / 2 + r)} ${f(y + r)} H${f(x + w / 2 - r)} A${r} ${r} 0 0 0 ${f(x + w / 2 - r)} ${f(y - r)} Z`
}

// a lid half down over a round eye: flat top, round bottom
function lid(x, y, r) {
  return `M${f(x + r)} ${f(y)} H${f(x - r)} A${r} ${r} 0 0 0 ${f(x + r)} ${f(y)} Z`
}

// happy arc: an upside down u, a thick crescent
function happy(x, y, r, t) {
  const ri = r - t
  return `M${f(x + r)} ${f(y)} A${r} ${r} 0 0 0 ${f(x - r)} ${f(y)} L${f(x - ri)} ${f(y)} A${ri} ${ri} 0 0 1 ${f(x + ri)} ${f(y)} Z`
}

export const STATES = {
  idle: { eyes: () => EYE_X.map((x) => lid(x, EYE_Y, 6.5)), lantern: 'off', lift: 0 },
  building: { eyes: () => EYE_X.map((x) => dot(x, EYE_Y + 3, 5)), lantern: 'off', lift: 0 },
  testing: { eyes: () => EYE_X.map((x) => dot(x, EYE_Y, 7)), lantern: 'blink', lift: 0 },
  failed: { eyes: () => EYE_X.map((x) => slit(x, EYE_Y + 1, 13, 3.6)), lantern: 'fail', lift: 4 },
  proven: { eyes: () => EYE_X.map((x) => happy(x, EYE_Y + 3, 7, 3.6)), lantern: 'on', lift: -4 },
}
export const STATE_NAMES = Object.keys(STATES)

// the one colour mark: every solid plus the eyes as holes
export function markPath(state = 'testing', { wings = true, antennae = true } = {}) {
  return [HEAD, LANTERN, ...(antennae ? [ANTENNAE, PADS] : []), ...(wings ? [WINGS] : []), ...STATES[state].eyes()].join(' ')
}

// at 16px a pixel is 6.25 units: no wings, no stalks, pads kept, eyes fattened
export function mark16Path() {
  return [HEAD, LANTERN, ...PAD_AT.map(([x, y]) => circle(x + (x < 50 ? 3 : -3), y + 3, 6.5)), ...EYE_X.map((x) => dot(x, EYE_Y, 7.5))].join(' ')
}

export function markSvg(state = 'testing', { fill = '#141414', size = 100, bg = null, radius = 0, small = false } = {}) {
  const lift = STATES[state].lift
  const d = small ? mark16Path() : markPath(state)
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    (bg ? `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>` : '') +
    `<path d="${d}" fill="${fill}" fill-rule="nonzero" transform="translate(0 ${lift})"/></svg>`
  )
}

const LAMP = { off: null, blink: 'glowDim', fail: 'bad', on: 'glow' }

// the character: paper body, ink eyes, see through wings, a lantern lit by state
export function characterSvg(state = 'testing', c, { size = 100, bg = null, radius = 0, lit } = {}) {
  const s = STATES[state]
  const lamp = lit ?? LAMP[s.lantern]
  const lampFill = lamp ? c[lamp] : c.lampOff
  const halo = lamp === 'glow' ? `<ellipse cx="50" cy="78" rx="40" ry="28" fill="${c.glow}" opacity="0.45" filter="url(#halo)"/>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">` +
    `<defs><filter id="halo" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="7"/></filter></defs>` +
    (bg ? `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>` : '') +
    `<g transform="translate(0 ${s.lift})">` +
    halo +
    `<path d="${WINGS}" fill="${c.body}" opacity="0.4"/>` +
    `<path d="${ANTENNAE} ${PADS}" fill="${c.body}"/>` +
    `<path d="${HEAD}" fill="${c.body}"/>` +
    `<path d="${LANTERN}" fill="${lampFill}"/>` +
    s.eyes().map((d) => `<path d="${d}" fill="${c.eyes}"/>`).join('') +
    `</g></svg>`
  )
}
