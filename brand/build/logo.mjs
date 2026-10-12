import { markSvg } from '../src/mark.mjs'
import { lockupSvg, wordmark, wordmarkSvg } from '../src/logo.mjs'
import { c, out, png, put } from './lib.mjs'

// ink and paper carry the lit light, white and stone are one colour for places that only take one
for (const [name, fill, lit] of [['ink', c.ink, c.lit], ['paper', c.paper, c.lit], ['white', '#FFFFFF', '#FFFFFF'], ['stone', c.stone, c.stone]]) {
  out(`kit/logo/wordmark-${name}.svg`, wordmarkSvg(fill))
  out(`kit/logo/lockup-${name}.svg`, lockupSvg(fill, lit))
  out(`kit/logo/mark-${name}.svg`, markSvg({ fill, lit }))
}
const ground = (svg, bg) => `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="400"><rect width="1200" height="400" fill="${bg}"/>${put(svg, 200, 140, 800)}</svg>`
out('kit/logo/lockup-on-paper.png', png(ground(lockupSvg(c.ink), c.paper), 1200))
out('kit/logo/lockup-on-ink.png', png(ground(lockupSvg(c.paper), c.ink), 1200))
console.log(`logo: wordmark ${wordmark.width.toFixed(0)} wide, 4 colourways, 2 png checks`)
