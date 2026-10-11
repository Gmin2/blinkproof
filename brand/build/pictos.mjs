// every pictogram as its own svg, plus a sheet
import { PICTOS, PICTO_NAMES, picto } from '../src/pictos.mjs'
import { c, out, png } from './lib.mjs'

for (const n of PICTO_NAMES) out(`kit/pictos/${n}.svg`, `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-4 -4 108 108" width="108" height="108"><path d="${PICTOS[n]}" fill="none" stroke="${c.stone}" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`)
let body = ''
PICTO_NAMES.forEach((n, i) => {
  const x = 30 + (i % 5) * 190, y = 30 + Math.floor(i / 5) * 200
  body += `<rect x="${x}" y="${y}" width="170" height="170" rx="12" fill="${c.paper}" stroke="${c.stoneSoft}" stroke-width="1.5"/>${picto(n, x + 25, y + 20, 120, { stroke: c.stone, w: 3 })}<text x="${x + 85}" y="${y + 160}" text-anchor="middle" font-size="12" fill="${c.ink}">${n}</text>`
})
out('kit/pictos/sheet.png', png(`<svg xmlns="http://www.w3.org/2000/svg" width="980" height="440"><rect width="980" height="440" fill="#FFFFFF"/>${body}</svg>`, 980))
console.log(`pictos: ${PICTO_NAMES.length} outlines and a sheet`)
