import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { auth } from '../src/auth.ts'
import { createApp } from '../src/server.ts'
import { memoryStore } from '../src/store.ts'

// github, faked: any code is good for a token, the token is good for one user
const github: any = async (url: string) => ({
  json: async () => (url.includes('access_token') ? { access_token: 'tok' } : { id: 42, login: 'octo', name: 'Octo Cat', avatar_url: 'https://a/42.png' }),
})
const fake: any = async () => ({ passed: true, turns: 1, tokens: 1, traceId: 't', tools: {}, workspace: { diagram: { parts: [] }, sketch: 'void setup(){}', test: 'name: t' } })
const store = memoryStore()
let base = ''
let server: ReturnType<ReturnType<typeof createApp>['listen']>

beforeAll(async () => {
  const a = auth({ clientId: 'id', clientSecret: 'shh', secret: 'k', fetch: github })
  server = createApp({ store, build: fake, after: async () => {}, auth: a }).listen(0)
  await new Promise((r) => server.once('listening', r))
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})
afterAll(() => server.close())

const cookieOf = (res: Response, name: string) =>
  res.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${name}=`))!
    .split(';')[0]

async function signIn() {
  const start = await fetch(`${base}/auth/github?next=/b/abc`, { redirect: 'manual' })
  const to = new URL(start.headers.get('location')!)
  expect(to.host).toBe('github.com')
  const state = to.searchParams.get('state')!
  const back = await fetch(`${base}/auth/github/callback?code=c&state=${state}`, { redirect: 'manual', headers: { cookie: cookieOf(start, 'bp_state') } })
  expect(back.headers.get('location')).toBe('/b/abc')
  return cookieOf(back, 'bp_session')
}

describe('github sign in', () => {
  it('signs you in and says who you are', async () => {
    const session = await signIn()
    const me = await (await fetch(`${base}/me`, { headers: { cookie: session } })).json()
    expect(me).toEqual({ auth: true, user: { id: '42', login: 'octo', name: 'Octo Cat', avatar: 'https://a/42.png' } })
    expect((await (await fetch(`${base}/me`)).json()).user).toBeNull()
  })

  it('turns away a callback whose state does not match', async () => {
    const res = await fetch(`${base}/auth/github/callback?code=c&state=nope`, { redirect: 'manual' })
    expect(res.status).toBe(400)
  })

  it('does not trust a cookie someone edited', async () => {
    const session = await signIn()
    const [, mac] = session.split('=')[1].split('.')
    const forged = `bp_session=${Buffer.from(JSON.stringify({ id: '1', login: 'admin' })).toString('base64url')}.${mac}`
    expect((await (await fetch(`${base}/me`, { headers: { cookie: forged } })).json()).user).toBeNull()
  })

  it('needs you signed in to build, then lists only your builds', async () => {
    const body = JSON.stringify({ request: 'a night light' })
    const anon = await fetch(`${base}/build`, { method: 'POST', headers: { 'content-type': 'application/json' }, body })
    expect(anon.status).toBe(401)

    const session = await signIn()
    const res = await fetch(`${base}/build`, { method: 'POST', headers: { 'content-type': 'application/json', cookie: session }, body })
    const id = JSON.parse((await res.text()).split('\n\n')[0].slice(6)).id
    expect(await store.get(id)).toMatchObject({ owner: '42', ownerLogin: 'octo' })

    const mine = await (await fetch(`${base}/builds`, { headers: { cookie: session } })).json()
    expect(mine.map((b: any) => b.id)).toContain(id)
    expect(await (await fetch(`${base}/builds`)).json()).toEqual([])

    const rename = await fetch(`${base}/builds/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title: 'mine now' }) })
    expect(rename.status).toBe(403)
  })

  it('never sends you off to another site after signing in', async () => {
    const start = await fetch(`${base}/auth/github?next=//evil.example`, { redirect: 'manual' })
    expect(cookieOf(start, 'bp_state')).toMatch(/%7C%2F$/)
  })
})
