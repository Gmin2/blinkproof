export type Box = { id: string; x: number; y: number; w: number; h: number; board?: boolean }

const GAP = 48

const overlaps = (a: Box, b: Box) => a.x < b.x + b.w + GAP / 2 && b.x < a.x + a.w + GAP / 2 && a.y < b.y + b.h + GAP / 2 && b.y < a.y + a.h + GAP / 2

// the agent places parts by guesswork and sometimes drops one on the board. when anything overlaps, keep the
// board where it is and stand the other parts in columns to its right, in the order the agent had them
export function untangle(boxes: Box[]): Record<string, { x: number; y: number }> {
  const keep = Object.fromEntries(boxes.map((b) => [b.id, { x: b.x, y: b.y }]))
  const clash = boxes.some((a, i) => boxes.some((b, j) => j > i && overlaps(a, b)))
  if (!clash) return keep
  const board = boxes.find((b) => b.board) ?? boxes[0]
  const rest = boxes.filter((b) => b !== board).sort((a, b) => a.y - b.y || a.x - b.x)
  const tall = Math.max(board.h, 260)
  const out: Record<string, { x: number; y: number }> = { [board.id]: { x: board.x, y: board.y } }
  let x = board.x + board.w + GAP * 2
  let y = board.y
  let col = 0
  for (const b of rest) {
    if (y > board.y && y + b.h > board.y + tall) {
      x += col + GAP * 1.5
      y = board.y
      col = 0
    }
    out[b.id] = { x, y }
    y += b.h + GAP
    col = Math.max(col, b.w)
  }
  return out
}
