import { compile, type CompileResult } from '@blinkproof/compiler'
import { Bench, Circuit, PARTS, STEPS, checkRules, parseScenario, run, type Diagram, type Finding, type Report } from '@blinkproof/sim'

// what the agent has built so far
export type Workspace = {
  // wired by hand in the editor or onboarding: the agent may not rewire it while it checks out
  handWired?: boolean
  diagram?: Diagram
  sketch?: string
  test?: string
  build?: CompileResult
  report?: Report
  // the sketch and circuit the last passing test ran against
  passed?: string
}

// what a model needs to know about each part to wire it and to test it
const NOTES: Record<string, string> = {
  'wokwi-arduino-uno': 'the board. digital pins "0".."13", analog "A0".."A5", power "5V" "3.3V", ground "GND.1" "GND.2" "GND.3". i2c is A4 (SDA) and A5 (SCL). pwm on 3 5 6 9 10 11',
  'wokwi-arduino-nano': 'a smaller board, same chip as the uno. digital pins "0".."13", analog "A0".."A7" (A6 and A7 are analog input only, no digital, no pinMode), power "5V" "3.3V", ground "GND.1" "GND.2". i2c is A4 (SDA) and A5 (SCL). pwm on 3 5 6 9 10 11',
  'wokwi-pi-pico': 'raspberry pi pico (rp2040), 3.3 V logic. pins "GP0".."GP22", "GP26".."GP28" (in the sketch just the number, 15 means GP15). analog only on GP26 GP27 GP28 (analogRead(26), 0..1023). power "3V3" (3.3 V out), "VBUS" (5 V from usb), ground "GND.1".."GND.8". Wire (i2c) is GP4 SDA and GP5 SCL. every pin does pwm. GP25 is the onboard led. NOT 5 V tolerant: a part on 5 V must not drive a pico pin (power i2c parts from 3V3, put a divider on a 5 V sensor output). Serial is usb: after Serial.begin(115200) add while (!Serial) delay(10); or the first lines are lost. Servo.h and tone() work, NeoPixel works',
  'wokwi-led': 'A is the anode (long leg, toward the pin), C the cathode (to GND). needs a series resistor. attrs: color (red green blue yellow white)',
  'wokwi-resistor': 'pins 1 and 2. attrs: value in ohms as a string, like "220"',
  'wokwi-pushbutton': '1.l and 1.r are one contact, 2.l and 2.r the other, pressed joins them. wire one side to a pin and the other to GND, use INPUT_PULLUP, pressed reads LOW. test control: pressed (1 or 0)',
  'wokwi-ssd1306': '128x64 oled on i2c at 0x3C. DATA is SDA (A4), CLK is SCL (A5), VIN to 5V, GND. use Adafruit_SSD1306 display(128, 64, &Wire, -1) and display.begin(SSD1306_SWITCHCAPVCC, 0x3C). it mallocs a 1024 byte buffer, the uno has 2048 bytes of ram in all',
  'wokwi-potentiometer': 'VCC to 5V, GND, SIG to an analog pin. test control: position (0.0 to 1.0, reads 0 to 1023)',
  'wokwi-neopixel': 'one ws2812 pixel. VDD 5V, VSS GND, DIN to a digital pin. Adafruit_NeoPixel, NEO_GRB + NEO_KHZ800, call begin()',
  'wokwi-led-ring': 'ws2812 ring. VCC 5V, GND, DIN to a digital pin. attrs: pixels (default "16"). Adafruit_NeoPixel, NEO_GRB + NEO_KHZ800, call begin(). 3 bytes of ram a pixel',
  'wokwi-servo': 'V+ 5V, GND, PWM to a digital pin. Servo library, attach(pin), write(0..180)',
  'wokwi-hc-sr04': 'ultrasonic distance. VCC 5V (not 3.3V), GND, TRIG and ECHO to digital pins. trigger 10us high, pulseIn(ECHO, HIGH, 30000) / 58 = cm. attrs: distance (cm). test control: distance (2 to 400)',
  'wokwi-buzzer': 'passive buzzer. 2 (+) to a digital pin, 1 (-) to GND. tone(pin, hz) and noTone(pin), a steady HIGH is silent',
}

