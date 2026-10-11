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
  list: (kind: Saved['kind']) => fetch(`/agent/builds?kind=${kind}`).then((r) => (r.ok ? (r.json() as Promise<Saved[]>) : [])),
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
  const refresh = useCallback(async () => {
    try {
      const [b, e] = await Promise.all([api.list('build'), api.list('example')])
      setBuilds(b)
      setExamples(e)
      setOffline(false)
    } catch {
      setOffline(true)
    }
  }, [])
  useEffect(() => {
    refresh()
  }, [refresh])
  // the list comes from an index that catches up a moment after a write, so show changes straight away
  const upsert = useCallback((b: Saved) => setBuilds((list) => (list.some((x) => x.id === b.id) ? list.map((x) => (x.id === b.id ? { ...x, ...b } : x)) : [b, ...list])), [])
  return { builds, examples, offline, refresh, upsert }
}

// three pages: / is onboarding, /new is the editor with nothing open, /b/:id is anything stored
export type Route = { kind: 'onboard' } | { kind: 'new' } | { kind: 'doc'; id: string }

const parse = (path: string): Route => {
  const m = path.match(/^\/b\/([\w-]+)/)
  return m ? { kind: 'doc', id: m[1] } : path.startsWith('/new') ? { kind: 'new' } : { kind: 'onboard' }
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
    const path = r.kind === 'doc' ? `/b/${r.id}` : r.kind === 'new' ? '/new' : '/'
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
