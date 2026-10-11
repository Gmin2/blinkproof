import { describe, expect, it } from 'vitest'
import { compacted } from '../src/agent.ts'

const call = (id: string, name: string, args: object) => ({ role: 'assistant' as const, content: null, tool_calls: [{ id, type: 'function' as const, function: { name, arguments: JSON.stringify(args) } }] })
const result = (id: string, body: object) => ({ role: 'tool' as const, tool_call_id: id, content: JSON.stringify(body) })

describe('compacted history', () => {
  const history = [
    { role: 'system' as const, content: 'sys' },
    { role: 'user' as const, content: 'a night light' },
    call('a', 'write_sketch', { code: 'void setup(){} void loop(){} // v1' }),
    result('a', { ok: true }),
    call('b', 'run_test', {}),
    result('b', { ok: false, failed_step: 2, steps: ['pass 0', 'pass 1', 'FAIL 2 the led is off'], parts: 'a long bench dump' }),
    call('c', 'write_sketch', { code: 'void setup(){} void loop(){} // v2' }),
    result('c', { ok: true }),
    call('d', 'run_test', {}),
    result('d', { ok: true, steps: ['pass 0', 'pass 1', 'pass 2'] }),
  ]
  const out = compacted(history)

  it('keeps the newest sketch whole and stubs the older one', () => {
    expect((out[2] as any).tool_calls[0].function.arguments).toContain('superseded')
    expect((out[6] as any).tool_calls[0].function.arguments).toContain('v2')
  })

  it('shrinks an older run report to its verdict and keeps the newest whole', () => {
    expect(JSON.parse((out[5] as any).content)).toMatchObject({ ok: false, failed_step: 2 })
    expect((out[5] as any).content).not.toContain('bench dump')
    expect((out[9] as any).content).toContain('pass 2')
  })

  it('leaves every tool call id paired with its result', () => {
    expect(out.length).toBe(history.length)
    expect(out.filter((m) => m.role === 'tool').map((m: any) => m.tool_call_id)).toEqual(['a', 'b', 'c', 'd'])
  })
})
