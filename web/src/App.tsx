import { PARTS } from '@blinkproof/sim'
import { useEffect, useRef, useState } from 'react'
import { Icon, Logo, type IconName } from './icons/Icon'
import { PART_ICON } from './icons/Status'
import { Inspector, type Mode } from './shell/Inspector'
import { api, useLibrary, useRoute, type Saved } from './shell/library'
import { KIND, Sidebar } from './shell/Sidebar'
import { IDEAS, useBuild } from './shell/useBuild'
import { Workbench, type BenchState } from './Workbench'

type Theme = 'light' | 'dark'
type Float = 'prompt' | 'code' | 'serial' | 'parts' | null

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      const saved = localStorage.getItem('blinkproof:theme')
      if (saved === 'light' || saved === 'dark') return saved
    } catch {}
    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('blinkproof:theme', theme)
    } catch {}
  }, [theme])
  return [theme, setTheme] as const
}

// an icon button inside a toolbar pill
function Tool({ icon, label, onClick, active, disabled, children }: { icon?: IconName; label: string; onClick: () => void; active?: boolean; disabled?: boolean; children?: React.ReactNode }) {
  return (
    <button onClick={onClick} disabled={disabled} title={label} className={`flex h-9 w-9 items-center justify-center rounded-full disabled:opacity-35 ${active ? 'text-accent' : 'text-icon'}`}>
      {children ?? (icon && <Icon name={icon} size={19} />)}
    </button>
  )
}

// a panel floating over the canvas
function Panel({ title, onClose, children, className = '', right }: { title: string; onClose: () => void; children: React.ReactNode; className?: string; right?: React.ReactNode }) {
  return (
    <div className={`float absolute flex flex-col overflow-hidden ${className}`}>
      <div className="flex h-10 shrink-0 items-center justify-between pl-4 pr-2.5 text-[12px] font-semibold text-ink">
        {title}
        <span className="flex items-center gap-2">
          {right}
          <button title="close" onClick={onClose} className="flex h-5 w-5 items-center justify-center rounded-full bg-input text-icon-2 hover:text-ink">
            <Icon name="xmark" size={10} />
          </button>
        </span>
      </div>
      {children}
    </div>
  )
}

function download(name: string, text: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
  a.download = name
  a.click()
  URL.revokeObjectURL(a.href)
}

