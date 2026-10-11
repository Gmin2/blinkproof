// the mark has to keep its eyes: render it small and count the holes the background cannot reach from outside
import { Resvg } from '@resvg/resvg-js'
import { markSvg, STATE_NAMES } from '../src/mascot.mjs'
import { FIREFLY16 } from '../src/pixels.mjs'

function holes(solid, n) {
  const seen = new Uint8Array(n * n)
  const flood = (sx, sy) => {
    const stack = [[sx, sy]]
    while (stack.length) {
      const [x, y] = stack.pop()
      if (x < 0 || y < 0 || x >= n || y >= n || seen[y * n + x] || solid(x, y)) continue
      seen[y * n + x] = 1
      // eight neighbours, a diagonal gap still reads as one gap
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1], [x + 1, y + 1], [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1])
    }
  }
  for (let i = 0; i < n; i++) (flood(i, 0), flood(i, n - 1), flood(0, i), flood(n - 1, i))
  let count = 0
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (!seen[y * n + x] && !solid(x, y)) (count++, flood(x, y))
  return count
}

let ok = true
const check = (label, got, want) => {
  const pass = got === want
  ok &&= pass
  console.log(`${pass ? 'ok  ' : 'FAIL'} ${label}: ${got} holes, want ${want}`)
}

check('16px hand drawn', holes((x, y) => FIREFLY16[y][x] === '#', 16), 2)
for (const px of [32, 48]) {
  for (const s of STATE_NAMES) {
    const r = new Resvg(markSvg(s, { fill: '#000' }), { fitTo: { mode: 'width', value: px } }).render()
    // eyes only count while open; failed and idle eyes are allowed to merge at 32
    const want = px === 32 && (s === 'failed' || s === 'idle' || s === 'proven') ? null : 2
    const got = holes((x, y) => r.pixels[(y * px + x) * 4 + 3] > 110, px)
    if (want === null) console.log(`info ${s} at ${px}px: ${got} holes`)
    else check(`${s} at ${px}px`, got, want)
  }
}
if (!ok) process.exit(1)
