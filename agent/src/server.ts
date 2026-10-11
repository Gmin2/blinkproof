import { Circuit } from '@blinkproof/sim'
import express from 'express'
import { flush, init, shutdown } from 'neatlogs'
import { build as agentBuild, type Event } from './agent.ts'
import { auth as githubAuth } from './auth.ts'
import { listModels } from './models.ts'
import { dynamoStore, memoryStore, type Build, type Store } from './store.ts'

type BuildFn = (request: string, opts: { model?: string; sessionId: string; tags: string[]; onEvent: (e: Event) => void; circuit?: unknown }) => ReturnType<typeof agentBuild>

// the editor's backend. every build gets an id the moment it starts, its record goes to the store as it runs,
// and its event log at the end, so /b/:id can open and replay it later
export function createApp({ store, build = agentBuild, after = flush, auth = githubAuth({}) }: { store: Store; build?: BuildFn; after?: () => Promise<unknown>; auth?: ReturnType<typeof githubAuth> }) {
  const app = express()
  app.use(express.json({ limit: '1mb' }))
  app.use(auth.router)
  // whose build this is, when someone is signed in
  const by = (req: express.Request) => {
    const u = auth.user(req)
    return u ? { owner: u.id, ownerLogin: u.login } : {}
  }
  let busy = false

  app.get('/health', (_req, res) => {
    res.json({ ok: true, busy })
  })

  app.get('/models', async (_req, res) => {
    res.json(await listModels())
  })

  // the sidebar: builds newest first, examples, without the heavy fields. with sign in on, the builds are your own
  app.get('/builds', async (req, res) => {
    const kind = req.query.kind === 'example' ? 'example' : 'build'
    const limit = Math.min(100, Number(req.query.limit ?? 30))
    const user = auth.user(req)
    const list = kind === 'build' && auth.on ? (user ? await store.mine(user.id, limit) : []) : await store.list(kind, limit)
    res.json(list.map(({ diagram, sketch, test, ...rest }) => rest))
  })

  app.get('/builds/:id', async (req, res) => {
    const b = await store.get(req.params.id)
    if (!b) return void res.status(404).json({ error: 'no build with that id' })
    res.json(b)
  })

  app.get('/builds/:id/events', async (req, res) => {
    res.json(await store.getEvents(req.params.id))
  })

  // rename a build. examples keep their names
  app.patch('/builds/:id', async (req, res) => {
    const b = await store.get(req.params.id)
    if (!b) return void res.status(404).json({ error: 'no build with that id' })
    if (b.kind !== 'build') return void res.status(403).json({ error: 'examples cannot be renamed' })
    if (auth.on && b.owner && b.owner !== auth.user(req)?.id) return void res.status(403).json({ error: 'only whoever made it can rename it' })
    const title = String(req.body?.title ?? '').trim().slice(0, 80)
    if (!title) return void res.status(400).json({ error: 'a name cannot be empty' })
    await store.update(b.id, { title })
    res.json({ ...b, title })
  })

  // a blank build to make by hand: a board and an empty sketch
  const BLANK: Record<string, { type: string; id: string; title: string; baud: number }> = {
    uno: { type: 'wokwi-arduino-uno', id: 'uno', title: 'Blank Uno', baud: 9600 },
    nano: { type: 'wokwi-arduino-nano', id: 'nano', title: 'Blank Nano', baud: 9600 },
    pico: { type: 'wokwi-pi-pico', id: 'pico', title: 'Blank Pico', baud: 115200 },
  }
  app.post('/builds', async (req, res) => {
    const blank = BLANK[String(req.body?.board ?? '')]
    if (!blank) return void res.status(400).json({ error: 'board is uno, nano or pico' })
    const diagram = { version: 1, author: 'blinkproof', editor: 'blinkproof', parts: [{ type: blank.type, id: blank.id, left: 0, top: 0 }], connections: [] }
    const sketch = `void setup() {\n  Serial.begin(${blank.baud});\n}\n\nvoid loop() {\n}\n`
    const b = await store.create({ kind: 'build', title: blank.title, status: 'edited', diagram, sketch, ...by(req) })
    res.status(201).json(b)
  })

  // save an edit as a new build: a link always shows what it showed, so changes go to a fresh id
  app.post('/builds/:id/fork', async (req, res) => {
    const parent = await store.get(req.params.id)
    if (!parent) return void res.status(404).json({ error: 'no build with that id' })
    const { sketch, diagram = parent.diagram, test = parent.test, title } = (req.body ?? {}) as { sketch?: string; diagram?: unknown; test?: string; title?: string }
    if (typeof sketch !== 'string' || !sketch.includes('setup')) return void res.status(400).json({ error: 'the sketch needs a setup()' })
    if (sketch.length > 100_000) return void res.status(400).json({ error: 'the sketch is over 100 kb' })
    const { circuit, errors } = Circuit.parse(diagram)
    if (!circuit) return void res.status(400).json({ error: `the circuit does not parse: ${errors[0]}` })
    const name = (title?.trim() || `${parent.title}, edited`).slice(0, 80)
    const b = await store.create({ kind: 'build', title: name, request: parent.request, model: parent.model, status: 'edited', diagram, sketch, test, forkOf: { id: parent.id, title: parent.title }, ...by(req) })
    res.status(201).json(b)
  })

  // POST /build {request, model?} -> server sent events, the first one says which id the build is stored under
  app.post('/build', async (req, res) => {
    const { request, model, circuit } = (req.body ?? {}) as { request?: string; model?: string; circuit?: unknown }
    if (circuit !== undefined && !Circuit.parse(circuit).circuit) return void res.status(400).send('that circuit does not parse')
    if (!request?.trim()) return void res.status(400).send('say what to build')
    // the agent spends tokens, so building with it needs an account
    if (auth.on && !auth.user(req)) return void res.status(401).send('sign in with github to build with the agent')
    // one build at a time, the budget is shared
    if (busy) return void res.status(409).send('a build is already running')
    busy = true
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
    const events: unknown[] = []
    const send = (data: unknown) => {
      events.push(data)
      res.write(`data: ${JSON.stringify(data)}\n\n`)
    }
    let record: Build | undefined
    try {
      record = await store.create({ kind: 'build', title: titleOf(request), request, model, status: 'building', ...(circuit ? { diagram: circuit } : {}), ...by(req) })
      res.write(`data: ${JSON.stringify({ type: 'saved', id: record.id })}\n\n`)
      const result = await build(request, { model, sessionId: record.id, tags: circuit ? ['web', 'hand-wired'] : ['web'], onEvent: send, circuit })
      const ws = result.workspace
      send({ type: 'result', passed: result.passed, diagram: ws.diagram, sketch: ws.sketch, test: ws.test })
      await store.update(record.id, { status: result.passed ? 'proven' : 'failed', diagram: ws.diagram, sketch: ws.sketch, test: ws.test, turns: result.turns, tokens: result.tokens, traceId: result.traceId })
    } catch (e) {
      send({ type: 'error', message: String(e) })
      if (record) await store.update(record.id, { status: 'failed' }).catch(() => {})
    } finally {
      if (record) await store.putEvents(record.id, events).catch((e) => console.error('events not saved', e))
      busy = false
      await after()
      res.end()
    }
  })

  return app
}

