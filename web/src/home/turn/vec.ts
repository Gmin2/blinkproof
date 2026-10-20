export type V3 = [number, number, number]
export type Edge = [number, number]

/** A face is a loop of point indices, wound counter-clockwise when seen from
 *  outside. Only closed solids carry them; line art leaves them out. */
export type Face = number[]

export type Mesh = {
  pts: V3[]
  edges: Edge[]
  faces?: Face[]
  /** 0 = crisp structural line, 1 = ghost guide line */
  ghost?: number
  /** shade bias: +1 draws a step darker than the light says, -1 lighter */
  tone?: number
  /** what this mesh is, for things that treat some meshes differently (a fit that ignores wires) */
  tag?: string
  /** a see-through shell: faces tint behind everything, never hide anything */
  xray?: boolean
}

export function mesh(pts: V3[], edges: Edge[], ghost = 0, faces?: Face[]): Mesh {
  return { pts, edges, ghost, faces }
}

export function merge(parts: Mesh[]): Mesh[] {
  return parts
}

export function map(m: Mesh, f: (p: V3) => V3): Mesh {
  return { pts: m.pts.map(f), edges: m.edges, ghost: m.ghost, faces: m.faces, tone: m.tone, tag: m.tag, xray: m.xray }
}

export function translate(m: Mesh, [dx, dy, dz]: V3): Mesh {
  return map(m, ([x, y, z]) => [x + dx, y + dy, z + dz])
}

export function rotY(m: Mesh, a: number): Mesh {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return map(m, ([x, y, z]) => [x * c + z * s, y, -x * s + z * c])
}

export function rotX(m: Mesh, a: number): Mesh {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return map(m, ([x, y, z]) => [x, y * c - z * s, y * s + z * c])
}

export function rotZ(m: Mesh, a: number): Mesh {
  const c = Math.cos(a)
  const s = Math.sin(a)
  return map(m, ([x, y, z]) => [x * c - y * s, x * s + y * c, z])
}

export function scale(m: Mesh, k: number | V3): Mesh {
  const [kx, ky, kz] = typeof k === 'number' ? [k, k, k] : k
  return map(m, ([x, y, z]) => [x * kx, y * ky, z * kz])
}

/* ── primitives ─────────────────────────────────────────────── */

export function box(w: number, h: number, d: number, ghost = 0): Mesh {
  const x = w / 2
  const y = h / 2
  const z = d / 2
  const pts: V3[] = [
    [-x, -y, -z], [x, -y, -z], [x, -y, z], [-x, -y, z],
    [-x, y, -z], [x, y, -z], [x, y, z], [-x, y, z],
  ]
  const edges: Edge[] = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ]
  const faces: Face[] = [
    [0, 3, 2, 1], [4, 5, 6, 7],
    [3, 7, 6, 2], [0, 1, 5, 4],
    [1, 2, 6, 5], [0, 4, 7, 3],
  ]
  return mesh(pts, edges, ghost, faces)
}

/** Vertical cylinder along Y, with both rims and n vertical ribs. */
export function cyl(r: number, h: number, seg = 12, ghost = 0, ribs = seg): Mesh {
  const pts: V3[] = []
  const edges: Edge[] = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push([Math.cos(a) * r, -h / 2, Math.sin(a) * r])
    pts.push([Math.cos(a) * r, h / 2, Math.sin(a) * r])
  }
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg
    edges.push([i * 2, j * 2])
    edges.push([i * 2 + 1, j * 2 + 1])
  }
  const step = Math.max(1, Math.round(seg / ribs))
  for (let i = 0; i < seg; i += step) edges.push([i * 2, i * 2 + 1])
  const faces: Face[] = []
  for (let i = 0; i < seg; i++) {
    const j = (i + 1) % seg
    faces.push([i * 2, j * 2, j * 2 + 1, i * 2 + 1])
  }
  const lo: Face = []
  const hi: Face = []
  for (let i = 0; i < seg; i++) {
    lo.push((seg - 1 - i) * 2)
    hi.push(i * 2 + 1)
  }
  faces.push(lo, hi)
  return mesh(pts, edges, ghost, faces)
}

/** Flat ring in the XZ plane — used for prop discs and gimbal hoops. */
export function ring(r: number, seg = 48, ghost = 0): Mesh {
  const pts: V3[] = []
  const edges: Edge[] = []
  for (let i = 0; i < seg; i++) {
    const a = (i / seg) * Math.PI * 2
    pts.push([Math.cos(a) * r, 0, Math.sin(a) * r])
    edges.push([i, (i + 1) % seg])
  }
  return mesh(pts, edges, ghost)
}

/** A flat grid panel in the XZ plane. */
export function grid(w: number, d: number, cx: number, cz: number, ghost = 0): Mesh {
  const pts: V3[] = []
  const edges: Edge[] = []
  const push = (p: V3) => pts.push(p) - 1
  for (let i = 0; i <= cx; i++) {
    const x = -w / 2 + (w * i) / cx
    edges.push([push([x, 0, -d / 2]), push([x, 0, d / 2])])
  }
  for (let i = 0; i <= cz; i++) {
    const z = -d / 2 + (d * i) / cz
    edges.push([push([-w / 2, 0, z]), push([w / 2, 0, z])])
  }
  return mesh(pts, edges, ghost)
}

export function seg(a: V3, b: V3, ghost = 0): Mesh {
  return mesh([a, b], [[0, 1]], ghost)
}
