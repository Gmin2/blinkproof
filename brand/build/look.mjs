// a quick look: every state as character and mark at 256, plus the mark rendered at a real 16 and 32
import { writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'
import { characterSvg, markSvg, STATE_NAMES } from '../src/mascot.mjs'
import tokens from '../tokens.json' with { type: 'json' }

const c = tokens.color.brand
const ch = { body: c.paper, eyes: c.ink, glow: c.glow, glowDim: c.glowDim, bad: tokens.color.ui.light.bad, lampOff: c.lampOff }
const png = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w } }).render().asPng()
const uri = (buf) => `data:image/png;base64,${buf.toString('base64')}`
const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')

let body = ''
STATE_NAMES.forEach((s, i) => {
  const x = 20 + i * 180
  body += `<g transform="translate(${x} 20) scale(1.6)">${inner(characterSvg(s, ch, { bg: c.ink, radius: 22 }))}</g>`
  body += `<g transform="translate(${x} 200) scale(1.6)">${inner(markSvg(s, { fill: c.ink, bg: c.paper, radius: 22 }))}</g>`
  body += `<text x="${x}" y="384" font-family="Geist" font-size="13" fill="#333">${s}</text>`
})
// real small renders, scaled up with hard pixels so the holes can be counted
const small = [[16, true], [16, false], [32, false], [48, false]]
small.forEach(([px, sm], i) => {
  const im = png(markSvg('testing', { fill: c.ink, small: sm }), px)
  body += `<rect x="${20 + i * 180}" y="400" width="160" height="160" fill="${c.paper}"/>`
  body += `<image x="${20 + i * 180}" y="400" width="160" height="160" href="${uri(im)}" image-rendering="optimizeSpeed"/>`
  body += `<text x="${20 + i * 180}" y="580" font-family="Geist" font-size="13" fill="#333">${px}px ${sm ? 'mark16' : 'full mark'}</text>`
  const im2 = png(markSvg('testing', { fill: c.glow, small: sm }), px)
  body += `<rect x="740" y="${400 + i * 40}" width="200" height="36" fill="${c.ink}"/><image x="${750}" y="${400 + i * 40 + 18 - px / 2}" width="${px}" height="${px}" href="${uri(im2)}"/>`
  body += `<rect x="740" y="${400 + i * 40}" width="0" height="0"/><image x="${800}" y="${400 + i * 40 + 18 - px / 2}" width="${px}" height="${px}" href="${uri(png(markSvg('testing', { fill: c.ink, small: sm }), px))}"/>`
})
const sheet = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="940" height="600"><rect width="940" height="600" fill="#e6e6e3"/>${body}</svg>`
writeFileSync('out/look.png', new Resvg(sheet, { font: { fontFiles: ['node_modules/geist/dist/fonts/geist-sans/Geist-Regular.ttf'], loadSystemFonts: false } }).render().asPng())
console.log('out/look.png')
