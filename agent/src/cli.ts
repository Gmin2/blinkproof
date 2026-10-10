import { mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { init, shutdown } from 'neatlogs'
import { build, type Event } from './agent.ts'

// pnpm -C agent build-one "a night light that turns on when you press a button" [--model claude-haiku]
async function main() {
  const argv = process.argv.slice(2)
  const flag = (name: string) => {
    const i = argv.indexOf(`--${name}`)
    return i >= 0 ? argv.splice(i, 2)[1] : undefined
  }
  const model = flag('model')
  const request = argv.join(' ').trim()
  if (!request) throw new Error('say what to build')
  if (!process.env.LITELLM_API_KEY) throw new Error('LITELLM_API_KEY missing, put it in blinkproof/.env')

  await init({ apiKey: process.env.NEATLOGS_API_KEY, workflowName: 'blinkproof', flushInterval: 1 })
  if (!process.env.NEATLOGS_API_KEY) console.log('(no NEATLOGS_API_KEY, traces are not sent)')

  const id = new Date().toISOString().replace(/[:.]/g, '-')
  const show = (e: Event) => {
    if (e.type === 'start') console.log(`building with ${e.model} (${e.version}): ${e.request}`)
    if (e.type === 'thinking') console.log(`  . ${e.text.slice(0, 200).replace(/\n/g, ' ')}`)
    if (e.type === 'tool') {
      const r = e.result
      const note = e.name === 'list_parts' ? '' : r.errors ?? r.findings ?? r.steps ?? r.refused ?? r.compile_errors ?? ''
      console.log(`  ${r.ok === false ? 'FAIL' : 'ok  '} ${e.name} ${e.ms}ms ${JSON.stringify(note).slice(0, 300)}`)
      if (typeof r.parts === 'string' && r.ok === false) console.log(`       ${String(r.parts).replace(/\n/g, '\n       ')}`)
    }
    if (e.type === 'done') console.log(e.ok ? `done in ${e.turns} turns, ${e.tokens} tokens\n${e.summary}` : `gave up: ${e.reason}, ${e.tokens} tokens`)
  }

  const result = await build(request, { model, sessionId: id, onEvent: show })
  const out = resolve(import.meta.dirname, '../../tmp/claude/builds', id)
  mkdirSync(out, { recursive: true })
  const ws = result.workspace
  if (ws.diagram) writeFileSync(join(out, 'diagram.json'), JSON.stringify(ws.diagram, null, 2))
  if (ws.sketch) writeFileSync(join(out, 'sketch.ino'), ws.sketch)
  if (ws.test) writeFileSync(join(out, 'test.yaml'), ws.test)
  writeFileSync(join(out, 'result.json'), JSON.stringify({ request, passed: result.passed, turns: result.turns, tokens: result.tokens, tools: result.tools, report: ws.report }, null, 2))
  console.log(`saved to ${out}`)
  await shutdown()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
