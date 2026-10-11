import { characterSvg, markSvg, HEAD, LANTERN, WINGS, ANTENNAE, PADS, STATES, STATE_NAMES } from '../src/mascot.mjs'
import { pixelSvg } from '../src/pixels.mjs'
import { c, CH, out, png, put, uri } from './lib.mjs'

for (const s of STATE_NAMES) {
  out(`kit/mascot/${s}.svg`, characterSvg(s, CH))
  out(`kit/mascot/mark-${s}.svg`, markSvg(s, { fill: c.ink }))
  out(`kit/mascot/${s}.png`, png(characterSvg(s, CH, { bg: c.ink, radius: 22 }), 400))
}
out('kit/mascot/states.json', JSON.stringify({ viewBox: '0 0 100 100', head: HEAD, lantern: LANTERN, wings: WINGS, antennae: ANTENNAE, pads: PADS, states: Object.fromEntries(STATE_NAMES.map((s) => [s, { eyes: STATES[s].eyes(), lantern: STATES[s].lantern, lift: STATES[s].lift }])) }))

// the sheet: five states as character and mark, then the mark at the sizes that matter
let body = ''
STATE_NAMES.forEach((s, i) => {
  const x = 30 + i * 190
  body += put(characterSvg(s, CH, { bg: c.ink, radius: 22 }), x, 50, 170)
  body += put(markSvg(s, { fill: c.ink, bg: '#FFFFFF', radius: 22 }), x, 236, 170)
  body += `<text x="${x}" y="428" font-size="14" fill="#555">${s}</text>`
})
body += `<text x="30" y="32" font-size="14" font-weight="600" fill="#141414">five states, one body. only the eyes and the lantern change</text>`
const sizes = [16, 24, 32, 48, 96]
;[[c.ink, c.paper, c.glow, 'paper on ink'], [c.paper, c.ink, null, 'ink on paper']].forEach(([bg, fill, lamp, label], row) => {
  const y = 470 + row * 140
  body += `<rect x="30" y="${y}" width="930" height="120" rx="12" fill="${bg}"/><text x="46" y="${y + 22}" font-size="12" fill="${fill}" opacity="0.6">${label}</text>`
  let x = 46
  for (const px of sizes) {
    const svg = px === 16 ? pixelSvg({ fill, lamp }) : markSvg('testing', { fill })
    body += `<image x="${x}" y="${y + 70 - px / 2}" width="${px}" height="${px}" href="${uri(png(svg, px))}"/>`
    x += px + 28
  }
  body += `<image x="${x + 20}" y="${y + 14}" width="96" height="96" href="${uri(png(pixelSvg({ fill, lamp }), 16))}" image-rendering="optimizeSpeed"/><text x="${x + 130}" y="${y + 66}" font-size="12" fill="${fill}" opacity="0.6">16px is drawn by hand</text>`
})
out('kit/mascot/sheet.png', png(`<svg xmlns="http://www.w3.org/2000/svg" width="990" height="760"><rect width="990" height="760" fill="#ECECEA"/>${body}</svg>`, 990))
console.log('mascot: 5 states, character and mark svgs, states.json, sheet')
