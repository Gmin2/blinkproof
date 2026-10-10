import { describe, expect, it } from 'vitest'
import { SSD1306, Uno } from '../src'
import { hex } from './build'

describe('uno', async () => {
  it('blinks d13 every 500ms and prints on serial', async () => {
    const uno = new Uno(await hex('blink'))
    uno.run(2100)
    // the first change is pinMode making it an output
    const d13 = uno.timeline.filter((e) => e.pin === 'D13').slice(1)
    expect(d13.length).toBeGreaterThanOrEqual(4)
    const gaps = d13.slice(1).map((e, i) => e.ms - d13[i].ms)
    for (const g of gaps) expect(g).toBeCloseTo(500, -1)
    expect(uno.serial).toContain('blink ready')
  })

  it('draws on the oled and reads the pot', async () => {
    const uno = new Uno(await hex('hello-oled'))
    const oled = uno.i2c.add(new SSD1306()) as SSD1306
    uno.setVolts('A0', 2.5)
    uno.run(400)
    expect(uno.serial).toContain('oled ok')
    const text = oled.text()
    expect(text).toContain('blinkproof')
    expect(text).toContain('hello from the sim')
    expect(text).toMatch(/A0 = 51\d/)

    uno.setVolts('A0', 5)
    uno.run(300)
    expect(oled.text()).toContain('A0 = 1023')
  })

  // the adafruit library never checks for an ack, so a wrong address still prints ok
  // and the screen just stays black. the same happens on a real board
  it('shows nothing when the oled sits on another address', async () => {
    const uno = new Uno(await hex('hello-oled'))
    const oled = uno.i2c.add(new SSD1306(0x3d)) as SSD1306
    uno.run(300)
    expect(uno.serial).toContain('oled ok')
    expect(oled.on).toBe(false)
    expect(oled.text()).toBe('')
  })
})
