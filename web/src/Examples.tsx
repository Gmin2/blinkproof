import type { Diagram } from '@blinkproof/sim'
import { useState } from 'react'
import blinkDiagram from '../../sketches/blink/diagram.json'
import blinkSrc from '../../sketches/blink/blink.ino?raw'
import oledDiagram from '../../sketches/hello-oled/diagram.json'
import oledSrc from '../../sketches/hello-oled/hello-oled.ino?raw'
import parkingRamSrc from '../../sketches/parking-ram/parking-ram.ino?raw'
import parkingDiagram from '../../sketches/parking/diagram.json'
import parkingSrc from '../../sketches/parking/parking.ino?raw'
import parkingTest from '../../sketches/parking/test.yaml?raw'
import tourDiagram from '../../sketches/parts-tour/diagram.json'
import tourSrc from '../../sketches/parts-tour/parts-tour.ino?raw'
import tourTest from '../../sketches/parts-tour/test.yaml?raw'
import dimmerDiagram from '../../sketches/nano-dimmer/diagram.json'
import dimmerSrc from '../../sketches/nano-dimmer/nano-dimmer.ino?raw'
import dimmerTest from '../../sketches/nano-dimmer/test.yaml?raw'
import potDiagram from '../../sketches/pot-print/diagram.json'
import potSrc from '../../sketches/pot-print/pot-print.ino?raw'
import potTest from '../../sketches/pot-print/test.yaml?raw'
import { Checks, Serial, TestSteps } from './panels'
import { Workbench, type BenchState } from './Workbench'

const d = (x: unknown) => x as Diagram

const SKETCHES: Record<string, { source: string; diagram: Diagram; test?: string }> = {
  blink: { source: blinkSrc, diagram: d(blinkDiagram) },
  'hello-oled': { source: oledSrc, diagram: d(oledDiagram) },
  'parts-tour': { source: tourSrc, diagram: d(tourDiagram), test: tourTest },
  parking: { source: parkingSrc, diagram: d(parkingDiagram), test: parkingTest },
  'parking-ram': { source: parkingRamSrc, diagram: d(parkingDiagram), test: parkingTest },
  'pot-print': { source: potSrc, diagram: d(potDiagram), test: potTest },
  'nano-dimmer': { source: dimmerSrc, diagram: d(dimmerDiagram), test: dimmerTest },
}

// the circuits built by hand, to poke at
export function Examples({ sound, running }: { sound: boolean; running: boolean }) {
  const [sketch, setSketch] = useState('parking')
  const [testRun, setTestRun] = useState(0)
  const [bench, setBench] = useState<BenchState | null>(null)
  const { diagram, source, test } = SKETCHES[sketch]

  return (
    <div className="flex min-h-0 flex-1">
      <div className="relative min-w-0 flex-1">
        <div className="absolute left-4 top-3 z-10 flex flex-wrap items-center gap-2">
          {Object.keys(SKETCHES).map((s) => (
            <button
              key={s}
              onClick={() => (setSketch(s), setTestRun(0))}
              className={`rounded-md px-3 py-1.5 font-mono text-xs ${s === sketch ? 'bg-accent text-canvas' : 'bg-line text-dim hover:text-ink'}`}
            >
              {s}
            </button>
          ))}
          {test && (
            <button onClick={() => setTestRun((n) => n + 1)} className="rounded-md bg-accent/15 px-3 py-1.5 font-mono text-xs text-accent hover:bg-accent/25">
              run test
            </button>
          )}
          <span className="font-mono text-[11px] text-dim">{bench?.status}</span>
        </div>
        <Workbench key={sketch} diagram={diagram} source={source} test={test} testRun={testRun} running={running} sound={sound} onState={setBench} />
      </div>
      <aside className="flex w-80 flex-col border-l border-line bg-panel">
        <Checks findings={bench?.findings ?? []} />
        {testRun > 0 && <TestSteps steps={bench?.steps ?? []} report={bench?.report ?? null} />}
        <Serial text={bench?.serial ?? ''} />
      </aside>
    </div>
  )
}
