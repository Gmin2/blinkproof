import { PARTS, connect, type Diagram } from '@blinkproof/sim'
import { useEffect, useRef, useState } from 'react'
import { Icon, Logo, type IconName } from './icons/Icon'
import { PART_ICON } from './icons/Status'
import { CodeEditor } from './shell/CodeEditor'
import { Serial } from './shell/Serial'
import { Inspector, type Mode } from './shell/Inspector'
import { api, drafts, useLibrary, useRoute, type Draft, type Saved } from './shell/library'
import { KIND, Sidebar } from './shell/Sidebar'
import { IDEAS, useBuild } from './shell/useBuild'
import { Workbench, type BenchState } from './Workbench'

type Theme = 'light' | 'dark'

// what the + beside the board offers, in groups: light and sound, input, display and motion
const CONNECT: [keyof typeof PARTS, string, string][][] = [
  [
    ['wokwi-led', 'LED', 'Light it from a pin, resistor included'],
    ['wokwi-buzzer', 'Buzzer', 'Beeps and tunes with tone()'],
    ['wokwi-led-ring', 'LED ring', '16 colour pixels on one pin'],
  ],
  [
    ['wokwi-pushbutton', 'Button', 'Read a press with INPUT_PULLUP'],
    ['wokwi-potentiometer', 'Knob', 'A dial you read with analogRead'],
    ['wokwi-hc-sr04', 'Ultrasonic sensor', 'Measure distance, 2 to 400 cm'],
  ],
  [
    ['wokwi-ssd1306', 'OLED screen', '128 by 64 pixels over i2c'],
    ['wokwi-servo', 'Servo', 'Turn to an angle from 0 to 180'],
  ],
]

