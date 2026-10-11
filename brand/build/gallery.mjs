// kit/index.html, the press kit on one page
import { readdirSync } from 'node:fs'
import tokens from '../tokens.json' with { type: 'json' }
import { c, out } from './lib.mjs'

const files = (dir, ext) => readdirSync(`kit/${dir}`).filter((f) => f.endsWith(ext)).sort()
const tile = (src, label, bg = '#fff', cls = '') => `<figure class="${cls}"><div class="img" style="background:${bg}"><img src="${src}"></div><figcaption>${label}</figcaption></figure>`
const swatch = (name, hex) => `<figure><div class="sw" style="background:${hex}"></div><figcaption>${name}<br><code>${hex}</code></figcaption></figure>`

out('kit/index.html', `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>blinkproof brand</title>
<link rel="icon" href="app/favicon.svg">
<style>
body{margin:0;background:${c.paper};color:${c.ink};font:15px/1.5 Geist,system-ui,sans-serif}
header{padding:56px 40px 32px;border-bottom:2px solid ${c.stone}}
header img{height:44px}
header p{color:#7a7570;margin:14px 0 0}
section{padding:36px 40px;border-bottom:2px solid ${c.stone}}
h2{font:500 13px Geist Mono,ui-monospace,monospace;letter-spacing:.06em;color:#7a7570;margin:0 0 18px}
.grid{display:flex;flex-wrap:wrap;gap:18px}
figure{margin:0}
.img{border-radius:14px;border:1.5px solid ${c.stoneSoft};padding:16px;display:flex;align-items:center;justify-content:center;min-height:110px}
.img img{width:140px;display:block}
.wide .img{padding:0;overflow:hidden}
.wide .img img{width:540px}
figcaption{font-size:12px;color:#7a7570;margin-top:6px}
.sw{width:120px;height:72px;border-radius:12px;border:1.5px solid ${c.stoneSoft}}
code{font-family:Geist Mono,ui-monospace,monospace;font-size:11px}
</style>
<header><img src="logo/lockup-ink.svg"><p>the press kit. everything here is generated from <code>src/</code> and <code>tokens.json</code> by <code>pnpm -C brand build</code></p></header>
<section><h2>logo</h2><div class="grid">${tile('logo/lockup-on-paper.png', 'lockup', c.paper, 'wide')}${tile('logo/lockup-on-ink.png', 'lockup on ink', c.ink, 'wide')}</div>
<div class="grid" style="margin-top:18px">${files('logo', '.svg').map((f) => tile(`logo/${f}`, f, /paper|white/.test(f) ? c.ink : '#fff')).join('')}</div></section>
<section><h2>colour</h2><div class="grid">${Object.entries(tokens.color.brand).map(([k, v]) => swatch(k, v)).join('')}</div>
<div class="grid" style="margin-top:18px">${Object.entries(tokens.color.code).map(([k, v]) => swatch('code ' + k, v)).join('')}</div></section>
<section><h2>parts</h2><div class="grid">${files('pictos', '.svg').map((f) => tile(`pictos/${f}`, f.replace('.svg', ''), c.paper)).join('')}</div></section>
<section><h2>og</h2><div class="grid">${files('og', '.png').map((f) => tile(`og/${f}`, f, '#fff', 'wide')).join('')}</div></section>
<section><h2>app and social</h2><div class="grid">${files('app', '.png').map((f) => tile(`app/${f}`, f, '#fff')).join('')}${files('social', '.png').map((f) => tile(`social/${f}`, f, '#fff')).join('')}</div></section>
`)
console.log('gallery: kit/index.html')
