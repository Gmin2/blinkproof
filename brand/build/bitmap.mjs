// the firefly as 1 bit arrays the agent can paste into a sketch and draw on an ssd1306
import { Resvg } from '@resvg/resvg-js'
import { markSvg } from '../src/mascot.mjs'
import { FIREFLY16 } from '../src/pixels.mjs'
import { out } from './lib.mjs'

function grid32() {
  const r = new Resvg(markSvg('proven', { fill: '#000' }), { fitTo: { mode: 'width', value: 32 } }).render()
  const rows = []
  for (let y = 0; y < 32; y++) {
    let row = ''
    for (let x = 0; x < 32; x++) row += r.pixels[(y * 32 + x) * 4 + 3] > 110 ? '#' : '.'
    rows.push(row)
  }
  return rows
}

// adafruit gfx drawBitmap order: rows top to bottom, msb first
function bytes(rows) {
  const out = []
  for (const row of rows) for (let i = 0; i < row.length; i += 8) out.push('0x' + parseInt(row.slice(i, i + 8).replace(/#/g, '1').replace(/\./g, '0'), 2).toString(16).padStart(2, '0'))
  return out
}

const block = (name, rows) => {
  const b = bytes(rows)
  const w = rows[0].length / 8
  const lines = []
  for (let i = 0; i < b.length; i += w * 2) lines.push('  ' + b.slice(i, i + w * 2).join(', ') + ',')
  return `// ${rows[0].length}x${rows.length}\n${rows.map((r) => '// ' + r).join('\n')}\nconst unsigned char ${name}[] PROGMEM = {\n${lines.join('\n')}\n};\n`
}

const h = `// the blinkproof firefly for an ssd1306 or any adafruit gfx display.
// display.drawBitmap(x, y, firefly32, 32, 32, SSD1306_WHITE);
#pragma once
#include <Arduino.h>

${block('firefly16', FIREFLY16)}
${block('firefly32', grid32())}`
out('kit/bitmap/firefly.h', h)
console.log('bitmap: firefly16 and firefly32 as PROGMEM arrays')
