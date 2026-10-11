import type { Diagram } from '@blinkproof/sim'
import blinkDiagram from '../../../sketches/blink/diagram.json'
import blinkSrc from '../../../sketches/blink/blink.ino?raw'
import oledDiagram from '../../../sketches/hello-oled/diagram.json'
import oledSrc from '../../../sketches/hello-oled/hello-oled.ino?raw'
import parkingRamSrc from '../../../sketches/parking-ram/parking-ram.ino?raw'
import parkingDiagram from '../../../sketches/parking/diagram.json'
import parkingSrc from '../../../sketches/parking/parking.ino?raw'
import parkingTest from '../../../sketches/parking/test.yaml?raw'
import tourDiagram from '../../../sketches/parts-tour/diagram.json'
import tourSrc from '../../../sketches/parts-tour/parts-tour.ino?raw'
import tourTest from '../../../sketches/parts-tour/test.yaml?raw'
import dimmerDiagram from '../../../sketches/nano-dimmer/diagram.json'
import dimmerSrc from '../../../sketches/nano-dimmer/nano-dimmer.ino?raw'
import dimmerTest from '../../../sketches/nano-dimmer/test.yaml?raw'
import plantDiagram from '../../../sketches/pico-plant/diagram.json'
import plantSrc from '../../../sketches/pico-plant/pico-plant.ino?raw'
import plantTest from '../../../sketches/pico-plant/test.yaml?raw'
import potDiagram from '../../../sketches/pot-print/diagram.json'
import potSrc from '../../../sketches/pot-print/pot-print.ino?raw'
import potTest from '../../../sketches/pot-print/test.yaml?raw'

const d = (x: unknown) => x as Diagram

export type Example = { source: string; diagram: Diagram; test?: string; title: string }

// the circuits built by hand, to open and poke at
export const EXAMPLES: Record<string, Example> = {
  blink: { source: blinkSrc, diagram: d(blinkDiagram), title: 'blink' },
  'hello-oled': { source: oledSrc, diagram: d(oledDiagram), title: 'hello oled' },
  'parts-tour': { source: tourSrc, diagram: d(tourDiagram), test: tourTest, title: 'parts tour' },
  parking: { source: parkingSrc, diagram: d(parkingDiagram), test: parkingTest, title: 'parking sensor' },
  'parking-ram': { source: parkingRamSrc, diagram: d(parkingDiagram), test: parkingTest, title: 'parking sensor, out of ram' },
  'pot-print': { source: potSrc, diagram: d(potDiagram), test: potTest, title: 'pot reader' },
  'nano-dimmer': { source: dimmerSrc, diagram: d(dimmerDiagram), test: dimmerTest, title: 'nano dimmer' },
  'pico-plant': { source: plantSrc, diagram: d(plantDiagram), test: plantTest, title: 'pico plant monitor' },
}

