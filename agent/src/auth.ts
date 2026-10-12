import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'
import { Router, type Request, type Response } from 'express'

export type User = { id: string; login: string; name?: string; avatar?: string }

export type AuthOptions = {
  clientId?: string
  clientSecret?: string
  // signs the session cookie
  secret?: string
  // where the browser reaches us, the callback is under it
  publicUrl?: string
  fetch?: typeof fetch
}

const SESSION = 'bp_session'
const STATE = 'bp_state'
// what this browser built before signing in, so it can see them and keep them once it does
const MADE = 'bp_made'
const MONTH = 30 * 24 * 3600

function cookies(req: Request) {
  const out: Record<string, string> = {}
  for (const part of (req.headers.cookie ?? '').split(';')) {
    const i = part.indexOf('=')
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim())
  }
  return out
}

function setCookie(res: Response, name: string, value: string, maxAge: number, secure: boolean) {
  res.append('set-cookie', `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`)
}

// only back to a page of ours, never off to another site
const safeNext = (next: unknown) => (typeof next === 'string' && next.startsWith('/') && !next.startsWith('//') ? next : '/')

// sign in with github. the session is the user itself in a signed cookie, so there is no table of sessions.
// with no client id it is off: nobody is signed in and nothing asks you to be
export function auth({ clientId, clientSecret, secret, publicUrl = 'http://localhost:5199', fetch: get = fetch }: AuthOptions) {
  const on = !!(clientId && clientSecret)
  const key = secret || randomBytes(32).toString('hex')
  const secure = publicUrl.startsWith('https:')
  const sign = (body: string) => createHmac('sha256', key).update(body).digest('base64url')
  const seal = (u: User) => {
    const body = Buffer.from(JSON.stringify(u)).toString('base64url')
    return `${body}.${sign(body)}`
  }
  const open = (token?: string): User | null => {
    const [body, mac] = (token ?? '').split('.')
    if (!body || !mac) return null
    const want = Buffer.from(sign(body))
    const got = Buffer.from(mac)
    if (want.length !== got.length || !timingSafeEqual(want, got)) return null
    try {
      return JSON.parse(Buffer.from(body, 'base64url').toString())
    } catch {
      return null
    }
  }
  const user = (req: Request) => (on ? open(cookies(req)[SESSION]) : null)
  // the ids built signed out, in a signed cookie so nobody can claim someone else's
  const made = (req: Request): string[] => {
    const [body, mac] = (cookies(req)[MADE] ?? '').split('.')
    if (!body || !mac) return []
    const want = Buffer.from(sign(body))
    const got = Buffer.from(mac)
    if (want.length !== got.length || !timingSafeEqual(want, got)) return []
    try {
      const ids = JSON.parse(Buffer.from(body, 'base64url').toString())
      return Array.isArray(ids) ? ids.filter((x): x is string => typeof x === 'string') : []
    } catch {
      return []
    }
  }
  const remember = (req: Request, res: Response, id: string) => {
    const body = Buffer.from(JSON.stringify([...made(req).filter((x) => x !== id), id].slice(-40))).toString('base64url')
    setCookie(res, MADE, `${body}.${sign(body)}`, MONTH, secure)
  }
  const callback = `${publicUrl}/agent/auth/github/callback`

  const router = Router()
  router.get('/me', (req, res) => {
    res.json({ auth: on, user: user(req) })
  })
  router.get('/auth/github', (req, res) => {
    if (!on) return void res.redirect(safeNext(req.query.next))
    const state = randomBytes(16).toString('hex')
    setCookie(res, STATE, `${state}|${safeNext(req.query.next)}`, 600, secure)
    const q = new URLSearchParams({ client_id: clientId!, redirect_uri: callback, scope: 'read:user', state, allow_signup: 'true' })
    res.redirect(`https://github.com/login/oauth/authorize?${q}`)
  })
  router.get('/auth/github/callback', async (req, res) => {
    const [state, next] = (cookies(req)[STATE] ?? '').split('|')
    setCookie(res, STATE, '', 0, secure)
    if (!on || !state || req.query.state !== state || typeof req.query.code !== 'string') return void res.status(400).send('that sign in link has expired, try again')
    try {
      const tok = await get('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { accept: 'application/json', 'content-type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code: req.query.code, redirect_uri: callback }),
      }).then((r) => r.json() as Promise<{ access_token?: string; error_description?: string }>)
      if (!tok.access_token) return void res.status(400).send(tok.error_description ?? 'github said no')
      const gh = await get('https://api.github.com/user', { headers: { authorization: `Bearer ${tok.access_token}`, accept: 'application/vnd.github+json', 'user-agent': 'blinkproof' } }).then((r) => r.json() as Promise<{ id: number; login: string; name?: string; avatar_url?: string }>)
      if (!gh.id) return void res.status(502).send('could not read your github account')
      const u: User = { id: String(gh.id), login: gh.login, name: gh.name ?? undefined, avatar: gh.avatar_url }
      setCookie(res, SESSION, seal(u), MONTH, secure)
      // what you built before signing in becomes yours
      const ids = made(req)
      if (ids.length) {
        await api.claim(u, ids).catch((e) => console.error('could not keep the builds made signed out', e))
        setCookie(res, MADE, '', 0, secure)
      }
      res.redirect(safeNext(next))
    } catch (e) {
      console.error('github sign in failed', e)
      res.status(502).send('could not reach github, try again')
    }
  })
  router.post('/auth/logout', (_req, res) => {
    setCookie(res, SESSION, '', 0, secure)
    res.json({ ok: true })
  })
  // the server sets claim to hand builds over to whoever just signed in
  const api = { on, user, made, remember, router, seal, claim: async (_u: User, _ids: string[]) => {} }
  return api
}
