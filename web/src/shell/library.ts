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
  status: 'building' | 'proven' | 'failed'
  diagram?: Diagram
  sketch?: string
  test?: string
  turns?: number
  tokens?: number
  traceId?: string
  createdAt: string
}

export const api = {
  list: (kind: Saved['kind']) => fetch(`/agent/builds?kind=${kind}`).then((r) => (r.ok ? (r.json() as Promise<Saved[]>) : [])),
  get: (id: string) => fetch(`/agent/builds/${encodeURIComponent(id)}`).then((r) => (r.ok ? (r.json() as Promise<Saved>) : undefined)),
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
  return { builds, examples, offline, refresh }
}

// two pages: / for a new build, /b/:id for anything stored
export type Route = { kind: 'new' } | { kind: 'doc'; id: string }

const parse = (path: string): Route => {
  const m = path.match(/^\/b\/([\w-]+)/)
  return m ? { kind: 'doc', id: m[1] } : { kind: 'new' }
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
    const path = r.kind === 'doc' ? `/b/${r.id}` : '/'
    if (location.pathname !== path) history[replace ? 'replaceState' : 'pushState'](null, '', path)
    setRoute(r)
  }, [])
  return [route, go] as const
}
