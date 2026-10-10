import { describe, expect, it } from 'vitest'
import { SSD1306, Uno } from '../src'
import { build } from './build'

const sketch = (draw: string) => `#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
Adafruit_SSD1306 display(128, 64, &Wire, -1);
void setup() {
  display.begin(SSD1306_SWITCHCAPVCC, 0x3C);
  display.clearDisplay();
  display.setTextColor(SSD1306_WHITE);
  ${draw}
  display.display();
}
void loop() {}
`

async function screen(draw: string) {
  const uno = new Uno(await build(sketch(draw)))
  const oled = uno.i2c.add(new SSD1306()) as SSD1306
  uno.run(300)
  return oled.text()
}

describe('reading the oled like a person would', () => {
  it('finds text off the 8 px rows and at any x', async () => {
    expect(await screen('display.setTextSize(2); display.setCursor(13, 20); display.print("STOP");')).toBe('STOP')
  })

  it('reads sizes 1 to 3 on one screen', async () => {
    const text = await screen(`
      display.setTextSize(1); display.setCursor(0, 0); display.print("149 cm");
      display.setTextSize(3); display.setCursor(4, 14); display.print("SLOW");
      display.setTextSize(1); display.setCursor(0, 50); display.print("dist ok");`)
    expect(text.split('\n')).toEqual(['149 cm', 'SLOW', 'dist ok'])
  })

  it('reads a line with only lowercase, and two pieces of text on one line', async () => {
    const text = await screen(`
      display.setTextSize(1); display.setCursor(3, 5); display.print("cm away");
      display.setCursor(0, 30); display.print("A0"); display.setCursor(77, 30); display.print("512");`)
    expect(text.split('\n')[0]).toBe('cm away')
    expect(text.split('\n')[1]).toMatch(/^A0 +512$/)
  })
})
