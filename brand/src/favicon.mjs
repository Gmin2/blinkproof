// the favicon: a paper led on an ink tile, so it reads on light and dark tabs alike.
// at 16px every edge sits on a whole pixel, drawn by hand. above that it is vector.

// t tile, l led, . clear (the tile corners)
export const FAV16 = [
  '..tttttttttttt..',
  '.tttttttttttttt.',
  'ttttttlllltttttt',
  'tttttllllllttttt',
  'tttttllllllttttt',
  'tttttllllllttttt',
  'tttttllllllttttt',
  'tttttllllllttttt',
  'tttttllllllttttt',
  'ttttlllllllltttt',
  'tttttllttllttttt',
  'tttttllttllttttt',
  'tttttllttllttttt',
  'tttttllttttttttt',
  '.tttttttttttttt.',
  '..tttttttttttt..',
]

export function fav16Svg(tile, led) {
  let rects = ''
  FAV16.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch !== '.') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${ch === 'l' ? led : tile}"/>`
    }),
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" shape-rendering="crispEdges">${rects}</svg>`
}

// the vector tile for 32px and up: a chunkier led than the mark, legs two pixels wide
// every edge lands on the 32px grid, where a pixel is 3.125 units
const LED = 'M34.375 56.25 V34.375 A15.625 15.625 0 0 1 65.625 34.375 V56.25 Z M28.125 56.25 H71.875 V62.5 H28.125 Z M37.5 62.5 H43.75 V81.25 H37.5 Z M56.25 62.5 H62.5 V75 H56.25 Z'

export function favSvg(tile, led, { media = false } = {}) {
  const style = media ? `<style>.t{fill:${tile}}.l{fill:${led}}</style>` : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100">${style}<rect class="t" width="100" height="100" rx="22" fill="${tile}"/><path class="l" d="${LED}" fill="${led}"/></svg>`
}
