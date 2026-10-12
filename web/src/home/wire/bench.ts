import { box, cyl, grid, mesh, rotX, seg, translate, type Edge, type Mesh, type V3 } from './vec'

// the parking sensor on the bench: an uno, a half breadboard, the sonar standing at its front edge,
// the oled standing at the back, the led ring lifted on its pins and a buzzer, with jumpers arcing
// across. one unit is about 25 mm. the desk is y = DESK, everything sits on it. +z is toward the camera

export const DESK = -0.62

const UNO = { x: -1.75, z: 0.05, w: 2.75, d: 2.13, t: 0.07 }
const BB = { x: 1.45, z: 0.05, w: 3.3, d: 2.2, h: 0.34 }
const UNO_TOP = DESK + 0.12 + UNO.t
const BB_TOP = DESK + BB.h

const at = (m: Mesh[], o: V3) => m.map((x) => translate(x, o))

// a curve sampled into a polyline, for jumpers
function arc(a: V3, b: V3, lift: number, n = 14, ghost = 0): Mesh {
  const pts: V3[] = []
  const edges: Edge[] = []
  const mid: V3 = [(a[0] + b[0]) / 2, Math.max(a[1], b[1]) + lift, (a[2] + b[2]) / 2]
  for (let i = 0; i <= n; i++) {
    const t = i / n
    const u = 1 - t
    pts.push([u * u * a[0] + 2 * u * t * mid[0] + t * t * b[0], u * u * a[1] + 2 * u * t * mid[1] + t * t * b[1], u * u * a[2] + 2 * u * t * mid[2] + t * t * b[2]])
    if (i) edges.push([i - 1, i])
  }
  return mesh(pts, edges, ghost)
}

// a run of pins as single segments, one edge each
function pins(n: number, from: V3, step: V3, h: number): Mesh {
  const pts: V3[] = []
  const edges: Edge[] = []
  for (let i = 0; i < n; i++) {
    const p: V3 = [from[0] + step[0] * i, from[1] + step[1] * i, from[2] + step[2] * i]
    pts.push(p, [p[0], p[1] - h, p[2]])
    edges.push([i * 2, i * 2 + 1])
  }
  return mesh(pts, edges)
}

function uno(): Mesh[] {
  const { w, d, t } = UNO
  const y = DESK + 0.12 + t / 2
  const out: Mesh[] = [{ ...translate(box(w, t, d), [0, y, 0]), base: true }]
  // standoffs under the corners
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) out.push(translate(cyl(0.05, 0.12, 8, 0, 4), [sx * w * 0.42, DESK + 0.06, sz * d * 0.4]))
  const top = UNO_TOP
  // usb b and the barrel jack hang over the left edge
  out.push(translate(box(0.62, 0.42, 0.48), [-w / 2 + 0.2, top + 0.21, -d * 0.22]))
  out.push(translate(box(0.56, 0.4, 0.36), [-w / 2 + 0.18, top + 0.2, d * 0.3]))
  // the two long female headers, back and front
  out.push(translate(box(w * 0.66, 0.32, 0.12), [w * 0.12, top + 0.16, -d / 2 + 0.12]))
  out.push(translate(box(w * 0.56, 0.32, 0.12), [w * 0.16, top + 0.16, d / 2 - 0.12]))
  // the atmega328 in its socket, with its legs
  out.push(translate(box(1.4, 0.14, 0.36), [w * 0.14, top + 0.07, d * 0.13]))
  out.push(pins(14, [w * 0.14 - 0.65, top + 0.04, d * 0.13 - 0.2], [0.1, 0, 0], 0.05))
  out.push(pins(14, [w * 0.14 - 0.65, top + 0.04, d * 0.13 + 0.2], [0.1, 0, 0], 0.05))
  // the 16u2, the crystal and the reset button
  out.push(translate(box(0.28, 0.05, 0.28), [-w * 0.18, top + 0.025, -d * 0.18]))
  out.push(translate(box(0.26, 0.09, 0.1), [-w * 0.05, top + 0.045, d * 0.02]))
  out.push(translate(box(0.2, 0.08, 0.2), [-w / 2 + 0.55, top + 0.04, -d / 2 + 0.25]))
  out.push(translate(cyl(0.05, 0.05, 8, 0, 4), [-w / 2 + 0.55, top + 0.1, -d / 2 + 0.25]))
  // the icsp header at the right edge
  out.push(translate(box(0.2, 0.18, 0.3), [w / 2 - 0.2, top + 0.09, d * 0.05]))
  return at(out, [UNO.x, 0, UNO.z])
}

