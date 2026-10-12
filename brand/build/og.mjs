// og cards, 1200x630, two kinds:
// grid: paper ground cut into cells by stone lines, the title in one cell, outline parts in the rest, cropped by their cells
// code: a white window with grey dots and a sketch in it, running off the bottom right
import { PICTO_NAMES, picto } from '../src/pictos.mjs'
import { c, code as k, out, png } from './lib.mjs'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const W = 1200, H = 630, MID = 315, LINE = 3

// two layouts, mirrored like the references: the title top left, or top right
const LAYOUTS = {
  left: { title: [0, 0, 800, MID], lines: [[800, 0, 800, H], [0, MID, W, MID], [400, MID, 400, H]], cells: [[800, 0, 400, MID], [0, MID, 400, H - MID], [400, MID, 400, H - MID], [800, MID, 400, H - MID]] },
  right: { title: [400, 0, 800, MID], lines: [[400, 0, 400, H], [0, MID, W, MID], [800, MID, 800, H]], cells: [[0, 0, 400, MID], [0, MID, 400, H - MID], [400, MID, 400, H - MID], [800, MID, 400, H - MID]] },
}

// where a pictogram sits in its cell: centred, or pushed off an edge so the cell crops it
const SPOTS = [
  (x, y, w, h) => [x + w / 2 - 120, y + h / 2 - 120, 240],
  (x, y, w, h) => [x + w / 2 - 110, y + h - 150, 260],
  (x, y, w, h) => [x + w / 2 - 130, y - 70, 260],
  (x, y, w, h) => [x + 40, y + h / 2 - 115, 230],
]

// split a line of small text to fit a width, by an average glyph width
function wrap(text, width, size) {
  const max = Math.floor(width / (size * 0.5))
  const lines = []
  let line = ''
  for (const word of text.split(' ')) {
    if (line && (line + ' ' + word).length > max) (lines.push(line), (line = word))
    else line = line ? line + ' ' + word : word
  }
  return line ? [...lines, line] : lines
}

