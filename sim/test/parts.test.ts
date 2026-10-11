import { describe, expect, it } from 'vitest'
import { Bench, Circuit, type PartState } from '../src'
import { build, source } from './build'

type Part = { id: string; type: string; attrs?: Record<string, string> }

// an uno with the given parts and wires
function bench(parts: Part[], connections: string[][], hex: string) {
  const { circuit, errors } = Circuit.parse({
    version: 1,
    parts: [{ id: 'uno', type: 'wokwi-arduino-uno' }, ...parts],
    connections: connections.map(([a, b]) => [a, b, 'green', []]),
  })
  if (!circuit) throw new Error(errors.join('\n'))
  return new Bench(circuit, hex)
}

type Of<T> = PartState extends infer S ? (S extends { type: infer U } ? (T extends U ? S : never) : never) : never
const get = <T extends PartState['type']>(b: Bench, id: string) => b.parts[id] as Of<T>
const cm = (serial: string) => serial.trim().split('\n').map((l) => Number(l.replace('cm ', '')))

describe('neopixel ring', () => {
  const ring = { id: 'ring1', type: 'wokwi-led-ring', attrs: { pixels: '16' } }
  const wires = [['ring1:DIN', 'uno:6'], ['ring1:VCC', 'uno:5V'], ['ring1:GND', 'uno:GND.1']]

  it('decodes what Adafruit_NeoPixel sends, green red blue order', async () => {
    const b = bench([ring], wires, await build(source('parts-ring')))
    b.run(50)
    const strip = get<'wokwi-led-ring'>(b, 'ring1').strip!
    expect(b.board.serial).toContain('shown')
    expect(strip.frames).toBe(1)
    expect(strip.bad).toBe(0)
    expect(strip.pixels[0]).toEqual([255, 0, 0])
    expect(strip.pixels[1]).toEqual([0, 255, 0])
    expect(strip.pixels[15]).toEqual([0, 0, 255])
    expect(strip.pixels[7]).toEqual([18, 52, 86])
    expect(strip.pixels[3]).toEqual([0, 0, 0])
  })

  it('stays dark when the sketch forgets begin(), the pin never becomes an output', async () => {
    const b = bench([ring], wires, await build(source('parts-ring').replace('ring.begin();', '')))
    b.run(50)
    expect(b.board.serial).toContain('shown')
    expect(get<'wokwi-led-ring'>(b, 'ring1').strip!.frames).toBe(0)
  })

  it('stays dark on the wrong pin or with no power', async () => {
    const hex = await build(source('parts-ring'))
    const moved = bench([ring], [['ring1:DIN', 'uno:5'], ...wires.slice(1)], hex)
    moved.run(50)
    expect(get<'wokwi-led-ring'>(moved, 'ring1').strip!.frames).toBe(0)
    const unpowered = bench([ring], [wires[0], wires[2]], hex)
    expect(get<'wokwi-led-ring'>(unpowered, 'ring1').strip).toBeNull()
  })
})

describe('servo', () => {
  it('follows Servo.write: 0, 90, 180 degrees', async () => {
    const b = bench([{ id: 's1', type: 'wokwi-servo' }], [['s1:PWM', 'uno:9'], ['s1:V+', 'uno:5V'], ['s1:GND', 'uno:GND.1']], await build(source('parts-servo')))
    const servo = get<'wokwi-servo'>(b, 's1').servo!
    b.run(300)
    expect(servo.angle).toBe(0)
    b.run(500)
    expect(servo.angle).toBe(90)
    // the library sends 1470 us for 90
    expect(servo.width).toBeCloseTo(1470, -1)
    b.run(500)
    expect(servo.angle).toBe(180)
    // a pulse every 20 ms
    expect(servo.pulses).toBeGreaterThan(50)
  })
})