// "a parking sensor for my garage: an ultrasonic..." -> "Parking sensor for my garage"
export function titleOf(request: string) {
  const head = request.split(/[:.\n]/)[0].trim().replace(/^(an?|the)\s+/i, '')
  const t = head.length > 48 ? head.slice(0, 46).replace(/\s+\S*$/, '') + '...' : head
  return t.charAt(0).toUpperCase() + t.slice(1)
}

async function main() {
  const PORT = Number(process.env.PORT ?? 5201)
  // a long running server: init once here, flush after each build, shut down on exit
  await init({ apiKey: process.env.NEATLOGS_API_KEY, endpoint: process.env.NEATLOGS_ENDPOINT, workflowName: 'gadget-build', flushInterval: 1 })
  const store = process.env.BP_STORE === 'memory' ? memoryStore() : dynamoStore()
  const auth = githubAuth({ clientId: process.env.GITHUB_CLIENT_ID, clientSecret: process.env.GITHUB_CLIENT_SECRET, secret: process.env.BP_SESSION_SECRET, publicUrl: process.env.BP_PUBLIC_URL })
  if (!auth.on) console.log('github sign in is off, set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to turn it on')
  const app = createApp({ store, auth })
  // a build the server was in the middle of when it last stopped never finished, say so instead of spinning forever
  const stale = (await store.list('build', 100).catch(() => [])).filter((b) => b.status === 'building')
  for (const b of stale) await store.update(b.id, { status: 'failed' }).catch(() => {})
  if (stale.length) console.log(`marked ${stale.length} unfinished ${stale.length === 1 ? 'build' : 'builds'} as failed`)
  app.listen(PORT, '127.0.0.1', () => console.log(`agent on http://127.0.0.1:${PORT} (${process.env.BP_STORE === 'memory' ? 'memory store' : 'dynamodb + s3'})`))
  const stop = async () => {
    await shutdown()
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
