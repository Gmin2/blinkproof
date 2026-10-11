import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, titleOf } from '../src/server.ts'
import { memoryStore } from '../src/store.ts'

const store = memoryStore()
// a pretend agent: two events and a passing result, no model calls
const fake: any = async (_request: string, { onEvent }: { onEvent: (e: unknown) => void }) => {
  onEvent({ type: 'start', request: 'x', model: 'fake', version: 'v1' })
  onEvent({ type: 'tool', name: 'run_test', args: {}, result: { ok: true }, ms: 1 })
  return { passed: true, turns: 3, tokens: 100, traceId: 'abc', tools: {}, workspace: { diagram: { parts: [] }, sketch: 'void setup(){}', test: 'name: t' } }
}
let base = ''
let server: ReturnType<ReturnType<typeof createApp>['listen']>

beforeAll(async () => {
  server = createApp({ store, build: fake, after: async () => {} }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

describe('server', () => {
  it('streams a build, stores it under an id, and serves it back with its events', async () => {
    const res = await fetch(`${base}/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ request: 'a night light: an led and a button' }) })
    const text = await res.text()
    const events = text.split('\n\n').filter(Boolean).map((c) => JSON.parse(c.slice(6)))
    expect(events[0].type).toBe('saved')
    const id = events[0].id
    expect(events.at(-1).type).toBe('result')

    const b = await (await fetch(`${base}/builds/${id}`)).json()
    expect(b).toMatchObject({ id, kind: 'build', title: 'Night light', status: 'proven', turns: 3, traceId: 'abc', sketch: 'void setup(){}' })
    const log = await (await fetch(`${base}/builds/${id}/events`)).json()
    expect(log.map((e: any) => e.type)).toEqual(['start', 'tool', 'result'])

    const list = await (await fetch(`${base}/builds`)).json()
    expect(list[0].id).toBe(id)
    expect(list[0].sketch).toBeUndefined()
  })

  it('says 404 for an id it does not have, 400 for an empty request', async () => {
    expect((await fetch(`${base}/builds/nope`)).status).toBe(404)
    expect((await fetch(`${base}/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })).status).toBe(400)
  })

  it('titles a build from the first clause of the request', () => {
    expect(titleOf('a parking sensor for my garage: an ultrasonic sensor...')).toBe('Parking sensor for my garage')
  })
})