describe('hc-sr04', () => {
  const wires = [['sonar:TRIG', 'uno:9'], ['sonar:ECHO', 'uno:10'], ['sonar:VCC', 'uno:5V'], ['sonar:GND', 'uno:GND.1']]

  it('answers pulseIn with 58 us per cm', async () => {
    const b = bench([{ id: 'sonar', type: 'wokwi-hc-sr04', attrs: { distance: '100' } }], wires, await build(source('parts-sonar')))
    b.run(200)
    // pulseIn counts loop passes and reads a hair short, 5800 us comes back as 99 cm like on a real board
    for (const d of cm(b.board.serial)) expect(d).toBeGreaterThanOrEqual(99), expect(d).toBeLessThanOrEqual(100)
    b.control('sonar', 'distance', 12)
    const from = b.board.serial.length
    b.run(200)
    expect(cm(b.board.serial.slice(from)).at(-1)).toBeOneOf([11, 12])
  })

  it('gives nothing on 3.3 v, pulseIn times out and the sketch prints 0', async () => {
    const b = bench([{ id: 'sonar', type: 'wokwi-hc-sr04', attrs: { distance: '100' } }], [...wires.slice(0, 2), ['sonar:VCC', 'uno:3.3V'], wires[3]], await build(source('parts-sonar')))
    b.run(300)
    expect(get<'wokwi-hc-sr04'>(b, 'sonar').sensor).toBeNull()
    expect(b.board.serial).toContain('cm 0')
    expect(b.board.serial).not.toContain('cm 99')
  })

  it('ignores a trigger shorter than 10 us', async () => {
    const b = bench([{ id: 'sonar', type: 'wokwi-hc-sr04', attrs: { distance: '100' } }], wires, await build(source('parts-sonar').replace('delayMicroseconds(10)', 'delayMicroseconds(3)')))
    b.run(300)
    const sensor = get<'wokwi-hc-sr04'>(b, 'sonar').sensor!
    expect(sensor.pings).toBe(0)
    expect(sensor.short).toBeGreaterThan(0)
  })
})

describe('buzzer', () => {
  it('hears tone(440) then tone(1000), and silence after noTone', async () => {
    const b = bench([{ id: 'bz', type: 'wokwi-buzzer' }], [['bz:2', 'uno:8'], ['bz:1', 'uno:GND.1']], await build(source('parts-buzzer')))
    const buzzer = get<'wokwi-buzzer'>(b, 'bz').buzzer!
    b.run(100)
    expect(buzzer.hz).toBeCloseTo(440, 0)
    b.run(500)
    expect(buzzer.hz).toBeCloseTo(1000, -1)
    b.run(300)
    expect(buzzer.hz).toBe(0)
    const notes = buzzer.notes.map((n) => [Math.round(n.hz), Math.round(n.ms / 10) * 10])
    expect(notes).toEqual([[440, 300], [1000, 200]])
  })
})

describe('pushbutton', () => {
  const wires = [['btn:1.l', 'uno:2'], ['btn:2.l', 'uno:GND.1']]

  it('counts each press once with INPUT_PULLUP and a debounce, bounce and all', async () => {
    const b = bench([{ id: 'btn', type: 'wokwi-pushbutton' }], wires, await build(source('parts-button')))
    b.run(50)
    for (let i = 0; i < 3; i++) {
      b.control('btn', 'pressed', 1)
      b.run(100)
      b.control('btn', 'pressed', 0)
      b.run(100)
    }
    expect(b.board.serial.trim().split('\n').pop()).toBe('presses 3')
  })

  it('reads noise when the pin floats with plain INPUT', async () => {
    const b = bench([{ id: 'btn', type: 'wokwi-pushbutton' }], wires, await build(source('parts-button').replace('INPUT_PULLUP', 'INPUT')))
    b.run(2000)
    // nobody pressed it, but a floating pin counts presses anyway
    expect(b.board.serial).toMatch(/presses \d+/)
  })

  it('a button to 5v with a pull-down resistor works too', async () => {
    const b = bench(
      [{ id: 'btn', type: 'wokwi-pushbutton' }, { id: 'r1', type: 'wokwi-resistor', attrs: { value: '10000' } }],
      [['btn:1.l', 'uno:2'], ['btn:2.l', 'uno:5V'], ['r1:1', 'uno:2'], ['r1:2', 'uno:GND.1']],
      await build(source('parts-button').replace('INPUT_PULLUP', 'INPUT').replace('now == LOW', 'now == HIGH').replace('bool last = HIGH', 'bool last = LOW')),
    )
    b.run(50)
    b.control('btn', 'pressed', 1)
    b.run(100)
    b.control('btn', 'pressed', 0)
    b.run(100)
    expect(b.board.serial.trim()).toBe('presses 1')
  })
})

