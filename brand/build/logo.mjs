import { markSvg } from '../src/mascot.mjs'
import { lockupSvg, wordmark, wordmarkSvg } from '../src/logo.mjs'
import { c, out, png, put } from './lib.mjs'

for (const [name, fill] of [['ink', c.ink], ['paper', c.paper], ['white', '#FFFFFF']]) {
  out(`kit/logo/wordmark-${name}.svg`, wordmarkSvg(fill))
  out(`kit/logo/lockup-${name}.svg`, lockupSvg(fill))
  out(`kit/logo/mark-${name}.svg`, markSvg('testing', { fill }))
}
// on ink the lantern is lit, that is the hero colourway
out('kit/logo/lockup-lit.svg', lockupSvg(c.paper, { lampFill: c.glow, state: 'proven' }))
const ground = (svg, bg, w = 1200, h = 400) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${bg}"/>${put(svg, 120, 140, 960)}</svg>`
out('kit/logo/lockup-on-ink.png', png(ground(lockupSvg(c.paper, { lampFill: c.glow, state: 'proven' }), c.ink), 1200))
out('kit/logo/lockup-on-paper.png', png(ground(lockupSvg(c.ink), c.paper), 1200))
console.log(`logo: wordmark ${wordmark.width.toFixed(0)} wide, 3 colourways plus lit, 2 png checks`)
