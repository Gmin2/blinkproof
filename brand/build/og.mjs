// og cards, 1200x630. lockup top left, title bottom left, a mono kicker led by an led, the firefly peeking bottom right
import { characterSvg } from '../src/mascot.mjs'
import { lockupSvg } from '../src/logo.mjs'
import { c, CH, out, png, put } from './lib.mjs'

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;')

export function og({ title, kicker, desc = '', state = 'proven', ground = 'ink', lit = true }) {
  const ink = ground === 'ink'
  const bg = ink ? c.ink : c.paper
  const fg = ink ? c.paper : c.ink
  const lines = title.split('\n')
  const titleY = 470 - (lines.length - 1) * 72
  const lamp = lit ? c.glow : ink ? '#3A3A36' : '#BDBDB8'
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
<rect width="1200" height="630" fill="${bg}"/>
${put(lockupSvg(fg, ink && lit ? { lampFill: c.glow, state: 'proven' } : {}), 60, 56, 250)}
${lines.map((l, i) => `<text x="60" y="${titleY + i * 72}" font-family="Geist" font-weight="600" font-size="64" letter-spacing="-1.6" fill="${fg}">${esc(l)}</text>`).join('')}
${desc ? `<text x="60" y="520" font-family="Geist" font-size="26" fill="${ink ? '#9A9A96' : '#6F6F6B'}">${esc(desc)}</text>` : ''}
<circle cx="67" cy="566" r="7" fill="${lamp}"/>
<text x="86" y="574" font-family="Geist Mono" font-weight="500" font-size="22" letter-spacing="1.5" fill="${ink ? '#C9C9C4' : '#4B4B47'}">${esc(kicker.toUpperCase())}</text>
<g opacity="${ink ? 1 : 0.9}">${put(characterSvg(state, ink ? CH : { ...CH, body: c.ink, eyes: c.paper }), 820, 250, 440)}</g>
</svg>`
}

const samples = {
  home: { title: 'every ai can write\narduino code.\nours has to pass the test.', kicker: 'blinkproof · wokwi for agents' },
  'project-proven': { title: 'parking sensor\nfor my garage', kicker: 'proven · 6/6 checks · arduino uno' },
  'project-draft': { title: 'reaction game', kicker: 'not proven yet · 4/6 checks', state: 'failed', lit: false },
  docs: { title: 'writing a test', desc: 'the yaml the agent has to pass before it hands a build over', kicker: 'docs', ground: 'paper', state: 'idle', lit: false },
  blog: { title: 'the pico runs\nin the browser now', kicker: 'blog · oct 11, 2026', state: 'testing', lit: false },
}
for (const [name, s] of Object.entries(samples)) out(`kit/og/${name}.png`, png(og(s), 1200))
console.log('og: 5 samples')
