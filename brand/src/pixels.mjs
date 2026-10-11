// the firefly placed pixel by pixel for 16px, where an outline scaled down turns to mush.
// used for the favicon and for the 1 bit bitmap the agent can draw on an oled.
export const FIREFLY16 = [
  '................',
  '.##......##.....',
  '..#.....#.......',
  '...#...#........',
  '....####....#...',
  '..########..##..',
  '..#..##..#..###.',
  '..#..##..#..###.',
  '..#########..##.',
  '..########...#..',
  '..#######..##...',
  '..#####..####...',
  '...##..######...',
  '......#######...',
  '.......#####....',
  '................',
]

// lantern pixels, so a two tone render can light them
export const LANTERN16 = [[11, 10], [12, 10], ...[9, 10, 11, 12].map((x) => [x, 11]), ...[7, 8, 9, 10, 11, 12].map((x) => [x, 12]), ...[6, 7, 8, 9, 10, 11, 12].map((x) => [x, 13]), ...[7, 8, 9, 10, 11].map((x) => [x, 14])]

export function pixelSvg({ fill = '#141414', lamp = null, bg = null, size = 16 } = {}) {
  const lit = new Set(LANTERN16.map(([x, y]) => `${x},${y}`))
  let rects = ''
  FIREFLY16.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (ch === '#') rects += `<rect x="${x}" y="${y}" width="1" height="1" fill="${lamp && lit.has(`${x},${y}`) ? lamp : fill}"/>`
    }),
  )
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="${size}" height="${size}" shape-rendering="crispEdges">${bg ? `<rect width="16" height="16" fill="${bg}"/>` : ''}${rects}</svg>`
}
