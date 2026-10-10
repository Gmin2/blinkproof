import { useState } from 'react'
import { BuildView } from './BuildView'
import { Examples } from './Examples'

export default function App() {
  const [mode, setMode] = useState<'build' | 'examples'>('build')
  const [sound, setSound] = useState(false)
  const [running, setRunning] = useState(true)

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-4 border-b border-line bg-panel px-5 py-3">
        <span className="font-mono text-sm font-semibold tracking-tight text-accent">blinkproof</span>
        <span className="text-xs text-dim">describe a gadget, the agent builds it and has to pass a test</span>
        <nav className="ml-6 flex gap-1">
          {(['build', 'examples'] as const).map((m) => (
            <button key={m} onClick={() => setMode(m)} className={`rounded-md px-3 py-1.5 font-mono text-xs ${mode === m ? 'bg-line text-ink' : 'text-dim hover:text-ink'}`}>
              {m}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setSound((v) => !v)} className="rounded-md bg-line px-3 py-1.5 font-mono text-xs text-ink hover:bg-[#283246]">
            {sound ? 'sound on' : 'sound off'}
          </button>
          {mode === 'examples' && (
            <button onClick={() => setRunning((r) => !r)} className="rounded-md bg-line px-3 py-1.5 font-mono text-xs text-ink hover:bg-[#283246]">
              {running ? 'pause' : 'run'}
            </button>
          )}
        </div>
      </header>
      {mode === 'build' ? <BuildView sound={sound} /> : <Examples sound={sound} running={running} />}
    </div>
  )
}