export function gridCard({ title, desc = '', layout = 'left', pictos }) {
  const L = LAYOUTS[layout]
  const [tx, ty, tw, th] = L.title
  const lines = title.split('\n')
  // a two line title with a description under it steps down a size to keep its margins
  const size = lines.length > 1 && desc ? 72 : 88
  // a line or two under the title, small and grey, saying what this is
  const small = 25
  const descLines = desc ? wrap(desc, tw - 156, small) : []
  const block = (lines.length - 1) * size * 1.08 + (descLines.length ? 28 + descLines.length * small * 1.45 : 0)
  const y0 = ty + th / 2 - block / 2 + size * 0.35
  const dy = y0 + (lines.length - 1) * size * 1.08 + 30 + small
  let defs = '', body = ''
  L.cells.forEach(([x, y, w, h], i) => {
    defs += `<clipPath id="c${i}"><rect x="${x + LINE / 2}" y="${y + LINE / 2}" width="${w - LINE}" height="${h - LINE}"/></clipPath>`
    const [name, spot = 0, rotate = 0] = pictos[i]
    const [px, py, ps] = SPOTS[spot](x, y, w, h)
    body += `<g clip-path="url(#c${i})">${picto(name, px, py, ps, { stroke: c.stone, w: LINE, rotate })}</g>`
  })
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs>${defs}</defs>
<rect width="${W}" height="${H}" fill="${c.paper}"/>
${L.lines.map(([x1, y1, x2, y2]) => `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c.stone}" stroke-width="${LINE}"/>`).join('')}
${body}
${lines.map((l, i) => `<text x="${tx + 78}" y="${y0 + i * size * 1.08}" font-family="Geist" font-weight="500" font-size="${size}" letter-spacing="${-0.03 * size}" fill="${c.ink}">${esc(l)}</text>`).join('')}
${descLines.map((l, i) => `<text x="${tx + 80}" y="${dy + i * small * 1.45}" font-family="Geist" font-size="${small}" fill="${c.dim}">${esc(l)}</text>`).join('')}
</svg>`
}

// a tiny arduino highlighter: keywords red, calls purple, constants blue, strings navy
const KEYWORDS = /^(#include|void|int|const|unsigned|long|float|bool|return|if|else|for|while|true|false)$/
function highlight(line) {
  let out = ''
  const re = /("[^"]*"|<[\w.]+>|\/\/.*$|#?\w+|\s+|.)/g
  const parts = line.match(re) ?? []
  parts.forEach((t, i) => {
    let fill = k.text
    if (t.startsWith('"') || (t.startsWith('<') && t.endsWith('>'))) fill = k.string
    else if (t.startsWith('//')) fill = k.comment
    else if (KEYWORDS.test(t)) fill = k.keyword
    else if (/^[A-Z_][A-Z0-9_]+$/.test(t) || /^\d+$/.test(t)) fill = k.constant
    else if (/^\w+$/.test(t) && parts[i + 1] === '(') fill = k.fn
    out += `<tspan fill="${fill}">${esc(t)}</tspan>`
  })
  return out
}

export function codeCard({ title, source }) {
  const x = 70, y = 70, r = 16, bar = 96
  const lines = source.split('\n')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
<defs><filter id="s" x="-10%" y="-10%" width="130%" height="130%"><feDropShadow dx="0" dy="2" stdDeviation="6" flood-color="#000" flood-opacity="0.06"/></filter></defs>
<rect width="${W}" height="${H}" fill="${c.white}"/>
<g filter="url(#s)"><rect x="${x}" y="${y}" width="${W}" height="${H}" rx="${r}" fill="${k.window}" stroke="#ECECEC" stroke-width="1.5"/></g>
<path d="M${x} ${y + bar} V${y + r} A${r} ${r} 0 0 1 ${x + r} ${y} H${W} V${y + bar} Z" fill="${k.chrome}"/>
<line x1="${x}" y1="${y + bar}" x2="${W}" y2="${y + bar}" stroke="#ECECEC" stroke-width="1.5"/>
${[0, 1, 2].map((i) => `<circle cx="${x + 52 + i * 50}" cy="${y + bar / 2}" r="17" fill="${k.dot}"/>`).join('')}
<text x="${x + 810}" y="${y + bar / 2 + 12}" text-anchor="middle" font-family="Geist" font-size="32" fill="${k.title}">${esc(title)}</text>
${lines.map((l, i) => `<text x="${x + 78}" y="${y + bar + 70 + i * 46}" text-anchor="end" font-family="Geist Mono" font-size="30" fill="${k.line}">${i + 1}</text><text x="${x + 130}" y="${y + bar + 70 + i * 46}" font-family="Geist Mono" font-size="30" xml:space="preserve">${highlight(l)}</text>`).join('')}
</svg>`
}

const samples = {
  home: gridCard({ title: 'blinkproof', desc: 'just say what to build. we wire real parts, write the firmware and prove it runs in a simulator.', pictos: [['led', 0], ['resistor', 0, -40], ['proof', 0], ['blink', 2]] }),
  'release': gridCard({ title: 'blinkproof\nversion 0.2', desc: 'the raspberry pi pico joins the uno and the nano.', pictos: [['chip', 0], ['servo', 0], ['wire', 0, 0], ['knob', 1]] }),
  docs: gridCard({ title: 'writing\na test', desc: 'the steps a gadget has to pass before the agent can hand it over.', layout: 'right', pictos: [['proof', 0], ['button', 1], ['led', 0, -35], ['bolt', 0]] }),
  'pico-support': gridCard({ title: 'raspberry pi\npico support', desc: 'rp2040 in the browser, with pio and a usb serial port.', layout: 'right', pictos: [['chip', 0], ['blink', 0], ['knob', 0], ['wire', 1]] }),
  code: codeCard({
    title: 'blink.ino',
    source: ['void setup() {', '  pinMode(LED_BUILTIN, OUTPUT);', '}', '', 'void loop() {', '  digitalWrite(LED_BUILTIN, HIGH);', '  delay(500);', '  digitalWrite(LED_BUILTIN, LOW);', '  delay(500);', '}'].join('\n'),
  }),
  'code-test': codeCard({
    title: 'test.yaml',
    source: ['name: the led blinks', 'steps:', '  - expect-pin: { pin: 13, value: 1 }', '  - delay: 500ms', '  - expect-pin: { pin: 13, value: 0 }', '  - delay: 500ms', '  - expect-pin: { pin: 13, value: 1 }'].join('\n'),
  }),
}
for (const [name, svg] of Object.entries(samples)) out(`kit/og/${name}.png`, png(svg, 1200))
console.log(`og: ${Object.keys(samples).length} samples, ${PICTO_NAMES.length} pictograms`)
