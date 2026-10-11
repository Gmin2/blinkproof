import { markSvg } from '../src/mark.mjs'
import { lockupSvg } from '../src/logo.mjs'
import { picto } from '../src/pictos.mjs'
import { c, out, png, put } from './lib.mjs'

out('kit/social/avatar.png', png(markSvg({ fill: c.ink, bg: c.paper, pad: 22 }), 400))
// the header uses the og grid: lockup in the middle cell, parts in the others
const cells = [[0, 0, 500], [1000, 0, 500]]
out('kit/social/x-header.png', png(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500"><defs>${cells.map(([x], i) => `<clipPath id="h${i}"><rect x="${x + 1.5}" y="0" width="497" height="500"/></clipPath>`).join('')}</defs><rect width="1500" height="500" fill="${c.paper}"/><line x1="500" y1="0" x2="500" y2="500" stroke="${c.stone}" stroke-width="3"/><line x1="1000" y1="0" x2="1000" y2="500" stroke="${c.stone}" stroke-width="3"/><g clip-path="url(#h0)">${picto('blink', 60, 120, 380, { w: 3 })}</g><g clip-path="url(#h1)">${picto('led', 1110, 90, 320, { w: 3 })}</g>${put(lockupSvg(c.ink), 580, 210, 340)}</svg>`, 1500))
console.log('social: avatar 400, x header 1500x500')
