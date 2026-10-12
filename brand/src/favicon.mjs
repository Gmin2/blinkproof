import { BODY, LIGHT, LIT } from './mark.mjs'

// the favicon: the paper led symbol on an ink tile, its light in lit, so it reads on light and dark tabs alike.
// at 16px every edge sits on a whole pixel, drawn by hand. above that it is vector.

// t tile, l the symbol, o its light, . clear (the tile corners)
export const FAV16 = [
  '..tttttttttttt..',
  '.tttttttttttttt.',
  'tttttttttttttttt',
  'tttttttttttoottt',
  'tttttttttttoottt',
  'ttttttttltottoot',
  'ttttltttlttttoot',
  'ttttllttltttottt',
  'ttttllltlttttttt',
  'tllllllllllllllt',
  'ttttllltlttttttt',
  'ttttllttlttttttt',
  'ttttltttlttttttt',
  'ttttttttlttttttt',
  '.tttttttttttttt.',
  '..tttttttttttt..',
]

export function fav16Svg(tile, led, lit = LIT) {
  let rects = ''
  FAV16.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${ch === 'l' ? led : ch === 'o' ? lit : tile}"/>`
    }),
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges">${rects}</svg>`
}

// the vector tile for 32px and up: the mark with room around it
export function favSvg(tile, led, { lit = LIT } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100"><rect width="100" height="100" rx="22" fill="${tile}"/><g transform="translate(8 8) scale(0.84)"><path d="${BODY}" fill="${led}"/><path d="${LIGHT}" fill="${lit}"/></g></svg>`
}