type Float = 'prompt' | 'parts' | null

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
  const [selectedWire, setSelectedWire] = useState<string | null>(null)
  // the menu the + beside the board opens, where it opens
  const [connectMenu, setConnectMenu] = useState<{ x: number; y: number } | null>(null)
  const [bench, setBench] = useState<BenchState | null>(null)
  const [testRun, setTestRun] = useState(0)
  // the sim, like wokwi: running, paused, or stopped with the power off
  const [sim, setSim] = useState<'run' | 'pause' | 'stop'>('run')
  const [restart, setRestart] = useState(0)
  // your edits to the sketch: the draft you type, and what you last pressed run on
  const [draft, setDraft] = useState<string>()
  const [applied, setApplied] = useState<string>()
  // your edits to the circuit, with undo and redo, as one value so they can never drift apart
  type Edits = { past: (Diagram | undefined)[]; present?: Diagram; future: (Diagram | undefined)[] }
  const [edits, setEdits] = useState<Edits>({ past: [], future: [] })
  const circuit = edits.present
  const [draftIds, setDraftIds] = useState(() => drafts.ids())
  const [saving, setSaving] = useState(false)
  const serialIn = useRef<((text: string) => void) | null>(null)
  const [sound, setSound] = useState(false)
  const [prompt, setPrompt] = useState(IDEAS[1])
  const [model, setModel] = useState('claude-haiku')
  const [models, setModels] = useState<{ id: string; provider: string; label: string }[]>([{ id: 'claude-haiku', provider: 'litellm', label: 'claude haiku 4.5' }])
  const build = useBuild(
    () => setTestRun((n) => n + 1),
    (t) => setMode(t),
    (id) => {
      go({ kind: 'doc', id }, true)
      lib.refresh()
    },
  )
  const live = route.kind === 'new' || build.savedId === route.id

  const docId = route.kind === 'doc' ? route.id : undefined

  // an edit left on this build last time comes back, in the editor and on the board
  useEffect(() => {
    const saved: Draft = docId ? drafts.get(docId) : {}
    setDraft(saved.sketch)
    setApplied(saved.sketch)
    setEdits({ past: [], present: saved.diagram, future: [] })
    setSim('run')
  }, [docId])

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

  const baseDiagram = (live ? build.diagram : doc?.diagram) ?? null
  const diagram = circuit ?? baseDiagram
  const original = live ? build.source : doc?.sketch
  const source = applied ?? original
  const test = live ? build.test : doc?.test
  const code = draft ?? (live ? build.code : doc?.sketch) ?? ''
  const sketchEdited = draft !== undefined && draft !== original
  const edited = sketchEdited || circuit !== undefined
  const request = live ? build.request : (doc?.request ?? '')
  const listed = lib.builds.find((b) => b.id === docId)?.title
  const title = live && listed ? listed : live ? (build.request ? build.request.split(/[:,.]/)[0].replace(/^(an?|the)\s+/i, '').replace(/^./, (c) => c.toUpperCase()) : 'New Build') : doc === null ? 'Not Found' : (doc?.title ?? 'Loading...')


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
    setSelectedWire(null)
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

  const rename = async (id: string, title: string) => {
    try {
      const b = await api.rename(id, title)
      if (doc?.id === id) setDoc({ ...doc, title })
      lib.upsert(b)
    } catch (e) {
      setToast((e as Error).message)
    }
  }

  // whatever is edited goes to this browser's drafts, a build without edits has none.
  // only after a real change: opening a build must never write, or the empty first render would wipe its draft
  const dirty = useRef(false)
  useEffect(() => {
    if (!docId || !dirty.current) return
    dirty.current = false
    drafts.set(docId, { sketch: sketchEdited ? draft : undefined, diagram: circuit })
    setDraftIds(drafts.ids())
  }, [draft, circuit])

  const editCode = (text: string) => ((dirty.current = true), setDraft(text))

  // a finished change to the circuit: one step of undo
  const editCircuit = (d: Diagram | undefined) => ((dirty.current = true), setEdits((e) => ({ past: [...e.past.slice(-49), e.present], present: d, future: [] })))

  // the diagram with what is on screen, so taking a wire out does not move anything
  const removeWire = (key: string) => {
    if (!diagram) return
    editCircuit({ ...diagram, connections: diagram.connections.filter((c) => `${c[0]}|${c[1]}` !== key) })
    setSelectedWire(null)
  }

  // a new part arrives wired: free pins on the board, its resistor or divider, the toast says where it went
  const addPart = (type: keyof typeof PARTS) => {
    if (!diagram) return setToast('Open a build first, then add parts to it')
    const right = Math.max(...diagram.parts.map((p) => (p.left ?? 0) + ('board' in (PARTS[p.type as keyof typeof PARTS] ?? {}) ? 300 : 140)))
    const board = diagram.parts.find((p) => 'board' in (PARTS[p.type as keyof typeof PARTS] ?? {}))
    const added = connect(diagram, type, { left: Math.round(right / 5) * 5 + 40, top: board?.top ?? 0 })
    if (added.error) return setToast(added.error)
    editCircuit({ ...diagram, parts: [...diagram.parts, ...added.parts], connections: [...diagram.connections, ...added.connections] })
    const main = added.parts.find((p) => p.type === type)!
    const where = Object.values(added.pins)
    setToast(where.length ? `${main.id} is on ${where.map((p) => (/^\d+$/.test(p) ? `pin ${p}` : p)).join(' and ')}` : `Added ${main.id}`)
    setConnectMenu(null)
    select(main.id)
    setMode('design')
  }

  const removePart = (id: string) => {
    if (!diagram) return
    const p = diagram.parts.find((q) => q.id === id)
    if (!p) return
    if ('board' in (PARTS[p.type as keyof typeof PARTS] ?? {})) return setToast('The board stays, every part hangs off it')
    editCircuit({ ...diagram, parts: diagram.parts.filter((q) => q.id !== id), connections: diagram.connections.filter((c) => !c[0].startsWith(`${id}:`) && !c[1].startsWith(`${id}:`)) })
    select(null)
  }

  const setAttr = (id: string, key: string, value: string) => {
    if (!diagram) return
    editCircuit({ ...diagram, parts: diagram.parts.map((p) => (p.id === id ? { ...p, attrs: { ...p.attrs, [key]: value } } : p)) })
  }

  const recolorWire = (key: string, color: string) => {
    if (!diagram) return
    editCircuit({ ...diagram, connections: diagram.connections.map((c) => (`${c[0]}|${c[1]}` === key ? [c[0], c[1], color, c[3]] : c)) })
  }

  const undo = () => ((dirty.current = true), setEdits((e) => (e.past.length ? { past: e.past.slice(0, -1), present: e.past[e.past.length - 1], future: [e.present, ...e.future] } : e)))

  const redo = () => ((dirty.current = true), setEdits((e) => (e.future.length ? { past: [...e.past, e.present], present: e.future[0], future: e.future.slice(1) } : e)))

  const revert = () => {
    dirty.current = true
    setDraft(undefined)
    setApplied(undefined)
    setEdits({ past: [], future: [] })
    setRestart((n) => n + 1)
  }

  // the edit becomes its own build with its own link, the one it came from stays as it was
  const saveFork = async () => {
    const sketch = draft ?? original
    if (!docId || !edited || !sketch || saving) return
    setSaving(true)
    try {
      const fork = await api.fork(docId, { sketch, diagram: diagram ?? undefined, test })
      drafts.set(docId, {})
      setDraftIds(drafts.ids())
      go({ kind: 'doc', id: fork.id })
      lib.upsert(fork)
      setToast('Saved as a new build')
    } catch (e) {
      setToast((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (e.key === 's' && mod) {
        e.preventDefault()
        if (edited) saveFork()
        else setToast('Nothing changed to save')
      }
      // the code editor and text boxes keep their own undo
      const typing = (e.target as HTMLElement).closest?.('input, textarea')
      if (!typing && (e.key === 'Delete' || e.key === 'Backspace') && !(build.busy && live)) {
        if (selectedWire) {
          e.preventDefault()
          removeWire(selectedWire)
        } else if (selected) {
          e.preventDefault()
          removePart(selected)
        }
      }
      if (!typing && e.key === 'Escape') (setSelectedWire(null), setConnectMenu(null))
      if (!typing && mod && e.key.toLowerCase() === 'z') {
        e.preventDefault()
        if (e.shiftKey) redo()
        else undo()
      }
    }
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
  })

  // run the sketch as it is in the editor: compile it if it changed, boot the board fresh
  const runEdited = () => {
    if (draft !== undefined) setApplied(draft)
    setSim('run')
    setRestart((n) => n + 1)
  }



  const codePanel = (
    <>
      <div className="flex h-7 items-center justify-between px-4 text-[12px]">
        <span className="flex min-w-0 items-center gap-1.5 font-semibold text-ink">
          sketch.ino
          {edited && <span className="font-normal text-dim">edited</span>}
        </span>
        <span className="flex items-center gap-2">
          {edited && (
            <>
              <button onClick={revert} className="text-[11px] text-dim hover:text-ink">
                Revert
              </button>
              <button onClick={saveFork} disabled={saving} title="save your edit as a new build with its own link, cmd s" className="h-6 rounded-[7px] bg-input px-2 text-[11px] font-semibold text-ink disabled:opacity-40">
                {saving ? 'Saving...' : 'Save as New Build'}
              </button>
            </>
          )}
          <button onClick={runEdited} disabled={(build.busy && live) || !code} title="compile and run, cmd enter" className="flex h-6 items-center gap-1 rounded-[7px] bg-accent px-2 text-[11px] font-semibold text-on-accent disabled:opacity-40">
            <Icon name="play" size={11} />
            Run
          </button>
        </span>
      </div>
      <div className="mt-2 flex min-h-0 flex-1 flex-col border-t border-sep pt-2">
        {code ? <CodeEditor value={code} onChange={editCode} onRun={runEdited} readOnly={build.busy && live} /> : <p className="px-4 text-[11px] text-dim">No sketch yet. The agent writes one while it builds.</p>}
      </div>
      {bench?.build && !bench.build.ok && (
        <div className="border-t border-sep px-4 py-2.5 font-mono text-[10.5px] leading-4 text-bad">
          {bench.build.diagnostics.slice(0, 3).map((d, i) => (
            <div key={i}>
              line {d.line}: {d.message}
            </div>
          ))}
        </div>
      )}
    </>
  )

  const boardName = diagram?.parts.find((p) => p.type.includes('pico')) ? 'Pico' : diagram?.parts.find((p) => p.type.includes('nano')) ? 'Nano' : 'Uno'
  const serialPanel = (
    <Serial lines={bench?.lines ?? []} simMs={bench?.simMs ?? 0} speed={bench?.speed ?? 0} state={sim} flash={bench?.build?.flash} ram={bench?.build?.ram} board={boardName} onSend={(t) => serialIn.current?.(t)} />
  )

  return (
    <div className="flex h-full">
      <Sidebar route={route} onOpen={open} onNew={openNew} onRename={rename} builds={lib.builds} examples={lib.examples} drafts={draftIds} diagram={diagram} title={title} selected={selected} onSelect={select} busy={build.busy} onParts={() => toggle('parts')} />

      <main className="relative min-w-0 flex-1 bg-canvas" onPointerDown={() => setZoomMenu(false)}>
        {diagram ? (
          <Workbench
            key={route.kind === 'doc' ? route.id : 'new'}
            diagram={diagram}
            source={source}
            test={test}
            testRun={testRun}
            running={sim === 'run'}
            stopped={sim === 'stop'}
            restart={restart}
            serialIn={serialIn}
            editable={!(build.busy && live)}
            onDiagram={editCircuit}
            onHint={setToast}
            fixed={!!circuit || (!live && !!doc?.forkOf)}
            selectedWire={selectedWire}
            onConnect={(x, y) => setConnectMenu((m) => (m ? null : { x, y }))}
            onSelectWire={(k) => (setSelectedWire(k), k && setMode('design'))}
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
              <Tool icon={sim === 'stop' ? 'play' : 'square-stop'} label={sim === 'stop' ? 'start the simulation' : 'stop the simulation'} onClick={() => (sim === 'stop' ? runEdited() : setSim('stop'))} disabled={!diagram} active={sim !== 'stop'} />
              <Tool icon={sim === 'pause' ? 'play' : 'pause'} label={sim === 'pause' ? 'resume' : 'pause'} onClick={() => setSim((s) => (s === 'pause' ? 'run' : 'pause'))} disabled={!diagram || sim === 'stop'} />
              <Tool icon="rotate" label="restart the simulation" onClick={runEdited} disabled={!diagram} />
            </div>
            <div className="pill flex items-center">
              <Tool icon="flask" label="run the test" onClick={runTest} disabled={!test || build.busy} active={mode === 'test'} />
              <Tool icon="refresh-2" label="replay how the agent built it" onClick={replay} disabled={route.kind !== 'doc' || build.busy || lib.examples.some((e) => e.id === route.id) || (!live && !!doc?.forkOf)} />
              <Tool icon={sound ? 'volume-up' : 'volume'} label={sound ? 'sound on' : 'sound off'} onClick={() => setSound((s) => !s)} active={sound} />
            </div>
          </div>
          <div className="pointer-events-auto flex gap-[9px]">
            <div className="pill flex items-center">
              <Tool icon={theme === 'dark' ? 'sun' : 'moon'} label={theme === 'dark' ? 'light mode' : 'dark mode'} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
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

        {float === 'parts' && (
          <Panel title="Parts" onClose={() => setFloat(null)} className="left-2.5 top-[56px] w-[260px]" right={<span className="text-[11px] font-normal text-dim">{Object.keys(PARTS).length}</span>}>
            <div className="max-h-[420px] space-y-px overflow-auto px-1.5 pb-1.5">
              {Object.keys(PARTS).map((t) => {
                const isBoard = 'board' in PARTS[t as keyof typeof PARTS]
                return (
                  <button
                    key={t}
                    onClick={() => addPart(t as keyof typeof PARTS)}
                    disabled={isBoard || !diagram || (build.busy && live)}
                    title={isBoard ? 'a circuit has one board' : !diagram ? 'open a build to add parts' : `add a ${KIND[t] ?? t}`}
                    className="group flex h-[26px] w-full items-center gap-2 rounded-[6px] px-2 text-left text-[12px] text-ink enabled:hover:bg-hover disabled:text-dim"
                  >
                    <Icon name={PART_ICON[t] ?? 'box'} size={16} className="text-icon-2" />
                    <span className="flex-1">{KIND[t] ? KIND[t].charAt(0).toUpperCase() + KIND[t].slice(1) : t}</span>
                    {isBoard ? <span className="text-[10px] text-dim">board</span> : <Icon name="plus" size={12} className="text-icon-2 opacity-0 group-enabled:group-hover:opacity-100" />}
                  </button>
                )
              })}
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
        {edited && route.kind === 'doc' && (
          <div className="pill absolute left-1/2 top-[58px] z-20 flex h-9 -translate-x-1/2 items-center gap-1 pl-3.5 pr-1 text-[12px]" onPointerDown={(e) => e.stopPropagation()}>
            <Icon name="pen-3" size={13} className="text-icon-2" />
            <span className="mr-1.5 text-ink">Unsaved changes</span>
            <button title="undo, cmd z" onClick={undo} disabled={!edits.past.length} className="flex h-7 w-7 items-center justify-center rounded-full text-icon hover:bg-hover disabled:opacity-30">
              <Icon name="rotate" size={14} className="-scale-x-100" />
            </button>
            <button title="redo, shift cmd z" onClick={redo} disabled={!edits.future.length} className="flex h-7 w-7 items-center justify-center rounded-full text-icon hover:bg-hover disabled:opacity-30">
              <Icon name="rotate" size={14} />
            </button>
            <button onClick={revert} className="h-7 rounded-full px-2.5 text-dim hover:bg-hover hover:text-ink">
              Revert
            </button>
            <button onClick={saveFork} disabled={saving} title="save as a new build with its own link, cmd s" className="h-7 rounded-full bg-accent px-3 font-semibold text-on-accent disabled:opacity-40">
              {saving ? 'Saving...' : 'Save as New Build'}
            </button>
          </div>
        )}

        {connectMenu && diagram && (
          <div className="fixed inset-0 z-40" onPointerDown={() => setConnectMenu(null)} onKeyDown={(e) => e.key === 'Escape' && setConnectMenu(null)}>
            <div className="absolute w-[264px]" style={{ left: Math.min(connectMenu.x, innerWidth - 280), top: Math.max(8, Math.min(connectMenu.y - 30, innerHeight - 440)) }} onPointerDown={(e) => e.stopPropagation()}>
              <div className="ml-2 inline-flex h-7 items-center rounded-t-[8px] border border-b-0 border-line bg-panel px-2.5 text-[11px] font-medium text-dim">Connect to {diagram.parts.find((p) => 'board' in (PARTS[p.type as keyof typeof PARTS] ?? {}))?.id ?? 'the board'}</div>
              <div className="float overflow-hidden p-1">
                {CONNECT.map((group, gi) => (
                  <div key={gi} className={gi ? 'mt-1 border-t border-sep pt-1' : ''}>
                    {group.map(([type, name, line]) => (
                      <button key={type} onClick={() => addPart(type)} className="flex w-full items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-left hover:bg-hover">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-input text-icon">
                          <Icon name={PART_ICON[type] ?? 'box'} size={15} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[12px] font-medium text-ink">{name}</span>
                          <span className="block truncate text-[11px] text-dim">{line}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {toast && <div className="pill absolute left-1/2 top-[102px] z-30 -translate-x-1/2 px-4 py-2 text-[12px] font-medium text-ink">{toast}</div>}
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
        forkOf={live ? undefined : doc?.forkOf}
        wire={selectedWire && diagram ? diagram.connections.find((c) => `${c[0]}|${c[1]}` === selectedWire) : undefined}
        onRecolorWire={(c) => selectedWire && recolorWire(selectedWire, c)}
        onRemoveWire={() => selectedWire && removeWire(selectedWire)}
        editable={!(build.busy && live)}
        onRemovePart={removePart}
        onSetAttr={setAttr}
        code={codePanel}
        serial={serialPanel}
        onOpen={open}
        canShare={route.kind === 'doc'}
        onShare={share}
        onDownload={() => diagram && download(`${title.toLowerCase().replace(/\W+/g, '-')}.json`, JSON.stringify({ diagram, sketch: source, test }, null, 2))}
      />
    </div>
  )
}
