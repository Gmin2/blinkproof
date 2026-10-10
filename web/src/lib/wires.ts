export type Point = { x: number; y: number }

export const split = (ref: string) => [ref.slice(0, ref.indexOf(':')), ref.slice(ref.indexOf(':') + 1)]

// wokwi hints: v<n> moves down, h<n> moves right. the ones before "*" walk out of the source pin,
// the ones after it walk back out of the target pin. the loose ends are joined with one elbow
export function route(a: Point, b: Point, hints: string[] = []) {
  const star = hints.indexOf('*')
  const head = star < 0 ? hints : hints.slice(0, star)
  const tail = star < 0 ? [] : hints.slice(star + 1)
  const walk = (from: Point, steps: string[]) => {
    const pts = [from]
    let p = from
    for (const s of steps) {
      const n = Number(s.slice(1))
      if (!Number.isFinite(n)) continue
      p = s[0] === 'v' ? { x: p.x, y: p.y + n } : s[0] === 'h' ? { x: p.x + n, y: p.y } : p
      pts.push(p)
    }
    return pts
  }
  const start = walk(a, head)
  const end = walk(b, [...tail].reverse()).reverse()
  const s = start[start.length - 1]
  const e = end[0]
  // with no hints, leave a pin straight out first, then across, then into the other pin
  const middle = hints.length ? [{ x: e.x, y: s.y }] : [{ x: s.x, y: (s.y + e.y) / 2 }, { x: e.x, y: (s.y + e.y) / 2 }]
  return rounded([...start, ...middle, ...end])
}

export function rounded(points: Point[], r = 8) {
  const pts = points.filter((p, i) => i === 0 || p.x !== points[i - 1].x || p.y !== points[i - 1].y)
  let d = `M ${pts[0].x} ${pts[0].y}`
  for (let i = 1; i < pts.length - 1; i++) {
    const [p, c, n] = [pts[i - 1], pts[i], pts[i + 1]]
    const k = Math.min(r, Math.hypot(c.x - p.x, c.y - p.y) / 2, Math.hypot(n.x - c.x, n.y - c.y) / 2)
    const toward = (q: Point) => {
      const len = Math.hypot(q.x - c.x, q.y - c.y) || 1
      return { x: c.x + ((q.x - c.x) / len) * k, y: c.y + ((q.y - c.y) / len) * k }
    }
    const a = toward(p)
    const b = toward(n)
    d += ` L ${a.x} ${a.y} Q ${c.x} ${c.y} ${b.x} ${b.y}`
  }
  const last = pts[pts.length - 1]
  return `${d} L ${last.x} ${last.y}`
}
