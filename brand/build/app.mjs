// app icons and favicons: the ink led on paper
import { MARK, markSvg } from '../src/mark.mjs'
import { c, out, png } from './lib.mjs'

const icon = (pad, radius = 0) => markSvg({ fill: c.ink, bg: c.paper, radius, pad })
out('kit/app/icon-1024.png', png(icon(18), 1024))
out('kit/app/icon-512.png', png(icon(18), 512))
out('kit/app/apple-touch-icon.png', png(icon(18), 180))
for (const px of [16, 32, 48]) out(`kit/app/favicon-${px}.png`, png(markSvg({ fill: c.ink, pad: 2 }), px))
// the svg favicon follows the browser theme
out('kit/app/favicon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>path{fill:${c.ink}}@media (prefers-color-scheme:dark){path{fill:${c.paper}}}</style><path d="${MARK}"/></svg>`)
console.log('app: icon 1024 512, apple touch 180, favicon 16 32 48 and svg')
