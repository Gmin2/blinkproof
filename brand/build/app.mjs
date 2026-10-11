// app icons and favicons: the firefly on ink with its lantern lit
import { characterSvg, markSvg } from '../src/mascot.mjs'
import { pixelSvg } from '../src/pixels.mjs'
import { c, CH, inner, out, png } from './lib.mjs'

// the character centred in a square, filling `fill` of it
function framed(state, fill, { bg = c.ink, radius = 0 } = {}) {
  const off = (100 - 100 * fill) / 2
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${bg ? `<rect width="100" height="100" rx="${radius}" fill="${bg}"/>` : ''}<g transform="translate(${off} ${off}) scale(${fill})">${inner(characterSvg(state, CH))}</g></svg>`
}

out('kit/app/icon-1024.png', png(framed('proven', 0.8), 1024))
out('kit/app/icon-512.png', png(framed('proven', 0.8), 512))
out('kit/app/apple-touch-icon.png', png(framed('proven', 0.8), 180))
out('kit/app/favicon-16.png', png(pixelSvg({ fill: c.paper, lamp: c.glow, bg: c.ink }), 16))
out('kit/app/favicon-32.png', png(framed('testing', 0.96, { radius: 18 }), 32))
out('kit/app/favicon-48.png', png(framed('testing', 0.96, { radius: 18 }), 48))
// the svg favicon follows the browser theme: ink mark on light, paper mark on dark
const mark = markSvg('testing', { fill: c.ink }).match(/<path d="([^"]+)"/)[1]
out('kit/app/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>path{fill:${c.ink}}@media (prefers-color-scheme:dark){path{fill:${c.paper}}}</style><path d="${mark}"/></svg>`)
console.log('app: icon 1024 512, apple touch 180, favicon 16 32 48 and svg')
