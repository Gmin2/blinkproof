import { PromptTemplate, span, trace, wrapOpenAI } from 'neatlogs'
import type OpenAI from 'openai'
import { client as clientFor, findModel } from './models.ts'
import { TOOLS, callTool, type Workspace } from './tools.ts'

export const PROMPT_VERSION = 'v1'

const SYSTEM = new PromptTemplate(`you are blinkproof, you build arduino gadgets that are proven to work.

the user describes a gadget in plain words. you:
1. call list_parts, pick a board (arduino uno; the smaller arduino nano when the user wants it small; the raspberry pi pico when they ask for a pico or 3.3 V) and the parts
2. write_circuit: place the parts and wire every pin they need
3. write_sketch: the firmware
4. write_test: an acceptance test that checks every behaviour the user asked for, from the outside, the way a person would check the gadget
5. run_test, read what failed, fix the circuit, the sketch or the test, and run it again
6. finish once the test passes

the test runs your sketch on the simulated board (the uno and nano have 2048 bytes of ram), it behaves like the real board.
a test that passes because it checks nothing is a failure. never weaken a test to make it pass unless it was wrong about the request.
keep tool arguments complete: always send the whole diagram, the whole sketch, the whole test.
layout: board at left 0 top 0, parts to its right and below, about 200px apart.`)

export type Event =
  | { type: 'start'; request: string; model: string; version: string }
  | { type: 'thinking'; text: string }
  | { type: 'tool'; name: string; args: any; result: Record<string, unknown>; ms: number }
  | { type: 'done'; ok: boolean; turns: number; summary?: string; reason?: string; tokens: number }

export type Options = {
  model?: string
  maxTurns?: number
  sessionId?: string
  onEvent?: (e: Event) => void
  tags?: string[]
  // swap superseded tool arguments and results for stubs before each call
  compact?: boolean
  // a circuit someone already wired by hand: the agent keeps it and writes the code and the test for it
  circuit?: unknown
}

// tools whose arguments replace the last call's: only the newest copy needs to stay in the history
const REPLACES = new Set(['write_circuit', 'write_sketch', 'write_test'])

// the history the model sees: every older circuit, sketch and test, and every older run report,
// becomes a one line stub. the newest of each stays whole, so nothing the model needs is lost
export function compacted(messages: OpenAI.ChatCompletionMessageParam[]) {
  const latest = new Map<string, string>()
  const toolOf = new Map<string, string>()
  for (const m of messages) {
    if (m.role !== 'assistant' || !m.tool_calls) continue
    for (const c of m.tool_calls) {
      if (c.type !== 'function') continue
      toolOf.set(c.id, c.function.name)
      if (REPLACES.has(c.function.name) || c.function.name === 'run_test') latest.set(c.function.name, c.id)
    }
  }
  return messages.map((m) => {
    if (m.role === 'assistant' && m.tool_calls) {
      return {
        ...m,
        tool_calls: m.tool_calls.map((c) =>
          c.type === 'function' && REPLACES.has(c.function.name) && latest.get(c.function.name) !== c.id
            ? { ...c, function: { ...c.function, arguments: JSON.stringify({ superseded: 'an older version, the newest call below has the current one' }) } }
            : c,
        ),
      }
    }
    if (m.role === 'tool' && toolOf.get(m.tool_call_id) === 'run_test' && latest.get('run_test') !== m.tool_call_id) {
      const r = JSON.parse(String(m.content))
      return { ...m, content: JSON.stringify({ ok: r.ok, failed_step: r.failed_step, note: 'an older run, the newest run_test below has the current report' }) }
    }
    return m
  })
}

