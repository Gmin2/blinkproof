export type Build = {
  ok: boolean
  hex?: string
  symbols?: { brkval?: number; heapStart?: number }
  flash?: number
  ram?: number
  ms: number
  cached: boolean
  diagnostics: { line: number; message: string }[]
}

export async function compile(source: string, board = 'uno'): Promise<Build> {
  const res = await fetch('/api/compile', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ board, files: { 'sketch.ino': source } }),
  })
  return res.json()
}
