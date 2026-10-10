import { createServer } from 'node:http'
import { flush, init, shutdown } from 'neatlogs'
import { build } from './agent.ts'
import { listModels } from './models.ts'

const PORT = Number(process.env.PORT ?? 5201)

// POST /build {request, model?} -> server sent events, one per agent step, so the canvas can play the build
async function main() {
  // a long running server: init once here, flush after each build, shut down on exit
  await init({ apiKey: process.env.NEATLOGS_API_KEY, endpoint: process.env.NEATLOGS_ENDPOINT, workflowName: 'gadget-build', flushInterval: 1 })
  let busy = false

  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url === '/health') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify({ ok: true, busy }))
    }
    if (req.method === 'GET' && req.url === '/models') {
      res.writeHead(200, { 'content-type': 'application/json' })
      return res.end(JSON.stringify(await listModels()))
    }
    if (req.method !== 'POST' || req.url !== '/build') {
      res.writeHead(404)
      return res.end()
    }
    let body = ''
    for await (const chunk of req) body += chunk
    const { request, model } = JSON.parse(body || '{}') as { request?: string; model?: string }
    if (!request?.trim()) {
      res.writeHead(400)
      return res.end('say what to build')
    }
    // one build at a time, the budget is shared
    if (busy) {
      res.writeHead(409)
      return res.end('a build is already running')
    }
    busy = true
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
    const send = (data: unknown) => res.write(`data: ${JSON.stringify(data)}\n\n`)
    const id = `web-${new Date().toISOString().replace(/[:.]/g, '-')}`
    try {
      const result = await build(request, { model, sessionId: id, tags: ['web'], onEvent: send })
      send({ type: 'result', passed: result.passed, diagram: result.workspace.diagram, sketch: result.workspace.sketch, test: result.workspace.test })
    } catch (e) {
      send({ type: 'error', message: String(e) })
    } finally {
      busy = false
      await flush()
      res.end()
    }
  })
  server.listen(PORT, '127.0.0.1', () => console.log(`agent on http://127.0.0.1:${PORT}`))
  const stop = async () => {
    await shutdown()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
