import { characterSvg } from '../src/mascot.mjs'
import { lockupSvg } from '../src/logo.mjs'
import { c, CH, out, png, put } from './lib.mjs'

out('kit/social/avatar.png', png(`<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"><rect width="400" height="400" fill="${c.ink}"/>${put(characterSvg('proven', CH), 50, 44, 300)}</svg>`, 400))
out('kit/social/x-header.png', png(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="500"><rect width="1500" height="500" fill="${c.ink}"/>${put(lockupSvg(c.paper, { lampFill: c.glow, state: 'proven' }), 520, 190, 620)}<text x="520" y="330" font-family="Geist Mono" font-size="24" letter-spacing="1.5" fill="#9A9A96">THE AGENT HAS TO PASS THE TEST</text>${put(characterSvg('testing', CH), 1180, 230, 360)}</svg>`, 1500))
console.log('social: avatar 400, x header 1500x500')
