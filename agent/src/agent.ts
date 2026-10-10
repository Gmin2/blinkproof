import { PromptTemplate, span, trace, wrapOpenAI } from 'neatlogs'
import type OpenAI from 'openai'
import { client as clientFor, findModel } from './models.ts'
import { TOOLS, callTool, type Workspace } from './tools.ts'

export const PROMPT_VERSION = 'v1'

const SYSTEM = new PromptTemplate(`you are blinkproof, you build arduino gadgets that are proven to work.

the user describes a gadget in plain words. you:
1. call list_parts, pick a board (arduino uno, or the smaller arduino nano when the user wants it small) and the parts
2. write_circuit: place the parts and wire every pin they need
3. write_sketch: the firmware
4. write_test: an acceptance test that checks every behaviour the user asked for, from the outside, the way a person would check the gadget
5. run_test, read what failed, fix the circuit, the sketch or the test, and run it again
6. finish once the test passes

the test runs your sketch on the simulated board with 2048 bytes of ram, it behaves like the real board.
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
}

export async function build(request: string, opts: Options = {}) {
  const model = opts.model ?? 'claude-sonnet-4.6'
  const maxTurns = opts.maxTurns ?? 30
  const emit = opts.onEvent ?? (() => {})
  const { provider } = await findModel(model)
  const client = wrapOpenAI(clientFor(provider))
  const ws: Workspace = {}
  const counts: Record<string, number> = {}

  const tool = (name: string) =>
    span({ kind: name === 'finish' ? 'GUARDRAIL' : 'TOOL', name, toolName: name }, async (args: any) => callTool(ws, name, args))

  return trace(
    {
      name: 'build',
      kind: 'AGENT',
      sessionId: opts.sessionId,
      promptTemplate: SYSTEM,
      version: PROMPT_VERSION,
      tags: ['blinkproof', PROMPT_VERSION, ...(opts.tags ?? [])],
      metadata: { request, model, provider },
    },
    async () => {
      emit({ type: 'start', request, model, version: PROMPT_VERSION })
      const messages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: SYSTEM.compile({}) as string },
        { role: 'user', content: request },
      ]
      let tokens = 0
      let summary: string | undefined
      let turns = 0

      for (; turns < maxTurns && !summary; turns++) {
        const res = await client.chat.completions.create({
          model,
          // openai's newer models take max_completion_tokens and refuse max_tokens
          ...(provider === 'openai' ? { max_completion_tokens: 8000 } : { max_tokens: 8000 }),
          messages,
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
        { name: 'verdict', kind: 'EVALUATOR', metadata: { passed, turns, tokens, runs: counts.run_test ?? 0, compiles: counts.compile ?? 0 } },
        async () => ({ passed, turns, tokens, tools: counts, failed_step: ws.report?.failed?.index }),
      )
      emit({ type: 'done', ok: passed, turns, summary, reason: passed ? undefined : `stopped after ${turns} turns`, tokens })
      return { ...verdict, workspace: ws, summary }
    },
  )
}
