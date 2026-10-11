import { describe, expect, it } from 'vitest'
import { compile } from '@blinkproof/compiler'
import { Pico } from '../src/pico'

async function uf2(src: string) {
  const r = await compile('pico', { 'sketch.ino': src })
  if (!r.uf2) throw new Error(r.log)
  return r.uf2
}

describe('pico', () => {
  it('boots an arduino-pico uf2: usb serial, a blinking pin, the adc', async () => {
    const pico = new Pico(await uf2(`
void setup() {
  Serial.begin(115200);
  pinMode(15, OUTPUT);
}
void loop() {
  digitalWrite(15, !digitalRead(15));
  Serial.print("adc ");
  Serial.println(analogRead(26));
  delay(250);
}
`))
    pico.setVolts('GP26', 1.65)
    const t = performance.now()
    pico.run(1200)
    console.log(`1.2 s of pico in ${Math.round(performance.now() - t)} ms`)
    expect(pico.serial).toMatch(/adc 51\d/)
    const gp15 = pico.timeline.filter((e) => e.pin === 'GP15')
    expect(gp15.length).toBeGreaterThanOrEqual(3)
  })
})

describe('pico sonar', () => {
  it('pings on a pico: its 10 us trigger comes out a hair short and still counts', async () => {
    const { HCSR04 } = await import('../src/parts/hcsr04')
    const pico = new Pico(await uf2(`
void setup() { Serial.begin(115200); pinMode(10, OUTPUT); pinMode(11, INPUT); }
void loop() {
  digitalWrite(10, LOW); delayMicroseconds(2);
  digitalWrite(10, HIGH); delayMicroseconds(10);
  digitalWrite(10, LOW);
  Serial.print("us "); Serial.println(pulseIn(11, HIGH, 30000));
  delay(100);
}
`))
    const sonar = new HCSR04(pico, 'GP10', 'GP11', 50)
    pico.run(800)
    expect(sonar.short).toBe(0)
    expect(pico.serial).not.toMatch(/us 0\r?\n/)
    expect(pico.serial).toMatch(/us 29\d\d/)
  })
})

describe('pico plant monitor', () => {
  it('reads the soil on GP26, writes the oled over i2c on GP4/GP5, lights a neopixel through pio', async () => {
    const { readFileSync } = await import('node:fs')
    const { Bench, Circuit, parseScenario, run } = await import('../src')
    const file = (f: string) => readFileSync(new URL(`../../sketches/pico-plant/${f}`, import.meta.url), 'utf8')
    const bench = new Bench(Circuit.parse(JSON.parse(file('diagram.json'))).circuit!, await uf2(file('pico-plant.ino')))
    const r = run(bench, parseScenario(file('test.yaml')).scenario!)
    if (r.failed) console.log(r.failed.detail, '\n', r.failed.bench, '\n', r.failed.serialTail)
    expect(r.failed).toBeUndefined()
  })
})

describe('pico rules', () => {
  const plant = async () => {
    const { readFileSync } = await import('node:fs')
    return JSON.parse(readFileSync(new URL('../../sketches/pico-plant/diagram.json', import.meta.url), 'utf8'))
  }

  it('the plant monitor has no errors', async () => {
    const { Circuit, checkRules } = await import('../src')
    expect(checkRules(Circuit.parse(await plant()).circuit!).filter((f) => f.severity === 'error')).toEqual([])
  })

  it('catches 5 v into a pico pin: an oled on VBUS, a sonar echo straight in', async () => {
    const { Circuit, checkRules } = await import('../src')
    const d = await plant()
    d.connections = d.connections.map((c: string[]) => (c[0] === 'oled1:VIN' ? ['oled1:VIN', 'pico:VBUS', c[2], c[3]] : c))
    d.parts.push({ id: 'sonar', type: 'wokwi-hc-sr04' })
    d.connections.push(['sonar:VCC', 'pico:VBUS', '', []], ['sonar:GND', 'pico:GND.2', '', []], ['sonar:TRIG', 'pico:GP10', '', []], ['sonar:ECHO', 'pico:GP11', '', []])
    const f = checkRules(Circuit.parse(d).circuit!).filter((x) => x.rule === 'five-volt-pin')
    expect(f.map((x) => x.parts[0]).sort()).toEqual(['oled1', 'oled1', 'sonar'])
    expect(f.find((x) => x.parts[0] === 'sonar')!.message).toContain('divider')
  })

  it('takes the divider it asks for: ECHO through 1k to GP11, 2k from GP11 to GND', async () => {
    const { Circuit, checkRules } = await import('../src')
    const d = await plant()
    d.parts.push({ id: 'sonar', type: 'wokwi-hc-sr04' }, { id: 'r1', type: 'wokwi-resistor', attrs: { value: '1000' } }, { id: 'r2', type: 'wokwi-resistor', attrs: { value: '2000' } })
    d.connections.push(
      ['sonar:VCC', 'pico:VBUS', '', []],
      ['sonar:GND', 'pico:GND.2', '', []],
      ['sonar:TRIG', 'pico:GP10', '', []],
      ['sonar:ECHO', 'r1:1', '', []],
      ['r1:2', 'pico:GP11', '', []],
      ['r2:1', 'pico:GP11', '', []],
      ['r2:2', 'pico:GND.3', '', []],
    )
    const errors = checkRules(Circuit.parse(d).circuit!).filter((x) => x.severity === 'error' && x.parts.includes('sonar'))
    expect(errors).toEqual([])
  })

  it('wants the soil sensor on an adc pin and Wire on GP4 and GP5', async () => {
    const { Circuit, checkRules } = await import('../src')
    const d = await plant()
    d.connections = d.connections.map((c: string[]) => (c[1] === 'pico:GP26' ? [c[0], 'pico:GP20', c[2], c[3]] : c[1] === 'pico:GP4' ? [c[0], 'pico:GP8', c[2], c[3]] : c))
    const rules = checkRules(Circuit.parse(d).circuit!).map((x) => x.rule)
    expect(rules).toContain('adc-pin')
    expect(rules).toContain('i2c-pins')
  })
})