const LIBRARIES = 'Adafruit_SSD1306.h, Adafruit_GFX.h, Adafruit_NeoPixel.h, Servo.h, Wire.h, plus the arduino core. nothing else is installed'

export const TOOLS = [
  {
    name: 'list_parts',
    description: 'the parts you can use, their pins, attrs and how to drive and test them. call this first',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'write_circuit',
    description: 'write the whole circuit as a wokwi diagram.json: {"version":1,"parts":[{"id","type","left","top","attrs"}],"connections":[["part:pin","part:pin","color",[]]]}. exactly one board. returns format errors and wiring rule findings',
    parameters: { type: 'object', properties: { diagram: { type: 'object', description: 'the diagram.json object' } }, required: ['diagram'] },
  },
  {
    name: 'write_sketch',
    description: `write the whole arduino sketch (.ino). libraries available: ${LIBRARIES}. returns wiring rule findings that depend on the sketch`,
    parameters: { type: 'object', properties: { code: { type: 'string' } }, required: ['code'] },
  },
  {
    name: 'write_test',
    description: `write the acceptance test as wokwi scenario yaml: name, version: 1, steps. steps: ${STEPS.join(', ')}. examples:
- wait-serial: 'ready'
- delay: 300ms
- set-control: { part-id: btn1, control: pressed, value: 1 }
- set-control: { part-id: sonar1, control: distance, value: 20 }
- expect-pin: { part-id: led1, name: A, value: 1 }
- expect-led: { part-id: led1, lit: true } or for pwm { part-id: led1, min-brightness: 0.4, max-brightness: 0.6 }
- wait-text: { part-id: oled1, contains: 'STOP', timeout: 1s }
- expect-text: { part-id: oled1, contains: '20 cm' }
- expect-pixels: { part-id: ring1, lit: 16 } or { part-id: ring1, min-lit: 4, max-lit: 8 } or { part-id: ring1, index: 0, color: red }
- expect-servo: { part-id: servo1, angle: 90 }
- expect-tone: { part-id: bz1, hz: 440 } or { part-id: bz1, silent: true }, add within: 1s for beeps that come and go
the test must check every behaviour the user asked for`,
    parameters: { type: 'object', properties: { yaml: { type: 'string' } }, required: ['yaml'] },
  },
  {
    name: 'compile',
    description: 'compile the sketch for the board in the circuit. returns errors with line numbers, flash and ram used. ram here leaves out what malloc takes at runtime',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'run_test',
    description: 'compile if needed, run the sketch on the simulated circuit and play the test. returns each step, and for a failure the state of every part, free ram and the last serial lines',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'finish',
    description: 'hand the build over. only works once run_test has passed on the current circuit and sketch',
    parameters: { type: 'object', properties: { summary: { type: 'string', description: 'one paragraph for the user: what it does and how it is wired' } }, required: ['summary'] },
  },
] as const

export type ToolName = (typeof TOOLS)[number]['name']

const brief = (f: Finding) => `${f.severity}: ${f.message}`

function findings(ws: Workspace) {
  if (!ws.diagram) return []
  const { circuit } = Circuit.parse(ws.diagram)
  return circuit ? checkRules(circuit, ws.sketch) : []
}

// the board in the circuit decides what the sketch is compiled for
const boardOf = (ws: Workspace) => {
  const types = ws.diagram?.parts.map((p) => p.type) ?? []
  return types.includes('wokwi-pi-pico') ? 'pico' : types.includes('wokwi-arduino-nano') ? 'nano' : 'uno'
}

const fingerprint = (ws: Workspace) => JSON.stringify([ws.diagram, ws.sketch, ws.test])

