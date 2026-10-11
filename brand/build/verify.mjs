// the mark has to keep both legs apart at 16px, or it stops reading as an led
import { Resvg } from '@resvg/resvg-js'
import { markSvg } from '../src/mark.mjs'

let ok = true
for (const px of [16, 24, 32]) {
  const r = new Resvg(markSvg({ fill: '#000', pad: 2 }), { fitTo: { mode: 'width', value: px } }).render()
  // the row near the bottom of the shorter leg must cross two separate solid runs
  const y = Math.floor(px * 0.82)
  let runs = 0, inRun = false
  for (let x = 0; x < px; x++) {
    const solid = r.pixels[(y * px + x) * 4 + 3] > 100
    if (solid && !inRun) runs++
    inRun = solid
  }
  const pass = runs === 2
  ok &&= pass
  console.log(`${pass ? 'ok  ' : 'FAIL'} legs at ${px}px: ${runs} runs, want 2`)
}
if (!ok) process.exit(1)
