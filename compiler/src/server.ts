import { createServer } from 'node:http'
import { BOARDS, compile, type Board } from './compile.ts'

const PORT = Number(process.env.PORT ?? 5200)

// POST /compile {board, files: {"sketch.ino": "..."}} -> CompileResult
createServer(async (req, res) => {
  const send = (status: number, body: unknown) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  if (req.method === 'GET' && req.url === '/health') return send(200, { ok: true, boards: Object.keys(BOARDS) })
  if (req.method !== 'POST' || req.url !== '/compile') return send(404, { error: 'not found' })

  let body = ''
  for await (const chunk of req) {
    body += chunk
    if (body.length > 400_000) return send(413, { error: 'too big' })
  }
  try {
    const { board = 'uno', files } = JSON.parse(body) as { board?: Board; files: Record<string, string> }
    if (!files || typeof files !== 'object') return send(400, { error: 'files missing' })
    const result = await compile(board, files)
    console.log(`${board} ${result.ok ? 'ok' : 'failed'} ${result.ms}ms${result.cached ? ' cached' : ''}`)
    send(200, result)
  } catch (e) {
    send(400, { error: String(e) })
  }
}).listen(PORT, '127.0.0.1', () => console.log(`compiler on http://127.0.0.1:${PORT}`))