export async function build(request: string, opts: Options = {}) {
  const model = opts.model ?? 'claude-sonnet-4.6'
  const maxTurns = opts.maxTurns ?? 30
  const emit = opts.onEvent ?? (() => {})
  const { provider } = await findModel(model)
  const client = wrapOpenAI(clientFor(provider))
  const ws: Workspace = opts.circuit ? { diagram: opts.circuit as Workspace['diagram'], handWired: true } : {}
  const counts: Record<string, number> = {}
  const compact = opts.compact ?? process.env.BP_COMPACT !== '0'
  // what each call sends, in bytes of json: the cost the history puts on tokens and traces
  let contextBytes = 0
  let peakContext = 0

  const tool = (name: string) =>
    span({ kind: name === 'finish' ? 'GUARDRAIL' : 'TOOL', name, toolName: name }, async (args: any) => callTool(ws, name, args))

  const result = await trace(
    {
      name: 'build',
      kind: 'AGENT',
      sessionId: opts.sessionId,
      promptTemplate: SYSTEM,
      version: PROMPT_VERSION,
      tags: ['blinkproof', PROMPT_VERSION, ...(compact ? ['compact'] : []), ...(opts.tags ?? [])],
      metadata: { request, model, provider, compact, handWired: !!opts.circuit },
    },
    async (root: any) => {
      const traceId: string | undefined = root?.spanContext?.().traceId
      emit({ type: 'start', request, model, version: PROMPT_VERSION })
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM.compile({}) as string },
        {
          role: 'user',
          content: opts.circuit
            ? `${request}\n\nI already wired this circuit, it is loaded as your current circuit. keep the parts and the pins, change the wiring only if a check says it is wrong. write the sketch and the test for it.\n${JSON.stringify(opts.circuit)}`
            : request,
        },
      ]
      let tokens = 0
      let summary: string | undefined
      let turns = 0

      for (; turns < maxTurns && !summary; turns++) {
        const history = compact ? compacted(messages) : messages
        const size = JSON.stringify(history).length
        contextBytes += size
        peakContext = Math.max(peakContext, size)
        const res = await client.chat.completions.create({
          model,
          // openai's newer models take max_completion_tokens and refuse max_tokens
          ...(provider === 'openai' ? { max_completion_tokens: 8000 } : { max_tokens: 8000 }),
          messages: history,
          tools: TOOLS.map((t) => ({ type: 'function' as const, function: t as any })),
        })
        tokens += res.usage?.total_tokens ?? 0
        const msg = res.choices[0].message
        messages.push(msg)
        if (msg.content) emit({ type: 'thinking', text: msg.content })
        if (!msg.tool_calls?.length) {
          messages.push({ role: 'user', content: 'keep going with the tools until the test passes, then call finish' })
          continue
        }
        for (const call of msg.tool_calls) {
          if (call.type !== 'function') continue
          const name = call.function.name
          let args: any = {}
          try {
            args = JSON.parse(call.function.arguments || '{}')
          } catch {
            args = undefined
          }
          const start = performance.now()
          const result = args === undefined ? { ok: false, errors: ['arguments were not valid json, send them again whole'] } : await tool(name)(args)
          counts[name] = (counts[name] ?? 0) + 1
          emit({ type: 'tool', name, args, result, ms: Math.round(performance.now() - start) })
          messages.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
          if (name === 'finish' && result.done) summary = String(result.summary ?? '')
        }
      }

      const passed = !!summary
      const verdict = await trace(
        { name: 'verdict', kind: 'EVALUATOR', metadata: { passed, turns, tokens, runs: counts.run_test ?? 0, compiles: counts.compile ?? 0, contextBytes, peakContext } },
        async () => ({ passed, turns, tokens, contextBytes, peakContext, tools: counts, failed_step: ws.report?.failed?.index }),
      )
      emit({ type: 'done', ok: passed, turns, summary, reason: passed ? undefined : `stopped after ${turns} turns`, tokens })
      // the trace keeps the verdict, not the workspace: a pico build carries a uf2 of hundreds of kb
      return { ...verdict, summary, traceId }
    },
  )
  return { ...result, workspace: ws }
}
