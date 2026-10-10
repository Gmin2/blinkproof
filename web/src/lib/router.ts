import type { Point } from './wires'

export type Rect = { x: number; y: number; w: number; h: number }

const STEP = 10
const BEND = 30
// a wire through a cell another wire already took, so they run side by side rather than on top
const CROWD = 18
const CLEARANCE = 8

type Dir = 0 | 1 | 2 | 3
const DX = [1, 0, -1, 0]
const DY = [0, 1, 0, -1]

class Heap {
  private items: [number, number][] = []
  push(cost: number, id: number) {
    const a = this.items
    a.push([cost, id])
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p][0] <= a[i][0]) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop() {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < a.length && a[l][0] < a[m][0]) m = l
        if (r < a.length && a[r][0] < a[m][0]) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top
  }
  get size() {
    return this.items.length
  }
}

// where a wire leaves its part: straight out of the nearest edge, a little past it
function exit(pin: Point, rect: Rect | undefined) {
  if (!rect) return { at: pin, dir: 3 as Dir }
  const d = [rect.x + rect.w - pin.x, rect.y + rect.h - pin.y, pin.x - rect.x, pin.y - rect.y]
  const dir = d.indexOf(Math.min(...d)) as Dir
  const out = d[dir] + CLEARANCE + 2 * STEP
  return { at: { x: pin.x + DX[dir] * out, y: pin.y + DY[dir] * out }, dir }
}

// routes every wire around the parts on a grid, few bends, wires kept apart
export function routeAll(wires: { a: Point; b: Point; ra?: Rect; rb?: Rect }[], parts: Rect[]) {
  const minX = Math.min(...parts.map((r) => r.x), ...wires.flatMap((w) => [w.a.x, w.b.x])) - 80
  const minY = Math.min(...parts.map((r) => r.y), ...wires.flatMap((w) => [w.a.y, w.b.y])) - 80
  const maxX = Math.max(...parts.map((r) => r.x + r.w), ...wires.flatMap((w) => [w.a.x, w.b.x])) + 80
  const maxY = Math.max(...parts.map((r) => r.y + r.h), ...wires.flatMap((w) => [w.a.y, w.b.y])) + 80
  const cols = Math.ceil((maxX - minX) / STEP) + 1
  const rows = Math.ceil((maxY - minY) / STEP) + 1
  const blocked = new Uint8Array(cols * rows)
  const used = new Uint16Array(cols * rows)
  for (const r of parts) {
    for (let cy = Math.floor((r.y - CLEARANCE - minY) / STEP); cy <= Math.ceil((r.y + r.h + CLEARANCE - minY) / STEP); cy++) {
      for (let cx = Math.floor((r.x - CLEARANCE - minX) / STEP); cx <= Math.ceil((r.x + r.w + CLEARANCE - minX) / STEP); cx++) {
        if (cx >= 0 && cy >= 0 && cx < cols && cy < rows) blocked[cy * cols + cx] = 1
      }
    }
  }
  const cell = (p: Point) => ({ cx: Math.round((p.x - minX) / STEP), cy: Math.round((p.y - minY) / STEP) })
  const at = (cx: number, cy: number) => ({ x: minX + cx * STEP, y: minY + cy * STEP })

  const order = wires.map((w, i) => ({ w, i, len: Math.abs(w.a.x - w.b.x) + Math.abs(w.a.y - w.b.y) })).sort((p, q) => p.len - q.len)
  const out: Point[][] = new Array(wires.length)

  for (const { w, i } of order) {
    const ea = exit(w.a, w.ra)
    const eb = exit(w.b, w.rb)
    const s = cell(ea.at)
    const t = cell(eb.at)
    const route = search(s, t, ea.dir)
    if (!route) {
      out[i] = [w.a, ea.at, { x: eb.at.x, y: ea.at.y }, eb.at, w.b]
      continue
    }
    for (const [cx, cy] of route) used[cy * cols + cx]++
    const pts = route.map(([cx, cy]) => at(cx, cy))
    // the pin, straight out to the grid, the route, straight back in
    const first = pts[0]
    const last = pts[pts.length - 1]
    const lead = ea.dir % 2 === 1 ? [w.a, { x: w.a.x, y: first.y }] : [w.a, { x: first.x, y: w.a.y }]
    const tail = eb.dir % 2 === 1 ? [{ x: w.b.x, y: last.y }, w.b] : [{ x: last.x, y: w.b.y }, w.b]
    out[i] = simplify([...lead, ...pts, ...tail])
  }
  return out

  function search(s: { cx: number; cy: number }, t: { cx: number; cy: number }, startDir: Dir) {
    const inside = (cx: number, cy: number) => cx >= 0 && cy >= 0 && cx < cols && cy < rows
    if (!inside(s.cx, s.cy) || !inside(t.cx, t.cy)) return null
    const n = cols * rows * 4
    const cost = new Float64Array(n).fill(Infinity)
    const from = new Int32Array(n).fill(-1)
    const heap = new Heap()
    const id = (cx: number, cy: number, d: number) => (cy * cols + cx) * 4 + d
    const h = (cx: number, cy: number) => (Math.abs(cx - t.cx) + Math.abs(cy - t.cy)) * STEP
    const start = id(s.cx, s.cy, startDir)
    cost[start] = 0
    heap.push(h(s.cx, s.cy), start)
    while (heap.size) {
      const [, cur] = heap.pop()
      const d = cur & 3
      const c = cur >> 2
      const cx = c % cols
      const cy = (c / cols) | 0
      if (cx === t.cx && cy === t.cy) {
        const path: [number, number][] = []
        for (let k = cur; k >= 0; k = from[k]) {
          const cc = k >> 2
          path.push([cc % cols, (cc / cols) | 0])
        }
        return path.reverse()
      }
      for (let nd = 0; nd < 4; nd++) {
        if (nd === (d + 2) % 4) continue
        const nx = cx + DX[nd]
        const ny = cy + DY[nd]
        if (!inside(nx, ny)) continue
        const goal = nx === t.cx && ny === t.cy
        if (blocked[ny * cols + nx] && !goal) continue
        const next = id(nx, ny, nd)
        const g = cost[cur] + STEP + (nd !== d ? BEND : 0) + used[ny * cols + nx] * CROWD
        if (g < cost[next]) {
          cost[next] = g
          from[next] = cur
          heap.push(g + h(nx, ny), next)
        }
      }
    }
    return null
  }
}

// drops points in the middle of straight runs
function simplify(pts: Point[]) {
  const out: Point[] = []
  for (const p of pts) {
    const prev = out[out.length - 1]
    if (prev && prev.x === p.x && prev.y === p.y) continue
    const before = out[out.length - 2]
    if (before && prev && ((before.x === prev.x && prev.x === p.x) || (before.y === prev.y && prev.y === p.y))) out[out.length - 1] = p
    else out.push(p)
  }
  return out
}
