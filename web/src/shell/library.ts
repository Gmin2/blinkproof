import type { Diagram } from '@blinkproof/sim'
import { useCallback, useEffect, useState } from 'react'
import type { AgentEvent } from './useBuild'

// what the server keeps for a build or an example, see agent/src/store.ts
export type Saved = {
  id: string
  kind: 'build' | 'example'
  title: string
  request?: string
  model?: string
  status: 'building' | 'proven' | 'failed' | 'edited'
  diagram?: Diagram
  sketch?: string
  test?: string
  turns?: number
  tokens?: number
  traceId?: string
  forkOf?: { id: string; title: string }
  createdAt: string
}

export const api = {
  list: (kind: Saved['kind']) =>
    fetch(`/agent/builds?kind=${kind}`).then((r) => {
      if (!r.ok) throw new Error(`builds ${r.status}`)
      return r.json() as Promise<Saved[]>
    }),
  get: (id: string) => fetch(`/agent/builds/${encodeURIComponent(id)}`).then((r) => (r.ok ? (r.json() as Promise<Saved>) : undefined)),
  fork: async (id: string, body: { sketch: string; diagram?: Diagram; test?: string; title?: string }) => {
    const r = await fetch(`/agent/builds/${encodeURIComponent(id)}/fork`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(json.error ?? `could not save (${r.status})`)
    return json as Saved
  },
  blank: async (board: string) => {
    const r = await fetch('/agent/builds', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ board }) })
    const json = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(json.error ?? 'could not start a blank build')
    return json as Saved
  },
  rename: async (id: string, title: string) => {
    const r = await fetch(`/agent/builds/${encodeURIComponent(id)}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ title }) })
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error ?? 'could not rename')
    return r.json() as Promise<Saved>
  },
  events: (id: string) => fetch(`/agent/builds/${encodeURIComponent(id)}/events`).then((r) => (r.ok ? (r.json() as Promise<AgentEvent[]>) : [])),
}

// the sidebar lists: recent builds and the examples, both from the server
export function useLibrary() {
  const [builds, setBuilds] = useState<Saved[]>([])
  const [examples, setExamples] = useState<Saved[]>([])
  const [offline, setOffline] = useState(false)
  // a first request can fail while the server or the store wakes up, so try again a few times before calling it offline
  const refresh = useCallback(async () => {
    for (let attempt = 0; attempt < 4; attempt++) {
      try {
        const [b, e] = await Promise.all([api.list('build'), api.list('example')])
        setBuilds(b)
        setExamples(e)
        setOffline(false)
        return
      } catch {
        await new Promise((r) => setTimeout(r, 600 * (attempt + 1)))
      }
    }
    setOffline(true)
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  // the list comes from an index that catches up a moment after a write, so show changes straight away
  const upsert = useCallback((b: Saved) => setBuilds((list) => (list.some((x) => x.id === b.id) ? list.map((x) => (x.id === b.id ? { ...x, ...b } : x)) : [b, ...list])), [])
  return { builds, examples, offline, refresh, upsert }
}

// three pages: / is onboarding, /new is the editor with nothing open, /b/:id is anything stored
export type Route = { kind: 'onboard' } | { kind: 'new' } | { kind: 'doc'; id: string; view?: 'build' }

const parse = (path: string): Route => {
  const m = path.match(/^\/b\/([\w-]+)(\/build)?/)
  return m ? { kind: 'doc', id: m[1], ...(m[2] ? { view: 'build' as const } : {}) } : path.startsWith('/new') ? { kind: 'new' } : { kind: 'onboard' }
}

export function useRoute() {
  const [route, setRoute] = useState<Route>(() => parse(location.pathname))
  useEffect(() => {
    const on = () => setRoute(parse(location.pathname))
    addEventListener('popstate', on)
    return () => removeEventListener('popstate', on)
  }, [])
  // replace keeps the back button sane when a new build gets its id
  const go = useCallback((r: Route, replace = false) => {
    const path = r.kind === 'doc' ? `/b/${r.id}${r.view === 'build' ? '/build' : ''}` : r.kind === 'new' ? '/new' : '/'
    if (location.pathname !== path) history[replace ? 'replaceState' : 'pushState'](null, '', path)
    setRoute(r)
  }, [])
  return [route, go] as const
}

// unsaved edits, one per build, kept in this browser so a reload or a detour does not lose them
const KEY = 'blinkproof:draft:'

export type Draft = { sketch?: string; diagram?: Diagram }

export const drafts = {
  get(id: string): Draft {
    try {
      const raw = localStorage.getItem(KEY + id)
      if (!raw) return {}
      // the first drafts were the sketch alone
      return raw.startsWith('{') ? JSON.parse(raw) : { sketch: raw }
    } catch {
      return {}
    }
  },
  set(id: string, d: Draft) {
    try {
      if (d.sketch === undefined && d.diagram === undefined) localStorage.removeItem(KEY + id)
      else localStorage.setItem(KEY + id, JSON.stringify(d))
    } catch {}
  },
  ids() {
    try {
      return new Set(Object.keys(localStorage).filter((k) => k.startsWith(KEY)).map((k) => k.slice(KEY.length)))
    } catch {
      return new Set<string>()
    }
  },
}

// who is signed in. auth false means the server has sign in off, then nobody needs to be
export type User = { id: string; login: string; name?: string; avatar?: string }
export type Me = { auth: boolean; user: User | null }

export function useMe() {
  const [me, setMe] = useState<Me & { loaded: boolean }>({ auth: false, user: null, loaded: false })
  useEffect(() => {
    fetch('/agent/me')
      .then((r) => (r.ok ? (r.json() as Promise<Me>) : { auth: false, user: null }))
      .catch(() => ({ auth: false, user: null }))
      .then((m) => setMe({ ...m, loaded: true }))
  }, [])
  const signIn = (next = location.pathname) => location.assign(`/agent/auth/github?next=${encodeURIComponent(next)}`)
  const signOut = async () => {
    await fetch('/agent/auth/logout', { method: 'POST' }).catch(() => {})
    location.reload()
  }
  // the agent needs an account: true when you have to sign in before it can build
  const needs = me.auth && !me.user
  return { ...me, needs, signIn, signOut }
}

// what you were about to build, kept across the trip to github and back
export type Pending = { prompt?: string; what?: string; circuit?: Diagram }
export const pending = {
  save(p: Pending) {
    try {
      localStorage.setItem('bp-pending', JSON.stringify(p))
    } catch {}
  },
  take(): Pending | null {
    try {
      const p = localStorage.getItem('bp-pending')
      localStorage.removeItem('bp-pending')
      return p ? JSON.parse(p) : null
    } catch {
      return null
    }
  },
}
