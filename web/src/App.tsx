import { useEffect, useState } from 'react'
import heroDark from './art/hero-dark.svg'
import heroLight from './art/hero-light.svg'
import loopDark from './art/loop-dark.svg'
import loopLight from './art/loop-light.svg'
import { Icon } from './icons/Icon'
import type { IconName } from './icons/hand'
import { EXAMPLES } from './shell/examples'
import { Inspector, type Tab } from './shell/Inspector'
import { Sidebar, type Page } from './shell/Sidebar'
import { IDEAS, useBuild } from './shell/useBuild'
import { Workbench, type BenchState } from './Workbench'

type Theme = 'light' | 'dark'

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
  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))] as const
}

// an icon button in a floating pill, sketch's toolbar
function Tool({ icon, label, onClick, active, disabled }: { icon: IconName; label: string; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-icon transition-colors hover:bg-hover disabled:opacity-35 ${active ? 'bg-accent-soft text-accent' : ''}`}
    >
      <Icon name={icon} size={20} />
    </button>
  )
}

export default function App() {
  const [theme, toggleTheme] = useTheme()
  const [page, setPage] = useState<Page>({ kind: 'build' })
  const [tab, setTab] = useState<Tab>('design')
  const [selected, setSelected] = useState<string | null>(null)
  const [bench, setBench] = useState<BenchState | null>(null)
  const [testRun, setTestRun] = useState(0)
  const [running, setRunning] = useState(true)
  const [sound, setSound] = useState(false)
  const [prompt, setPrompt] = useState(IDEAS[1])
  const [model, setModel] = useState('claude-haiku')
  const [models, setModels] = useState<{ id: string; provider: string; label: string }[]>([{ id: 'claude-haiku', provider: 'litellm', label: 'claude haiku 4.5' }])
  const build = useBuild(
    () => setTestRun((n) => n + 1),
    (t) => setTab(t),
  )

  useEffect(() => {
    fetch('/agent/models')
      .then((r) => r.json())
      .then((list) => list.length && setModels(list))
      .catch(() => {})
  }, [])

  const example = page.kind === 'example' ? EXAMPLES[page.name] : undefined
  const diagram = example ? example.diagram : build.diagram
  const source = example ? example.source : build.source
  const test = example ? example.test : build.test
  const code = example ? example.source : build.code
  const title = example ? example.title : build.request ? build.request.split(/[:,.]/)[0] : 'new build'

  const open = (p: Page) => {
    setPage(p)
    setSelected(null)
    setTestRun(0)
    setBench(null)
  }

  const onState = (s: BenchState) => {
    setBench(s)
    build.reported(s.report)
  }

  const select = (id: string | null) => {
    setSelected(id)
    if (id) setTab('design')
  }

  return (
    <div className="flex h-full">
      <Sidebar page={page} onPage={open} diagram={diagram} selected={selected} onSelect={select} canReplay={build.canReplay} onReplay={build.replay} busy={build.busy} />

      <main className="relative min-w-0 flex-1 bg-canvas">
        {diagram ? (
          <Workbench
            key={page.kind === 'example' ? page.name : 'build'}
            diagram={diagram}
            source={source}
            test={test}
            testRun={testRun}
            running={running}
            sound={sound}
            reveal={page.kind === 'build'}
            onState={onState}
            title={title}
            selected={selected}
            onSelect={select}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 overflow-hidden px-10 pb-40 pt-16">
            <img src={theme === 'dark' ? heroDark : heroLight} alt="" className="min-h-0 w-full max-w-[460px] select-none" draggable={false} />
            <p className="max-w-md text-center text-[13px] leading-5 text-dim">
              {build.busy ? 'the agent is picking parts...' : 'describe a gadget in plain words. the agent wires it, writes the firmware, and has to pass a test before it hands it over'}
            </p>
            <img src={theme === 'dark' ? loopDark : loopLight} alt="how it works: describe it, it builds, it tests, it fixes, proven" className="w-full max-w-[720px] select-none" draggable={false} />
          </div>
        )}

        {/* toolbar pills over the canvas, like sketch */}
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between p-2.5">
          <div className="pointer-events-auto flex gap-2">
            <div className="pill flex items-center gap-0.5 p-0.5">
              <Tool icon="build" label="new build" onClick={() => open({ kind: 'build' })} active={page.kind === 'build'} />
              <Tool icon="examples" label="open the parking sensor" onClick={() => open({ kind: 'example', name: 'parking' })} active={page.kind === 'example'} />
            </div>
            <div className="pill flex items-center gap-0.5 p-0.5">
              <Tool icon={running ? 'pause' : 'play'} label={running ? 'pause' : 'run'} onClick={() => setRunning((r) => !r)} disabled={!diagram} />
              <Tool icon="test" label="run the test" onClick={() => (setTestRun((n) => n + 1), setTab('test'))} disabled={!test || build.busy} />
              <Tool icon="replay" label="replay the last build" onClick={() => (open({ kind: 'build' }), build.replay())} disabled={!build.canReplay || build.busy} />
            </div>
          </div>
          <div className="pointer-events-auto flex gap-2">
            <div className="pill flex h-10 items-center px-4 font-mono text-[12px] font-medium text-ink">{bench && diagram ? `${Math.round(bench.zoom * 100)}%` : '100%'}</div>
            <div className="pill flex items-center gap-0.5 p-0.5">
              <Tool icon={sound ? 'sound-on' : 'sound-off'} label={sound ? 'sound on' : 'sound off'} onClick={() => setSound((s) => !s)} />
              <Tool icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'light mode' : 'dark mode'} onClick={toggleTheme} />
            </div>
          </div>
        </div>

        {/* the prompt, a floating bar at the bottom of the canvas */}
        {page.kind === 'build' && (
          <div className="absolute inset-x-0 bottom-4 flex justify-center px-6">
            <div className="pill w-full max-w-[640px] p-2" style={{ borderRadius: 16 }}>
              {!build.diagram && !build.busy && (
                <div className="flex flex-wrap gap-1.5 px-1 pb-2">
                  {IDEAS.map((idea) => (
                    <button key={idea} onClick={() => setPrompt(idea)} className="rounded-full bg-input px-2.5 py-1 text-[11px] text-dim hover:text-ink">
                      {idea.split(':')[0]}
                    </button>
                  ))}
                </div>
              )}
              <div className="flex items-end gap-2">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && (e.metaKey || e.ctrlKey) && build.start(prompt, model)}
                  rows={2}
                  placeholder="describe a gadget"
                  className="min-h-[40px] flex-1 resize-none bg-transparent px-2 py-1.5 text-[13px] leading-5 text-ink outline-none placeholder:text-dim"
                />
                <select value={model} onChange={(e) => setModel(e.target.value)} className="h-8 rounded-[8px] bg-input px-2 text-[11px] text-dim outline-none">
                  {['litellm', 'anthropic', 'openai'].map((p) => {
                    const group = models.filter((m) => m.provider === p)
                    return group.length ? (
                      <optgroup key={p} label={p === 'litellm' ? 'neatHack credits' : p}>
                        {group.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </optgroup>
                    ) : null
                  })}
                </select>
                <button
                  onClick={() => build.start(prompt, model)}
                  disabled={build.busy}
                  className="flex h-8 items-center gap-1.5 rounded-[8px] bg-accent px-3 text-[12px] font-semibold text-white disabled:opacity-50"
                >
                  <Icon name="build" size={16} blob={false} />
                  {build.busy ? 'building' : 'build it'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Inspector tab={tab} onTab={setTab} diagram={diagram} selected={selected} bench={bench} feed={build.feed} verdict={build.verdict} request={build.request} code={code} test={test} testRun={testRun} />
    </div>
  )
}
