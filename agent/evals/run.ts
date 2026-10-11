import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve as resolvePath } from 'node:path'
import { Bench, Circuit, checkRules, parseScenario, run as runScenario, type Report } from '@blinkproof/sim'
import { flush, init, shutdown } from 'neatlogs'
import { build, PROMPT_VERSION } from '../src/agent.ts'
import { callTool, type Workspace } from '../src/tools.ts'
import { CASES, resolve, type Case } from './cases.ts'

// pnpm -C agent eval [--model claude-haiku] [--label v1] [--only blink,dimmer] [--jobs 3]
// pnpm -C agent eval --check      runs the hidden tests on the reference sketches, no model calls

const argv = process.argv.slice(2)
const flag = (name: string) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : undefined
}
const model = flag('model') ?? 'claude-haiku'
const label = flag('label') ?? PROMPT_VERSION
const only = flag('only')?.split(',')
const jobs = Number(flag('jobs') ?? 3)
const cases = CASES.filter((c) => !only || only.includes(c.id))

// the hidden test on whatever the agent left behind, compiled fresh if it never compiled
async function hidden(c: Case, ws: Workspace): Promise<{ ok: boolean; why: string; report?: Report }> {
  if (!ws.diagram || !ws.sketch) return { ok: false, why: 'no circuit or no sketch' }
  const { yaml, missing } = resolve(c.hidden, ws.diagram as any)
  if (missing.length) return { ok: false, why: `the circuit has no ${missing.join(', ')}` }
  if (!ws.build) await callTool(ws, 'compile', {})
  if (!ws.build?.ok) return { ok: false, why: 'does not compile' }
  const circuit = Circuit.parse(ws.diagram).circuit
  if (!circuit) return { ok: false, why: 'the circuit does not parse' }
  const report = runScenario(new Bench(circuit, ws.build.hex ?? ws.build.uf2!, ws.build.symbols), parseScenario(yaml).scenario!)
  return { ok: report.ok, why: report.ok ? 'pass' : `step ${report.failed!.index} ${report.failed!.kind}: ${report.failed!.detail}`, report }
}

// the reference sketches in sketches/ that some cases can be checked against
const REFERENCE: Record<string, string> = { blink: 'blink', dimmer: 'nano-dimmer', 'pico-plant': 'pico-plant', 'nano-pot-serial': 'pot-print' }

async function check() {
  const root = resolvePath(import.meta.dirname, '../../sketches')
  for (const c of cases) {
    const name = REFERENCE[c.id]
    if (!name) continue
    const diagram = JSON.parse(readFileSync(join(root, name, 'diagram.json'), 'utf8'))
    const sketch = readFileSync(join(root, name, `${name}.ino`), 'utf8')
    const r = await hidden(c, { diagram, sketch })
    console.log(`${r.ok ? 'ok  ' : 'FAIL'} ${c.id} on sketches/${name}: ${r.why}`)
  }
}

type Row = {
  id: string
  board: string
  finished: boolean
  hidden: boolean
  passed: boolean
  why: string
  turns: number
  tokens: number
  contextBytes: number
  runs: number
  errors: string[]
  traceId?: string
  ms: number
}

async function one(c: Case): Promise<Row> {
  const start = performance.now()
  const result = await build(c.request, { model, sessionId: `eval-${label}-${c.id}-${Date.now()}`, tags: ['eval', label, c.id] })
  const ws = result.workspace
  const h = await hidden(c, ws).catch((e) => ({ ok: false, why: `hidden test crashed: ${(e as Error).message}` }))
  const circuit = ws.diagram ? Circuit.parse(ws.diagram).circuit : undefined
  const errors = circuit ? checkRules(circuit, ws.sketch).filter((f) => f.severity === 'error').map((f) => f.rule) : []
  const finished = result.passed
  return {
    id: c.id,
    board: c.board,
    finished,
    hidden: h.ok,
    passed: finished && h.ok && !errors.length,
    why: !finished ? `did not finish: ${h.why}` : h.why,
    turns: result.turns,
    tokens: result.tokens,
    contextBytes: result.contextBytes,
    runs: result.tools.run_test ?? 0,
    errors,
    traceId: result.traceId,
    ms: Math.round(performance.now() - start),
  }
}

async function main() {
  if (argv.includes('--check')) return check()
  await init({ apiKey: process.env.NEATLOGS_API_KEY, endpoint: process.env.NEATLOGS_ENDPOINT, workflowName: 'gadget-eval', flushInterval: 1 })
  const out = resolvePath(import.meta.dirname, '../../tmp/claude/evals', `${label}-${model}-${new Date().toISOString().replace(/[:.]/g, '-')}`)
  mkdirSync(out, { recursive: true })
  console.log(`${cases.length} cases on ${model}, ${jobs} at a time, label ${label}`)

  const rows: Row[] = []
  const queue = [...cases]
  try {
    await Promise.all(
      Array.from({ length: jobs }, async () => {
        for (let c = queue.shift(); c; c = queue.shift()) {
          const row = await one(c).catch((e) => ({ id: c!.id, board: c!.board, finished: false, hidden: false, passed: false, why: `crashed: ${(e as Error).message}`, turns: 0, tokens: 0, contextBytes: 0, runs: 0, errors: [], ms: 0 }) as Row)
          rows.push(row)
          console.log(`${row.passed ? 'PASS' : 'fail'} ${row.id.padEnd(18)} ${String(row.turns).padStart(2)} turns ${String(row.tokens).padStart(7)} tok  ${row.why}`)
          writeFileSync(join(out, 'results.json'), JSON.stringify({ model, label, rows }, null, 2))
        }
      }),
    )
  } finally {
    await flush()
    await shutdown()
  }

  rows.sort((a, b) => CASES.findIndex((c) => c.id === a.id) - CASES.findIndex((c) => c.id === b.id))
  const pass = rows.filter((r) => r.passed).length
  const sum = (k: 'tokens' | 'turns') => rows.reduce((a, r) => a + r[k], 0)
  const md = [
    `# eval ${label} on ${model}`,
    '',
    `${pass} of ${rows.length} passed. ${sum('tokens').toLocaleString()} tokens, ${sum('turns')} turns.`,
    '',
    '| case | board | finished | hidden test | turns | tokens | why | trace |',
    '|---|---|---|---|---|---|---|---|',
    ...rows.map((r) => `| ${r.id} | ${r.board} | ${r.finished ? 'yes' : 'no'} | ${r.hidden ? 'pass' : 'fail'} | ${r.turns} | ${r.tokens} | ${r.why.replace(/\|/g, '/').slice(0, 140)}${r.errors.length ? ` (rules: ${r.errors.join(', ')})` : ''} | ${r.traceId ?? ''} |`),
  ].join('\n')
  writeFileSync(join(out, 'summary.md'), md + '\n')
  console.log(`\n${pass} of ${rows.length} passed, saved to ${out}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