describe('light sensor', () => {
  const ldr = { id: 'ldr1', type: 'wokwi-photoresistor-sensor' }
  const wires = [['ldr1:VCC', 'uno:5V'], ['ldr1:GND', 'uno:GND.1'], ['ldr1:AO', 'uno:A0'], ['ldr1:DO', 'uno:2']]
  const sketch = `void setup() { Serial.begin(9600); pinMode(2, INPUT); }
void loop() { Serial.print(analogRead(A0)); Serial.print(' '); Serial.println(digitalRead(2)); delay(50); }`
  const last = (b: Bench) => b.board.serial.trim().split('\n').at(-1)!.split(' ').map(Number)

  it('reads lower on AO the brighter it is, and DO goes high in the dark', async () => {
    const b = bench([ldr], wires, await build(sketch))
    b.run(120)
    const [bright, brightDo] = last(b)
    b.control('ldr1', 'lux', 1)
    b.run(120)
    const [dark, darkDo] = last(b)
    expect(bright).toBeLessThan(300)
    expect(brightDo).toBe(0)
    expect(dark).toBeGreaterThan(900)
    expect(darkDo).toBe(1)
    expect(get<'wokwi-photoresistor-sensor'>(b, 'ldr1')).toMatchObject({ lux: 1, dark: true })
  })

  it('reads nothing without power', async () => {
    const b = bench([ldr], wires.slice(1), await build(sketch))
    b.run(120)
    expect(last(b)[0]).toBeLessThan(50)
    expect(b.describe()).toContain('ldr1: not powered')
  })
})

describe('dht22', () => {
  const dht = { id: 'dht1', type: 'wokwi-dht22', attrs: { temperature: '21.5', humidity: '55' } }
  const wires = [['dht1:VCC', 'uno:5V'], ['dht1:GND', 'uno:GND.1'], ['dht1:SDA', 'uno:2']]
  const sketch = `#include <DHT.h>
DHT dht(2, DHT22);
void setup() { Serial.begin(9600); dht.begin(); }
void loop() {
  delay(2100);
  float t = dht.readTemperature(), h = dht.readHumidity();
  if (isnan(t) || isnan(h)) Serial.println("fail");
  else { Serial.print(t, 1); Serial.print(' '); Serial.println(h, 1); }
}`
  const lines = (b: Bench) => b.board.serial.trim().split('\n')

  it('answers the adafruit library with the temperature and humidity it is set to', async () => {
    const b = bench([dht], wires, await build(sketch))
    b.run(2300)
    expect(lines(b).at(-1)).toBe('21.5 55.0')
    expect(get<'wokwi-dht22'>(b, 'dht1').sensor!.short).toBe(0)
  })

  it('follows a change, below zero too', async () => {
    const b = bench([dht], wires, await build(sketch))
    b.run(2300)
    b.control('dht1', 'temperature', -7.3)
    b.control('dht1', 'humidity', 81)
    b.run(2200)
    expect(lines(b).at(-1)).toBe('-7.3 81.0')
  })

  it('reads as a failure when it has no power', async () => {
    const b = bench([dht], wires.slice(1), await build(sketch))
    b.run(2300)
    expect(lines(b).at(-1)).toBe('fail')
  })
})

describe('pir motion sensor', () => {
  const pir = { id: 'pir1', type: 'wokwi-pir-motion-sensor', attrs: { delayTime: '2' } }
  const wires = [['pir1:VCC', 'uno:5V'], ['pir1:GND', 'uno:GND.1'], ['pir1:OUT', 'uno:3']]
  const sketch = `void setup() { Serial.begin(9600); pinMode(3, INPUT); }
void loop() { Serial.println(digitalRead(3)); delay(100); }`
  const last = (b: Bench) => b.board.serial.trim().split('\n').at(-1)

  it('goes high on motion and holds for its delay after it stops', async () => {
    const b = bench([pir], wires, await build(sketch))
    b.run(300)
    expect(last(b)).toBe('0')
    b.control('pir1', 'motion', 1)
    b.run(300)
    expect(last(b)).toBe('1')
    b.control('pir1', 'motion', 0)
    b.run(1500)
    expect(last(b)).toBe('1')
    b.run(800)
    expect(last(b)).toBe('0')
    expect(get<'wokwi-pir-motion-sensor'>(b, 'pir1').triggers).toBe(1)
  })

  it('moving again inside the hold keeps it high', async () => {
    const b = bench([pir], wires, await build(sketch))
    b.control('pir1', 'motion', 1)
    b.run(200)
    b.control('pir1', 'motion', 0)
    b.run(1500)
    b.control('pir1', 'motion', 1)
    b.run(200)
    b.control('pir1', 'motion', 0)
    b.run(1500)
    expect(last(b)).toBe('1')
    b.run(800)
    expect(last(b)).toBe('0')
  })
})
