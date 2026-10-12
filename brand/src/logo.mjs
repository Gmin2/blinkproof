// the wordmark: geist medium, outlined so the logo never needs the font installed
import { readFileSync } from 'node:fs'
import opentype from 'opentype.js'
import tokens from '../tokens.json' with { type: 'json' }
import { BODY, LIGHT, LIT } from './mark.mjs'

export const FONTS = new URL('../node_modules/geist/dist/fonts/', import.meta.url).pathname
const buf = readFileSync(FONTS + 'geist-sans/Geist-Medium.ttf')
export const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

const SIZE = 100
const u = font.unitsPerEm
const track = tokens.type.tracking.wordmark * SIZE

let x = 0
let d = ''
for (const ch of 'blinkproof') {
  const g = font.charToGlyph(ch)
  d += g.getPath(x, 0, SIZE).toPathData(2) + ' '
  x += (g.advanceWidth / u) * SIZE + track
}

export const wordmark = {
  d: d.trim(),
  width: x - track,
  asc: (font.ascender / u) * SIZE,
  desc: (-font.descender / u) * SIZE,
  xH: (font.tables.os2.sxHeight / u) * SIZE,
  capH: (font.tables.os2.sCapHeight / u) * SIZE,
}

export function wordmarkSvg(fill) {
  const { d, width, asc, desc } = wordmark
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${(-asc).toFixed(1)} ${width.toFixed(1)} ${(asc + desc).toFixed(1)}" width="${width.toFixed(1)}" height="${(asc + desc).toFixed(1)}"><path d="${d}" fill="${fill}"/></svg>`
}

// the symbol sits centred on the capitals, a little taller than them, its light reaching above
export function lockupSvg(fill, lit = LIT) {
  const { d, width, asc, desc, capH } = wordmark
  const mh = capH * 1.9
  const gap = mh * 0.1
  const my = -capH / 2 - mh * 0.495
  const total = mh + gap + width
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${(-asc).toFixed(1)} ${total.toFixed(1)} ${(asc + desc).toFixed(1)}" width="${total.toFixed(1)}" height="${(asc + desc).toFixed(1)}">` +
    `<g transform="translate(0 ${my.toFixed(2)}) scale(${(mh / 100).toFixed(4)})"><path d="${BODY}" fill="${fill}"/><path d="${LIGHT}" fill="${lit}"/></g>` +
    `<g transform="translate(${(mh + gap).toFixed(2)} 0)"><path d="${d}" fill="${fill}"/></g></svg>`
  )
}
