import type { Mesh, V3 } from './vec'

export type Cam = {
  yaw: number
  pitch: number
  dist: number
  fov: number
  target: V3
  roll: number
  /** true depth: nearer points paint last and project larger. The hero
   *  variants leave this off and keep the projection they were tuned to. */
  solid?: boolean
  /** override the fixed world light and the two tone thresholds — lab only */
  light?: V3
  tones?: [number, number]
}

export type Viewport = { w: number; h: number; scale: number }

/**
 * Six stroke tiers, sorted back to front. Everything is projected into one
 * of these so a frame costs six setAttribute calls instead of ~900 DOM nodes.
 */
export const TIERS = 6

export type Frame = {
  d: string[]
  /** screen position of tracked points, for callout leader lines */
  anchors: Record<string, [number, number, number]>
}

export type Tracked = Record<string, V3>

export function projector(cam: Cam, vp: Viewport) {
  const cy = Math.cos(cam.yaw)
  const sy = Math.sin(cam.yaw)
  const cp = Math.cos(cam.pitch)
  const sp = Math.sin(cam.pitch)
  const cr = Math.cos(cam.roll)
  const sr = Math.sin(cam.roll)
  const f = (vp.h / 2) / Math.tan(cam.fov / 2)
  const [tx, ty, tz] = cam.target

  return (p: V3): [number, number, number] => {
    let x = p[0] - tx
    let y = p[1] - ty
    let z = p[2] - tz

    // yaw about Y
    const x1 = x * cy + z * sy
    const z1 = -x * sy + z * cy
    // pitch about X
    const y2 = y * cp - z1 * sp
    const z2 = y * sp + z1 * cp

    x = x1
    y = y2
    z = cam.solid ? cam.dist - z2 : z2 + cam.dist

    const inv = f / Math.max(z, 0.05)
    let sx = x * inv * vp.scale
    let sy2 = -y * inv * vp.scale
    if (cam.roll !== 0) {
      const rx = sx * cr - sy2 * sr
      sy2 = sx * sr + sy2 * cr
      sx = rx
    }
    return [vp.w / 2 + sx, vp.h / 2 + sy2, z]
  }
}

/**
 * Projects every mesh and bins each edge into a stroke tier by depth, so the
 * far side of the airframe fades out the way a real drafting overlay does.
 */
export function buildFrame(
  meshes: Mesh[],
  cam: Cam,
  vp: Viewport,
  tracked: Tracked = {},
): Frame {
  const project = projector(cam, vp)
  const d: string[] = new Array(TIERS).fill('')
  const near = cam.dist - 3.2
  const far = cam.dist + 3.2

  for (const m of meshes) {
    const proj = m.pts.map(project)
    // a ghost mesh is pinned to the two faintest tiers
    const lo = m.ghost ? TIERS - 2 : 0
    const hi = m.ghost ? TIERS - 1 : TIERS - 3
    for (const [a, b] of m.edges) {
      const pa = proj[a]
      const pb = proj[b]
      if (pa[2] <= 0.06 || pb[2] <= 0.06) continue
      const t = ((pa[2] + pb[2]) / 2 - near) / (far - near)
      const tier = Math.max(lo, Math.min(hi, lo + Math.round(t * (hi - lo))))
      d[tier] +=
        `M${pa[0].toFixed(1)} ${pa[1].toFixed(1)}L${pb[0].toFixed(1)} ${pb[1].toFixed(1)}`
    }
  }

  const anchors: Record<string, [number, number, number]> = {}
  for (const k in tracked) anchors[k] = project(tracked[k])
  return { d, anchors }
}

export type Tier = { w: number; o: number }

/**
 * The reference drawing sits in a narrow band of greys — only the ghost rings
 * and the far side really drop away — so the tiers interpolate between a near
 * and a far setting rather than being six independent values.
 */
export function tiers(inkNear: number, inkFar: number, wNear: number, wFar: number): Tier[] {
  return Array.from({ length: TIERS }, (_, i) => {
    const u = i / (TIERS - 1)
    return { w: wNear + (wFar - wNear) * u, o: inkNear + (inkFar - inkNear) * u }
  })
}

/**
 * Painter's-algorithm surface pass.
 *
 * Wireframe alone turns a stack of nested solids into a tangle, because every
 * hidden back face draws straight through the front. Filling faces and painting
 * them back to front gives real occlusion, which is what lets the eye find the
 * object.
 *
 * Faces are binned by centroid depth rather than sorted individually: one path
 * per bin is a handful of DOM writes a frame instead of several hundred, and at
 * this bin count the ordering error is not visible.
 */
export const SURF_BINS = 44

export function buildSurface(
  meshes: Mesh[],
  cam: Cam,
  vp: Viewport,
  bins = SURF_BINS,
): string[] {
  const project = projector(cam, vp)
  const out: string[] = new Array(bins).fill('')
  const polys: { d: number; s: string }[] = []
  let near = Infinity
  let far = -Infinity

  for (const m of meshes) {
    if (!m.faces || m.ghost) continue
    const proj = m.pts.map(project)
    for (const f of m.faces) {
      let depth = 0
      let ok = true
      for (const i of f) {
        const p = proj[i]
        if (p[2] <= 0.06) { ok = false; break }
        depth += p[2]
      }
      if (!ok) continue

      // drop faces turned away from the camera, by projected winding
      let area = 0
      for (let i = 0; i < f.length; i++) {
        const a = proj[f[i]]
        const b = proj[f[(i + 1) % f.length]]
        area += a[0] * b[1] - b[0] * a[1]
      }
      if (area >= 0) continue

      const d = depth / f.length
      let s = 'M'
      for (let i = 0; i < f.length; i++) {
        const p = proj[f[i]]
        s += `${p[0].toFixed(1)} ${p[1].toFixed(1)}${i === f.length - 1 ? 'Z' : 'L'}`
      }
      polys.push({ d, s })
      if (d < near) near = d
      if (d > far) far = d
    }
  }

  const span = far - near
  for (const p of polys) {
    const t = span > 0 ? (p.d - near) / span : 0
    out[Math.round((1 - t) * (bins - 1))] += p.s
  }
  return out
}