// holes as short ticks, one edge each: a 0.1 inch pitch is about 0.1 units here
function holes(cols: number, rows: number, x0: number, z0: number, step: number, y: number): Mesh {
  const pts: V3[] = []
  const edges: Edge[] = []
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++) {
      const x = x0 + c * step
      const z = z0 + r * step
      pts.push([x - 0.022, y, z], [x + 0.022, y, z])
      edges.push([pts.length - 2, pts.length - 1])
    }
  return mesh(pts, edges)
}

function breadboard(): Mesh[] {
  const { w, d, h } = BB
  const top = BB_TOP
  const y = top + 0.003
  const pitch = 0.1
  const cols = 30
  const x0 = -((cols - 1) * pitch) / 2
  const out: Mesh[] = [translate(box(w, h, d), [0, DESK + h / 2, 0])]
  // the centre channel
  out.push(translate(box(w * 0.94, 0.02, 0.12), [0, top - 0.01, 0]))
  for (const sz of [-1, 1]) {
    // the two blocks of five rows either side of the channel
    out.push(holes(cols, 5, x0, sz < 0 ? -0.12 - 4 * pitch : 0.12, pitch, y))
    // the two power rails along each long edge, with the lines printed beside them
    const rz = sz * (d / 2 - 0.13)
    out.push(holes(25, 1, x0 + 0.1, rz - 0.05, pitch * 1.12, y))
    out.push(holes(25, 1, x0 + 0.1, rz + 0.05, pitch * 1.12, y))
    out.push(seg([-w * 0.44, y, rz - sz * 0.13], [w * 0.44, y, rz - sz * 0.13]))
    out.push(seg([-w * 0.44, y, rz + sz * 0.11], [w * 0.44, y, rz + sz * 0.11]))
  }
  // all of it is flat on the desk or on its own top, so it goes down before the parts stood on it
  return at(out, [BB.x, 0, BB.z]).map((m) => ({ ...m, base: true }))
}

// hc-sr04 standing on its four pins at the front edge, the two cans looking out at +z
function sonar(): Mesh[] {
  const y0 = BB_TOP + 0.22
  const out: Mesh[] = [translate(box(1.8, 0.8, 0.06), [0, y0 + 0.4, 0])]
  for (const sx of [-1, 1]) {
    const can = rotX(cyl(0.31, 0.46, 18, 0, 6), Math.PI / 2)
    out.push(translate(can, [sx * 0.5, y0 + 0.42, 0.26]))
  }
  out.push(translate(box(0.22, 0.12, 0.1), [0, y0 + 0.66, 0.06]))
  out.push(pins(4, [-0.15, y0, 0], [0.1, 0, 0], 0.22))
  return at(out, [BB.x - 0.45, 0, BB.z + 0.78])
}

// the 0.96 inch oled standing at the back, its screen facing the front
function oled(): Mesh[] {
  const y0 = BB_TOP + 0.24
  const out: Mesh[] = [translate(box(1.05, 1.05, 0.05), [0, y0 + 0.52, 0])]
  out.push(translate(box(0.92, 0.52, 0.03), [0, y0 + 0.5, 0.04]))
  out.push(translate(box(0.6, 0.06, 0.03), [0, y0 + 0.18, 0.04]))
  out.push(pins(4, [-0.15, y0 + 0.98, 0.02], [0.1, 0, 0], 0.08))
  out.push(pins(4, [-0.15, y0, 0], [0.1, 0, 0], 0.24))
  return at(out, [BB.x + 0.75, 0, BB.z - 0.6])
}

