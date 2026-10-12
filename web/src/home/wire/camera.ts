import type { Mesh, V3 } from './vec'

export type Cam = {
  yaw: number
  pitch: number
  dist: number
  fov: number
  target: V3
  roll: number
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
    z = z2 + cam.dist

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
 * far side of the build fades out the way a real drafting overlay does.
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

/** how many tones the flat shading quantises to */
export const SHADES = 3
/** depth slices for the painter's pass. faces are binned by centroid depth rather than sorted one by one */
export const BINS = 44
const HALF_DEPTH = 4.6

// a fixed light, high and a little to the front left. in world space, so a face keeps its tone as the camera orbits
const LIGHT: V3 = [-0.34, 0.88, 0.33]
const LL = Math.hypot(LIGHT[0], LIGHT[1], LIGHT[2])

function shadeOf(pts: V3[], f: number[]): number {
  const [a, b, c] = [pts[f[0]], pts[f[1]], pts[f[2]]]
  const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]
  const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]]
  const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]]
  const nl = Math.hypot(n[0], n[1], n[2])
  if (nl === 0) return 1
  const d = (n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / (nl * LL)
  return d > 0.62 ? 0 : d > 0.02 ? 1 : 2
}

export type Layers = {
  /** BINS * SHADES entries: bin i, shade s at i * SHADES + s */
  fill: string[]
  line: string[]
  anchors: Record<string, [number, number, number]>
}

/**
 * Wireframe alone turns stacked solids into a tangle, every hidden back edge draws through the front.
 * So faces and edges go into one depth ladder painted back to front, fill then stroke per slice,
 * which hides what is behind for the cost of a few paths a frame.
 */
export function buildLayers(meshes: Mesh[], cam: Cam, vp: Viewport, tracked: Tracked = {}): Layers {
  const project = projector(cam, vp)
  const fill: string[] = new Array(BINS * SHADES).fill('')
  const line: string[] = new Array(BINS).fill('')
  const near = cam.dist - HALF_DEPTH
  const span = HALF_DEPTH * 2
  // the furthest depth lands in bin 0, the nearest in the last
  const binOf = (d: number) => {
    const i = Math.round((1 - (d - near) / span) * (BINS - 1))
    return i < 0 ? 0 : i > BINS - 1 ? BINS - 1 : i
  }
  for (const m of meshes) {
    const proj = m.pts.map(project)
    // a solid only shows the edges of faces turned toward the camera, so its back edges stay hidden
    let seen: Set<number> | null = null
    if (m.faces && !m.ghost) {
      seen = new Set()
      for (const f of m.faces) {
        let depth = 0
        let ok = true
        for (const i of f) {
          if (proj[i][2] <= 0.06) {
            ok = false
            break
          }
          depth += proj[i][2]
        }
        if (!ok) continue
        // faces turned away from the camera are skipped
        let area = 0
        for (let i = 0; i < f.length; i++) {
          const a = proj[f[i]]
          const b = proj[f[(i + 1) % f.length]]
          area += a[0] * b[1] - b[0] * a[1]
        }
        if (area >= 0) continue
        for (let i = 0; i < f.length; i++) {
          const a = f[i]
          const b = f[(i + 1) % f.length]
          seen.add(a < b ? a * 65536 + b : b * 65536 + a)
        }
        let s = 'M'
        for (let i = 0; i < f.length; i++) s += `${proj[f[i]][0].toFixed(1)} ${proj[f[i]][1].toFixed(1)}${i === f.length - 1 ? 'Z' : 'L'}`
        fill[(m.base ? 0 : binOf(depth / f.length)) * SHADES + shadeOf(m.pts, f)] += s
      }
    }
    for (const [a, b] of m.edges) {
      if (seen && !seen.has(a < b ? a * 65536 + b : b * 65536 + a)) continue
      const pa = proj[a]
      const pb = proj[b]
      if (pa[2] <= 0.06 || pb[2] <= 0.06) continue
      // one bin nearer, so a face never paints over its own outline. a base's edges go right after its faces
      const i = m.base ? 0 : Math.min(BINS - 1, binOf((pa[2] + pb[2]) / 2) + (m.ghost ? 0 : 1))
      line[i] += `M${pa[0].toFixed(1)} ${pa[1].toFixed(1)}L${pb[0].toFixed(1)} ${pb[1].toFixed(1)}`
    }
  }
  const anchors: Record<string, [number, number, number]> = {}
  for (const k in tracked) anchors[k] = project(tracked[k])
  return { fill, line, anchors }
}
