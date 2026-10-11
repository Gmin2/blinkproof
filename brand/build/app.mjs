// app icons and favicons: a paper led on an ink tile
import { markSvg } from '../src/mark.mjs'
import { fav16Svg, favSvg } from '../src/favicon.mjs'
import { c, out, png } from './lib.mjs'

out('kit/app/icon-1024.png', png(markSvg({ fill: c.paper, bg: c.ink, pad: 20 }), 1024))
out('kit/app/icon-512.png', png(markSvg({ fill: c.paper, bg: c.ink, pad: 20 }), 512))
out('kit/app/apple-touch-icon.png', png(markSvg({ fill: c.paper, bg: c.ink, pad: 20 }), 180))
out('kit/app/favicon-16.png', png(fav16Svg(c.ink, c.paper), 16))
out('kit/app/favicon-32.png', png(favSvg(c.ink, c.paper), 32))
out('kit/app/favicon-48.png', png(favSvg(c.ink, c.paper), 48))
out('kit/app/favicon.svg', favSvg(c.ink, c.paper))
// an ico with the hand drawn 16 and the vector 32, for anything that asks for /favicon.ico
const ico = (images) => {
  const head = Buffer.alloc(6 + images.length * 16)
  head.writeUInt16LE(0, 0), head.writeUInt16LE(1, 2), head.writeUInt16LE(images.length, 4)
  let offset = head.length
  images.forEach(([size, data], i) => {
    const e = 6 + i * 16
    head.writeUInt8(size, e), head.writeUInt8(size, e + 1), head.writeUInt16LE(1, e + 4), head.writeUInt16LE(32, e + 6)
    head.writeUInt32LE(data.length, e + 8), head.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([head, ...images.map(([, d]) => d)])
}
out('kit/app/favicon.ico', ico([[16, png(fav16Svg(c.ink, c.paper), 16)], [32, png(favSvg(c.ink, c.paper), 32)], [48, png(favSvg(c.ink, c.paper), 48)]]))
console.log('app: icon 1024 512, apple touch 180, favicon 16 (by hand) 32 48, svg and ico')