/**
 * Faces and edges binned into the same depth ladder, so they can be painted
 * interleaved: fill bin 0, stroke bin 0, fill bin 1, stroke bin 1 and so on.
 *
 * That interleaving is what removes hidden lines. Painting all the faces and
 * then all the edges puts every hidden edge back on top of the surface that was
 * supposed to hide it, which is worse than no surfaces at all.
 *
 * The depth window is pinned to the camera rather than measured from the
 * content, because a window that breathes with the geometry makes bin
 * assignment jump between frames and the drawing flickers.
 */
export type Layers = {
  /** bins * SHADES entries: bin i, shade s lives at i * SHADES + s */
  fill: string[]
  line: string[]
  anchors: Record<string, [number, number, number]>
}

const HALF_DEPTH = 4.6

/** how many tones the flat shading quantises to */
export const SHADES = 3

/* A fixed world light, high and slightly to the front left. Shading in world
 * space rather than view space means a face keeps its tone as the camera
 * orbits, which is what makes it read as a lit object instead of a filter. */
const LIGHT: V3 = [-0.34, 0.88, 0.33]
const LL = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2])

/** Lambert against that light, quantised. 0 is the lightest tone. */
function shadeOf(pts: V3[], f: number[], L: V3 = LIGHT, hi = 0.62, lo = 0.02): number {
  const a = pts[f[0]]
  const b = pts[f[1]]
  const c = pts[f[2]]
  const ux = b[0] - a[0]
  const uy = b[1] - a[1]
  const uz = b[2] - a[2]
  const vx = c[0] - a[0]
  const vy = c[1] - a[1]
  const vz = c[2] - a[2]
  const nx = uy * vz - uz * vy
  const ny = uz * vx - ux * vz
  const nz = ux * vy - uy * vx
  const nl = Math.hypot(nx, ny, nz)
  if (nl === 0) return 1
  const ll = L === LIGHT ? LL : Math.hypot(L[0], L[1], L[2])
  const d = (nx * L[0] + ny * L[1] + nz * L[2]) / (nl * ll)
  return d > hi ? 0 : d > lo ? 1 : 2
}

export function buildLayers(
  meshes: Mesh[],
  cam: Cam,
  vp: Viewport,
  tracked: Tracked = {},
  bins = SURF_BINS,
): Layers {
  const project = projector(cam, vp)
  const fill: string[] = new Array(bins * SHADES).fill('')
  const line: string[] = new Array(bins).fill('')
  const near = cam.dist - HALF_DEPTH
  const span = HALF_DEPTH * 2

  /** furthest depth lands in bin 0, nearest in the last bin */
  const binOf = (d: number) => {
    const t = (d - near) / span
    const i = Math.round((1 - t) * (bins - 1))
    return i < 0 ? 0 : i > bins - 1 ? bins - 1 : i
  }

  for (const m of meshes) {
    const proj = m.pts.map(project)

    if (m.faces && (!m.ghost || m.xray)) {
      for (const f of m.faces) {
        let depth = 0
        let ok = true
        for (const i of f) {
          const p = proj[i]
          if (p[2] <= 0.06) { ok = false; break }
          depth += p[2]
        }
        if (!ok) continue
        let area = 0
        for (let i = 0; i < f.length; i++) {
          const a = proj[f[i]]
          const b = proj[f[(i + 1) % f.length]]
          area += a[0] * b[1] - b[0] * a[1]
        }
        if (area >= 0) continue
        let s = 'M'
        for (let i = 0; i < f.length; i++) {
          const p = proj[f[i]]
          s += `${p[0].toFixed(1)} ${p[1].toFixed(1)}${i === f.length - 1 ? 'Z' : 'L'}`
        }
        if (m.xray) {
          // an x-ray shell sits in the farthest bin at the lightest tone: a tint of the body everything else paints over
          fill[0] += s
          continue
        }
        const tone = Math.max(0, Math.min(SHADES - 1, shadeOf(m.pts, f, cam.light, cam.tones?.[0], cam.tones?.[1]) + (m.tone ?? 0)))
        fill[binOf(depth / f.length) * SHADES + tone] += s
      }
    }

    for (const [a, b] of m.edges) {
      const pa = proj[a]
      const pb = proj[b]
      if (pa[2] <= 0.06 || pb[2] <= 0.06) continue
      // nudge edges one bin forward so a face never paints over its own outline
      const i = Math.max(0, binOf((pa[2] + pb[2]) / 2) - (m.ghost ? 0 : 1))
      line[i] +=
        `M${pa[0].toFixed(1)} ${pa[1].toFixed(1)}L${pb[0].toFixed(1)} ${pb[1].toFixed(1)}`
    }
  }

  const anchors: Record<string, [number, number, number]> = {}
  for (const k in tracked) anchors[k] = project(tracked[k])
  return { fill, line, anchors }
}
