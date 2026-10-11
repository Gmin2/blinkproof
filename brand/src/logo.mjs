// the wordmark: geist semibold outlined, so the logo never needs the font installed.
// the dot of the i is swapped for a round led, the one bit of glow in the word.
import { readFileSync } from 'node:fs'
import opentype from 'opentype.js'
import tokens from '../tokens.json' with { type: 'json' }
import { LANTERN, markPath, STATES } from './mascot.mjs'

export const FONTS = new URL('../node_modules/geist/dist/fonts/', import.meta.url).pathname
const buf = readFileSync(FONTS + 'geist-sans/Geist-SemiBold.ttf')
export const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength))

const SIZE = 100
const u = font.unitsPerEm
const track = tokens.type.tracking.wordmark * SIZE

let x = 0
let d = ''
let dot = null
for (const ch of 'blinkproof') {
  // the i goes in dotless, its dot comes back as the led
  const g = font.charToGlyph(ch === 'i' ? 'ı' : ch)
  if (ch === 'i') {
    const box = g.getBoundingBox()
    const cx = x + (((box.x1 + box.x2) / 2) / u) * SIZE
    dot = { cx, w: ((box.x2 - box.x1) / u) * SIZE }
  }
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

// the led sits where the tittle would, a touch bigger than the stem is wide
const r = dot.w * 0.68
wordmark.dot = { cx: dot.cx, cy: -wordmark.xH - r * 1.55, r }

const led = (fill) => `<circle cx="${wordmark.dot.cx.toFixed(2)}" cy="${wordmark.dot.cy.toFixed(2)}" r="${r.toFixed(2)}" fill="${fill}"/>`

// the box from the top of the dot to the descender
const top = Math.min(-wordmark.asc, wordmark.dot.cy - r - 2)
const height = wordmark.desc - top

export function wordmarkSvg(fill, dotFill = tokens.color.brand.glow) {
  const { d, width } = wordmark
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${top.toFixed(1)} ${width.toFixed(1)} ${height.toFixed(1)}" width="${width.toFixed(1)}" height="${height.toFixed(1)}"><path d="${d}" fill="${fill}"/>${led(dotFill)}</svg>`
}

// mark beside the word: mark height 2.3 x height, gap a seventh of the mark
export function lockupParts(state = 'testing') {
  const { xH, width } = wordmark
  const mh = xH * 2.3
  const gap = mh * 0.14
  const my = -xH / 2 - mh / 2 - xH * 0.06
  return { mh, gap, my, total: mh + gap + width, lift: STATES[state].lift, mark: markPath(state) }
}

export function lockupSvg(fill, { state = 'testing', dotFill = tokens.color.brand.glow, lampFill = null } = {}) {
  const p = lockupParts(state)
  const t = Math.min(top, p.my)
  const h = Math.max(wordmark.desc, p.my + p.mh) - t
  const lamp = lampFill ? `<g transform="translate(0 ${p.my.toFixed(2)}) scale(${(p.mh / 100).toFixed(4)}) translate(0 ${p.lift})"><path d="${LANTERN}" fill="${lampFill}"/></g>` : ''
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${t.toFixed(1)} ${p.total.toFixed(1)} ${h.toFixed(1)}" width="${p.total.toFixed(1)}" height="${h.toFixed(1)}">` +
    `<g transform="translate(0 ${p.my.toFixed(2)}) scale(${(p.mh / 100).toFixed(4)}) translate(0 ${p.lift})"><path d="${p.mark}" fill="${fill}"/></g>` +
    lamp +
    `<g transform="translate(${(p.mh + p.gap).toFixed(2)} 0)"><path d="${wordmark.d}" fill="${fill}"/>${led(dotFill)}</g></svg>`
  )
}
