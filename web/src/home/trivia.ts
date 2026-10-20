import { grid, rotY, translate, type Mesh } from './turn/vec'
import baked from './parts.json'

// parts that turn on the early access page, one at a time, each with something true about it
export type Fact = { id: string; title: string; text: string }

export const FACTS: Fact[] = [
  { id: 'hc-sr04', title: 'HC-SR04 ultrasonic sensor', text: 'It measures distance by timing an echo. Sound covers about 343 metres a second, so 1 cm there and back is 58 microseconds.' },
  { id: 'arduino-nano', title: 'Arduino Nano', text: 'It fits a breadboard by design: two rows of pins, fifteen a side. D13 has the onboard led on it, which is why blink starts there.' },
  { id: 'oled', title: '0.96 inch OLED', text: '128 by 64 pixels on i2c address 0x3C. The frame buffer is 1 KB, half of an Uno\'s ram, which is a bug our agent has hit and fixed.' },
  { id: 'neopixel-ring', title: '16 pixel LED ring', text: 'Every pixel holds its colour until told otherwise, so one data pin drives the whole ring. Sixteen at full white pull close to an amp.' },
  { id: 'servo', title: 'SG90 servo', text: 'It wants a pulse every 20 milliseconds, and the width of the pulse is the angle. Stalled, it can pull over half an amp.' },
  { id: 'dht22', title: 'DHT22 temperature sensor', text: 'Give it two seconds between readings or it hands you the last one again. One data wire, a pullup, humidity to a tenth of a percent.' },
  { id: 'pi-pico', title: 'Raspberry Pi Pico', text: 'Two arm cores at 133 MHz for about four dollars. VSYS takes 1.8 to 5.5 volts, so two AA cells will run it.' },
  { id: 'lcd-16x2', title: '16x2 character LCD', text: '32 characters in two rows. The i2c backpack turns its sixteen pins into four, and clearing it every loop is what makes it flicker.' },
  { id: 'buzzer', title: 'Piezo buzzer', text: 'An active buzzer makes its own tone from dc. A passive one needs you to play the frequency with tone().' },
  { id: 'potentiometer', title: 'Potentiometer', text: 'A voltage divider with a knob. analogRead gives 0 to 1023 across its travel on an Uno.' },
  { id: 'led', title: 'LED', text: 'The longer leg is the anode, the flat edge of the rim marks the cathode. An led without a resistor is a very short experiment.' },
  { id: 'push-button', title: 'Tactile button', text: 'Four legs but only two circuits: the pairs are joined across the body. INPUT_PULLUP saves you the resistor.' },
]

// baked once from the part library, already fitted to about 3 units and resting on y = -1
const PARTS = baked as unknown as Record<string, Mesh[]>

export const FLOOR: Mesh = translate(grid(3.2, 2.2, 8, 6, 1), [0, -1.01, 0])

// the part turned about its own vertical axis
export const partMeshes = (id: string, yaw: number): Mesh[] => (PARTS[id] ?? []).map((m) => rotY(m, yaw))
