// the light has to stay off the diode at small sizes, or the arrows melt into the bar and it stops reading as an led
import { Resvg } from '@resvg/resvg-js'
import { BODY, LIGHT } from '../src/mark.mjs'

const solid = (d, px) => {
  const r = new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="${d}" fill="#000"/></svg>`, { fitTo: { mode: 'width', value: px } }).render()
  return (x, y) => x >= 0 && y >= 0 && x < px && y < px && r.pixels[(y * px + x) * 4 + 3] > 100
}
let ok = true
for (const px of [24, 32, 48]) {
  const body = solid(BODY, px)
  const light = solid(LIGHT, px)
  // a lit pixel next to (or on) a body pixel means the two touch
  let touching = 0
  for (let y = 0; y < px; y++)
    for (let x = 0; x < px; x++) if (light(x, y) && [-1, 0, 1].some((dx) => [-1, 0, 1].some((dy) => body(x + dx, y + dy)))) touching++
  const pass = touching === 0
  ok &&= pass
  console.log(`${pass ? 'ok  ' : 'FAIL'} light clear of the diode at ${px}px: ${touching} touching`)
}
if (!ok) process.exit(1)
