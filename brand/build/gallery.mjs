// kit/index.html, the press kit on one page. open it straight from disk
import { readdirSync } from 'node:fs'
import tokens from '../tokens.json' with { type: 'json' }
import { STATE_NAMES } from '../src/mascot.mjs'
import { c, out } from './lib.mjs'

const files = (dir, ext) => readdirSync(`kit/${dir}`).filter((f) => f.endsWith(ext)).sort()
const tile = (src, label, bg = '#fff') => `<figure><div class="img" style="background:${bg}"><img src="${src}"></div><figcaption>${label}</figcaption></figure>`
const swatch = (name, hex) => `<figure><div class="sw" style="background:${hex}"></div><figcaption>${name}<br><code>${hex}</code></figcaption></figure>`

const html = `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>blinkproof brand</title>
<link rel="icon" href="app/favicon.svg">
<style>
body{margin:0;background:${c.paper};color:${c.ink};font:15px/1.5 Geist,system-ui,sans-serif}
header{padding:48px 40px 24px;border-bottom:1px solid #e3e3df}
header img{height:40px}
header p{color:#6f6f6b;margin:12px 0 0}
section{padding:32px 40px}
h2{font:600 12px Geist Mono,ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#6f6f6b;margin:0 0 16px}
.grid{display:flex;flex-wrap:wrap;gap:16px}
figure{margin:0}
.img{border-radius:16px;padding:14px;display:flex;align-items:center;justify-content:center;min-height:120px}
.img img{width:150px;display:block}
.wide .img img{width:560px}
figcaption{font-size:12px;color:#6f6f6b;margin-top:6px}
.sw{width:120px;height:72px;border-radius:12px;border:1px solid #0001}
code{font-family:Geist Mono,ui-monospace,monospace;font-size:11px}
pre{background:#fff;border-radius:12px;padding:16px;overflow:auto;font:11px/1.5 Geist Mono,monospace;max-height:280px}
ol{max-width:720px;padding-left:20px}
</style>
<header><img src="logo/lockup-ink.svg"><p>the press kit. everything here is generated from <code>src/</code> and <code>tokens.json</code> by <code>node build/all.mjs</code></p></header>
<section><h2>the firefly, five states on one body</h2><div class="grid">${STATE_NAMES.map((s) => tile(`mascot/${s}.png`, s, c.ink)).join('')}</div>
<div class="grid" style="margin-top:16px">${STATE_NAMES.map((s) => tile(`mascot/mark-${s}.svg`, `mark ${s}`)).join('')}</div>
<div class="grid wide" style="margin-top:16px">${tile('mascot/sheet.png', 'sizes, and the hand drawn 16px', '#ECECEA')}</div></section>
<section><h2>logo</h2><div class="grid wide">${tile('logo/lockup-on-ink.png', 'lockup, lit', c.ink)}${tile('logo/lockup-on-paper.png', 'lockup on paper', c.paper)}</div>
<div class="grid" style="margin-top:16px">${files('logo', '.svg').map((f) => tile(`logo/${f}`, f, f.includes('ink') ? '#fff' : c.ink)).join('')}</div></section>
<section><h2>colour</h2><div class="grid">${Object.entries(tokens.color.brand).map(([k, v]) => swatch(k, v)).join('')}</div>
<p style="color:#6f6f6b;font-size:13px">glow only lights on ink, and only for proven. the ui keeps its own colours: ${Object.entries(tokens.color.ui.light).map(([k, v]) => `${k} <code>${v}</code>`).join(', ')}</p></section>
<section><h2>og</h2><div class="grid wide">${files('og', '.png').map((f) => tile(`og/${f}`, f, '#ECECEA')).join('')}</div></section>
<section><h2>app and social</h2><div class="grid">${files('app', '.png').map((f) => tile(`app/${f}`, f, '#ECECEA')).join('')}${files('social', '.png').map((f) => tile(`social/${f}`, f, '#ECECEA')).join('')}</div></section>
<section><h2>on the oled</h2><pre>${'firefly.h'}</pre></section>
`
out('kit/index.html', html.replace('<pre>firefly.h</pre>', '<p>bitmap/firefly.h has the firefly as PROGMEM arrays, 16 and 32 px, for display.drawBitmap</p>'))
console.log('gallery: kit/index.html')