// each tool returns a plain object, it goes back to the model as json
export async function callTool(ws: Workspace, name: string, args: any): Promise<Record<string, unknown>> {
  switch (name) {
    case 'list_parts':
      return {
        parts: Object.entries(PARTS).map(([type, p]) => ({ type, pins: p.pins, notes: NOTES[type] })),
        libraries: LIBRARIES,
      }

    case 'write_circuit': {
      // a circuit someone wired by hand stays theirs, unless the checks find something actually wrong with it
      if (ws.handWired && !findings(ws).some((f) => f.severity === 'error'))
        return { ok: false, refused: 'this circuit was wired by hand and passes the checks. keep it as it is and write the sketch for the pins as they are wired' }
      const { circuit, errors } = Circuit.parse(args?.diagram)
      if (!circuit) return { ok: false, errors }
      ws.diagram = args.diagram
      ws.report = undefined
      // the board may have changed, the next run compiles again (from the cache when nothing did)
      ws.build = undefined
      const f = findings(ws)
      return { ok: !f.some((x) => x.severity === 'error'), parts: circuit.diagram.parts.length, wires: circuit.diagram.connections.length, findings: f.map(brief) }
    }

    case 'write_sketch': {
      if (typeof args?.code !== 'string' || !args.code.includes('setup')) return { ok: false, errors: ['code must be a whole sketch with setup() and loop()'] }
      ws.sketch = args.code
      ws.build = undefined
      ws.report = undefined
      return { ok: true, lines: args.code.split('\n').length, findings: findings(ws).map(brief) }
    }

    case 'write_test': {
      const { scenario, errors } = parseScenario(String(args?.yaml ?? ''))
      if (!scenario) return { ok: false, errors }
      const checks = scenario.steps.filter((s) => Object.keys(s).some((k) => k.startsWith('expect') || k.startsWith('wait'))).length
      if (checks < 2) return { ok: false, errors: ['the test needs at least two wait or expect steps that check what the user asked for'] }
      ws.test = args.yaml
      ws.report = undefined
      return { ok: true, steps: scenario.steps.length }
    }

    case 'compile': {
      if (!ws.sketch) return { ok: false, errors: ['write_sketch first'] }
      ws.build = await compile(boardOf(ws), { 'sketch.ino': ws.sketch })
      const b = ws.build
      const pico = boardOf(ws) === 'pico'
      return b.ok
        ? { ok: true, flash: pico ? `${b.flash} bytes` : `${b.flash} of 32256 bytes`, ram: pico ? `${b.ram} of 264 kb` : `${b.ram} of 2048 bytes before malloc`, warnings: b.diagnostics.filter((d) => d.severity === 'warning').slice(0, 5) }
        : { ok: false, errors: b.diagnostics.length ? b.diagnostics.slice(0, 8) : [b.log.slice(-1500)] }
    }

    case 'run_test': {
      if (!ws.diagram || !ws.sketch || !ws.test) return { ok: false, errors: [`missing: ${[!ws.diagram && 'circuit', !ws.sketch && 'sketch', !ws.test && 'test'].filter(Boolean).join(', ')}`] }
      if (!ws.build) ws.build = await compile(boardOf(ws), { 'sketch.ino': ws.sketch })
      if (!ws.build.ok) return { ok: false, compile_errors: ws.build.diagnostics.slice(0, 8) }
      const bench = new Bench(Circuit.parse(ws.diagram).circuit!, ws.build.hex ?? ws.build.uf2!, ws.build.symbols)
      const report = run(bench, parseScenario(ws.test).scenario!)
      ws.report = report
      if (report.ok) ws.passed = fingerprint(ws)
      return {
        ok: report.ok,
        steps: report.steps.map((s) => `${s.ok ? 'pass' : 'FAIL'} ${s.index} ${s.name ?? s.kind}: ${s.detail}`),
        ...(report.failed && { failed_step: report.failed.index, parts: report.failed.bench, serial: report.failed.serialTail }),
      }
    }

    case 'finish': {
      if (!ws.passed || ws.passed !== fingerprint(ws)) {
        return { ok: false, refused: 'the test has not passed on the current circuit and sketch. run_test until it passes, then finish' }
      }
      const errors = findings(ws).filter((f) => f.severity === 'error')
      if (errors.length) return { ok: false, refused: `wiring errors left: ${errors.map((e) => e.message).join('; ')}` }
      return { ok: true, done: true, summary: args?.summary }
    }
  }
  return { ok: false, errors: [`no tool ${name}`] }
}