export default function App() {
  const [theme, setTheme] = useTheme()
  const [route, go] = useRoute()
  const lib = useLibrary()
  // the stored build or example the link points at, when it is not the one being built live
  const [doc, setDoc] = useState<Saved | null>()
  const [toast, setToast] = useState('')
  const [mode, setMode] = useState<Mode>('design')
  const [float, setFloat] = useState<Float>('prompt')
  const [zoomMenu, setZoomMenu] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [bench, setBench] = useState<BenchState | null>(null)
  const [testRun, setTestRun] = useState(0)
  const [running, setRunning] = useState(true)
  const [sound, setSound] = useState(false)
  const [prompt, setPrompt] = useState(IDEAS[1])
  const [model, setModel] = useState('claude-haiku')
  const [models, setModels] = useState<{ id: string; provider: string; label: string }[]>([{ id: 'claude-haiku', provider: 'litellm', label: 'claude haiku 4.5' }])
  const codeEnd = useRef<HTMLDivElement>(null)
  const build = useBuild(
    () => setTestRun((n) => n + 1),
    (t) => (t === 'code' ? setFloat('code') : setMode(t)),
    (id) => {
      go({ kind: 'doc', id }, true)
      lib.refresh()
    },
  )
  const live = route.kind === 'new' || build.savedId === route.id

  useEffect(() => {
    if (route.kind !== 'doc' || build.savedId === route.id) return
    setDoc(undefined)
    setSelected(null)
    setTestRun(0)
    setBench(null)
    api.get(route.id).then((d) => setDoc(d ?? null)).catch(() => setDoc(null))
  }, [route])

  // a build that just finished changes its status in the list
  useEffect(() => {
    if (!build.busy) lib.refresh()
  }, [build.busy])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 1800)
    return () => clearTimeout(t)
  }, [toast])

  useEffect(() => {
    fetch('/agent/models')
      .then((r) => r.json())
      .then((list) => list.length && setModels(list))
      .catch(() => {})
  }, [])

  const diagram = (live ? build.diagram : doc?.diagram) ?? null
  const source = live ? build.source : doc?.sketch
  const test = live ? build.test : doc?.test
  const code = (live ? build.code : doc?.sketch) ?? ''
  const request = live ? build.request : (doc?.request ?? '')
  const title = live ? (build.request ? build.request.split(/[:,.]/)[0].replace(/^(an?|the)\s+/i, '').replace(/^./, (c) => c.toUpperCase()) : 'New Build') : doc === null ? 'Not Found' : (doc?.title ?? 'Loading...')

  useEffect(() => {
    codeEnd.current?.scrollIntoView({ block: 'end' })
  }, [code])

  const openNew = () => {
    if (!build.busy) build.reset()
    go({ kind: 'new' })
    setSelected(null)
    setTestRun(0)
    setBench(null)
    setFloat('prompt')
  }

  const open = (id: string) => {
    go({ kind: 'doc', id })
    setFloat(null)
  }

  // play the stored build again, the way it happened
  const replay = async () => {
    if (route.kind !== 'doc' || build.busy) return
    const events = await api.events(route.id)
    if (!events.length) return setToast('Nothing to replay for this one')
    setFloat(null)
    build.replay(route.id, events)
  }

  const share = async () => {
    if (route.kind !== 'doc') return
    try {
      await navigator.clipboard.writeText(location.href)
      setToast('Link copied')
    } catch {
      setToast(location.href)
    }
  }

  const onState = (s: BenchState) => {
    setBench(s)
    build.reported(s.report)
  }

  const select = (id: string | null) => {
    setSelected(id)
    if (id) setMode('design')
  }

  const runTest = () => {
    setTestRun((n) => n + 1)
    setMode('test')
  }

  const start = () => {
    build.start(prompt, model)
    setFloat(null)
  }

  const toggle = (f: Float) => setFloat((cur) => (cur === f ? null : f))

  return (
    <div className="flex h-full">
      <Sidebar route={route} onOpen={open} onNew={openNew} builds={lib.builds} examples={lib.examples} diagram={diagram} title={title} selected={selected} onSelect={select} busy={build.busy} onParts={() => toggle('parts')} />

      <main className="relative min-w-0 flex-1 bg-canvas" onPointerDown={() => setZoomMenu(false)}>
        {diagram ? (
          <Workbench
            key={route.kind === 'doc' ? route.id : 'new'}
            diagram={diagram}
            source={source}
            test={test}
            testRun={testRun}
            running={running}
            sound={sound}
            reveal={live}
            onState={onState}
            title={title}
            selected={selected}
            onSelect={select}
          />
        ) : (
          // an empty frame waiting for the agent
          <div className="flex h-full items-center justify-center pb-[230px]">
            <div className="relative">
              <span className="absolute -top-[18px] left-0 text-[11px] text-[var(--frame-label)]">{title}</span>
              <div className="flex h-[260px] w-[440px] items-center justify-center bg-frame px-16 text-center text-[12px] leading-[18px] text-dim">
                {doc === null && !live
                  ? 'There is no build at this link. It may have been made on another server.'
                  : !live && doc
                    ? 'This build stopped before it had a circuit.'
                    : route.kind === 'doc' && !live
                      ? 'Loading...'
                      : build.busy
                        ? 'The agent is picking parts...'
                        : 'Describe a gadget. The agent wires it, writes the firmware, and has to pass a test before it hands it over.'}
              </div>
            </div>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 flex h-[52px] items-center justify-between px-2.5">
          <div className="pointer-events-auto flex gap-[9px]">
            <div className="pill flex items-center">
              <Tool label="describe a gadget" onClick={() => (route.kind !== 'new' ? openNew() : toggle('prompt'))} active={float === 'prompt'}>
                <Logo size={20} />
              </Tool>
              <Tool icon="plus" label="new build" onClick={openNew} />
            </div>
            <div className="pill flex items-center">
              <Tool icon={running ? 'pause' : 'play'} label={running ? 'pause' : 'run'} onClick={() => setRunning((r) => !r)} disabled={!diagram} />
            </div>
            <div className="pill flex items-center">
              <Tool icon="flask" label="run the test" onClick={runTest} disabled={!test || build.busy} active={mode === 'test'} />
              <Tool icon="refresh-2" label="replay how the agent built it" onClick={replay} disabled={route.kind !== 'doc' || build.busy || lib.examples.some((e) => e.id === route.id)} />
              <Tool icon={sound ? 'volume-up' : 'volume'} label={sound ? 'sound on' : 'sound off'} onClick={() => setSound((s) => !s)} active={sound} />
            </div>
          </div>
          <div className="pointer-events-auto flex gap-[9px]">
            <div className="pill flex items-center">
              <Tool icon="code" label="sketch.ino" onClick={() => toggle('code')} active={float === 'code'} disabled={!code} />
              <Tool icon="terminal" label="serial monitor" onClick={() => toggle('serial')} active={float === 'serial'} disabled={!diagram} />
            </div>
            <div className="relative" onPointerDown={(e) => e.stopPropagation()}>
              <button onClick={() => setZoomMenu((o) => !o)} className="pill flex h-9 items-center gap-3 pl-3.5 pr-2.5 text-[13px] font-medium text-ink">
                {bench && diagram ? `${Math.round(bench.zoom * 100)}%` : '100%'}
                <Icon name="chevron-down" size={12} className="text-icon" />
              </button>
              {zoomMenu && (
                <div className="menu absolute right-0 top-11 z-20 w-48 p-1.5 text-[12px]">
                  <div className="px-2 pb-1 pt-0.5 text-[11px] font-semibold text-dim">Appearance</div>
                  {(['light', 'dark'] as Theme[]).map((t) => (
                    <button key={t} onClick={() => (setTheme(t), setZoomMenu(false))} className="flex h-[26px] w-full items-center gap-2 rounded-[6px] px-2 text-left text-ink hover:bg-accent hover:text-on-accent">
                      <Icon name={t === 'light' ? 'sun' : 'moon'} size={14} />
                      <span className="flex-1">{t === 'light' ? 'Light' : 'Dark'}</span>
                      {theme === t && <Icon name="check" size={12} />}
                    </button>
                  ))}
                  <div className="mx-2 my-1 border-t border-sep" />
                  <button onClick={() => (dispatchEvent(new Event('resize')), setZoomMenu(false))} className="flex h-[26px] w-full items-center gap-2 rounded-[6px] px-2 text-left text-ink hover:bg-accent hover:text-on-accent">
                    <Icon name="full-screen-2" size={14} />
                    Zoom to Fit
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {float === 'code' && (
          <Panel title="sketch.ino" onClose={() => setFloat(null)} className="right-2.5 top-[56px] bottom-20 w-[380px]" right={<span className="font-mono text-[11px] font-normal text-dim">{code.split('\n').length} lines</span>}>
            <pre className="min-h-0 flex-1 overflow-auto px-3 pb-3 font-mono text-[11px] leading-[18px] text-ink">
              {code.split('\n').map((line, i) => (
                <div key={i} className="flex gap-3">
                  <span className="w-5 shrink-0 select-none text-right text-dim/60">{i + 1}</span>
                  <span className="whitespace-pre">{line}</span>
                </div>
              ))}
              <div ref={codeEnd} />
            </pre>
          </Panel>
        )}

        {float === 'serial' && (
          <Panel title="Serial Monitor" onClose={() => setFloat(null)} className="right-2.5 top-[56px] h-[280px] w-[340px]" right={<span className="font-mono text-[11px] font-normal text-dim">9600 baud</span>}>
            <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-4 pb-3 font-mono text-[11px] leading-[18px] text-ink">{bench?.serial || <span className="text-dim">Nothing printed yet</span>}</pre>
          </Panel>
        )}

        {float === 'parts' && (
          <Panel title="Parts" onClose={() => setFloat(null)} className="left-2.5 top-[56px] w-[260px]" right={<span className="text-[11px] font-normal text-dim">{Object.keys(PARTS).length}</span>}>
            <div className="max-h-[420px] space-y-px overflow-auto px-1.5 pb-1.5">
              {Object.keys(PARTS).map((t) => (
                <div key={t} className="flex h-[26px] items-center gap-2 rounded-[6px] px-2 text-[12px] text-ink hover:bg-hover">
                  <Icon name={PART_ICON[t] ?? 'box'} size={16} className="text-icon-2" />
                  <span className="flex-1">{KIND[t] ? KIND[t].charAt(0).toUpperCase() + KIND[t].slice(1) : t}</span>
                  <span className="font-mono text-[10px] text-dim">{t.replace('wokwi-', '')}</span>
                </div>
              ))}
            </div>
          </Panel>
        )}

        {float === 'prompt' && route.kind === 'new' && (
          <Panel title="Describe a Gadget" onClose={() => setFloat(null)} className="bottom-3 left-1/2 w-[min(560px,calc(100%-40px))] -translate-x-1/2">
            <div className="px-3 pb-3">
              <textarea
                autoFocus
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && start()}
                rows={3}
                placeholder="a gadget, in plain words"
                className="w-full resize-none rounded-[7px] bg-input px-2.5 py-2 text-[12px] leading-[18px] text-ink outline-none placeholder:text-dim"
              />
              <div className="mt-2 flex flex-wrap gap-1.5">
                {IDEAS.map((idea) => (
                  <button key={idea} onClick={() => setPrompt(idea)} className={`h-6 rounded-[7px] px-2 text-[11px] ${prompt === idea ? 'bg-accent text-on-accent' : 'bg-input text-dim hover:text-ink'}`}>
                    {idea.split(':')[0].replace(/^./, (c) => c.toUpperCase())}
                  </button>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-sep pt-3">
                <span className="text-[11px] text-dim">⌘ Return to build</span>
                <button onClick={start} disabled={build.busy} className="h-7 rounded-[7px] bg-accent px-3.5 text-[12px] font-semibold text-on-accent disabled:opacity-50">
                  {build.busy ? 'Building...' : 'Build It'}
                </button>
              </div>
            </div>
          </Panel>
        )}
        {toast && <div className="pill absolute left-1/2 top-[60px] z-30 -translate-x-1/2 px-4 py-2 text-[12px] font-medium text-ink">{toast}</div>}
      </main>

      <Inspector
        mode={mode}
        onMode={setMode}
        diagram={diagram}
        selected={selected}
        bench={bench}
        feed={build.feed}
        verdict={build.verdict}
        request={request}
        test={test}
        testRun={testRun}
        onRunTest={runTest}
        model={model}
        models={models}
        onModel={setModel}
        canShare={route.kind === 'doc'}
        onShare={share}
        onDownload={() => diagram && download(`${title.toLowerCase().replace(/\W+/g, '-')}.json`, JSON.stringify({ diagram, sketch: source, test }, null, 2))}
      />
    </div>
  )
}
