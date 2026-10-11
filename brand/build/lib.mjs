import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import { FONTS } from '../src/logo.mjs'
import tokens from '../tokens.json' with { type: 'json' }

export const c = tokens.color.brand
export const ui = tokens.color.ui
// what the character svg needs, in brand colours
export const CH = { body: c.paper, eyes: c.ink, glow: c.glow, glowDim: c.glowDim, bad: ui.light.bad, lampOff: c.lampOff }

const fontFiles = ['geist-sans/Geist-Regular.ttf', 'geist-sans/Geist-Medium.ttf', 'geist-sans/Geist-SemiBold.ttf', 'geist-mono/GeistMono-Regular.ttf', 'geist-mono/GeistMono-Medium.ttf'].map((f) => FONTS + f)

export const png = (svg, w) => new Resvg(svg, { fitTo: { mode: 'width', value: w }, font: { fontFiles, loadSystemFonts: false, defaultFontFamily: 'Geist' } }).render().asPng()
export const uri = (buf) => `data:image/png;base64,${buf.toString('base64')}`
export const inner = (svg) => svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
const vb = (svg) => svg.match(/viewBox="([^"]+)"/)[1].split(' ').map(Number)

// place an svg into a bigger one, fitted to a width
export function put(svg, x, y, w) {
  const [a, b, cw] = vb(svg)
  const k = w / cw
  return `<g transform="translate(${x} ${y}) scale(${k}) translate(${-a} ${-b})">${inner(svg)}</g>`
}

export function out(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, data)
}