// the 16 pixel ring lifted on three pins, flat, its pixels as little boxes
function ledRing(): Mesh[] {
  const y = BB_TOP + 0.55
  const out: Mesh[] = [{ ...translate(cyl(0.6, 0.06, 32, 0, 0), [0, y - 0.03, 0]), bias: 0.5 }]
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2
    out.push(translate(box(0.1, 0.05, 0.1), [Math.cos(a) * 0.49, y + 0.03, Math.sin(a) * 0.49]))
  }
  out.push(pins(3, [-0.1, y - 0.06, 0.55], [0.1, 0, 0], 0.49))
  return at(out, [BB.x - 0.45, 0, BB.z - 0.45])
}

function buzzer(): Mesh[] {
  const y = BB_TOP + 0.17
  return at([cyl(0.3, 0.3, 22, 0, 8), pins(2, [-0.06, -0.15, 0], [0.12, 0, 0], 0.05)], [BB.x + 1.15, y, BB.z + 0.45])
}

// the uno's headers to the breadboard, each a jumper arcing over the gap
function jumpers(): Mesh[] {
  const back = UNO.z - UNO.d / 2 + 0.12
  const front = UNO.z + UNO.d / 2 - 0.12
  const hy = UNO_TOP + 0.32
  const from = (x: number, z: number): V3 => [UNO.x + x, hy, z]
  const to = (x: number, z: number): V3 => [BB.x + x, BB_TOP, BB.z + z]
  // into the breadboard's left columns, low, the way you would wire it by hand. the parts take it from there
  return [
    arc(from(1.0, back), to(-1.48, -0.85), 0.32),
    arc(from(0.8, back), to(-1.48, -0.55), 0.3),
    arc(from(0.6, back), to(-1.38, -0.25), 0.28),
    arc(from(0.9, front), to(-1.48, 0.55), 0.28),
    arc(from(1.1, front), to(-1.48, 0.95), 0.3),
  ]
}

// the desk, faint, so the build has a floor to sit on
function desk(): Mesh[] {
  return [{ ...translate(grid(7.2, 3.6, 6, 3, 1), [0, DESK, 0]), floor: true }]
}

export function benchMeshes(): Mesh[] {
  return [...desk(), ...uno(), ...breadboard(), ...sonar(), ...oled(), ...ledRing(), ...buzzer(), ...jumpers()]
}

// points the callouts point at
export const ANCHORS: Record<string, V3> = {
  uno: [UNO.x + UNO.w * 0.14, UNO_TOP + 0.14, UNO.z + UNO.d * 0.13],
  sonar: [BB.x - 0.95, BB_TOP + 0.64, BB.z + 1.27],
  oled: [BB.x + 0.75, BB_TOP + 0.74, BB.z - 0.55],
  board: [BB.x + 0.2, BB_TOP, BB.z + 0.1],
}

// the top of the breadboard in (u, v), for the wash laid over it as the test runs
export function boardPoint(u: number, v: number): V3 {
  return [BB.x + (u - 0.5) * BB.w * 0.94, BB_TOP + 0.005, BB.z + (v - 0.5) * BB.d * 0.94]
}

export function boardCorners(): V3[] {
  return [boardPoint(0, 0), boardPoint(1, 0), boardPoint(1, 1), boardPoint(0, 1)]
}

// where the sonar's pings leave from. they travel toward the camera, +z
export const PING_FROM: V3 = [BB.x - 0.45, BB_TOP + 0.64, BB.z + 1.3]

// the ring's pixels, for lighting them while the sim runs
export const RING = { c: [BB.x - 0.45, BB_TOP + 0.58, BB.z - 0.45] as V3, r: 0.49 }
