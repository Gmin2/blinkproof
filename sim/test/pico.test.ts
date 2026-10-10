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
