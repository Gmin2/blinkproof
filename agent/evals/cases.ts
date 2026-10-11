// the eval set: a request in plain words and a hidden test the agent never sees.
// tests name parts by kind, $led, $button, $oled, and the resolver maps them onto whatever ids
// the agent picked. $led:red is the red one, $led.2 the second. a case passes only when the agent
// finished (its own test passed, no wiring errors) and the hidden test passes on what it handed over.

export type Case = {
  id: string
  board: 'uno' | 'nano' | 'pico'
  request: string
  // what makes it hard, for reading the results
  trap?: string
  hidden: string
}

const test = (name: string, steps: string) => `name: ${name}\nversion: 1\nsteps:\n${steps.trim().replace(/^/gm, '  ')}\n`

export const CASES: Case[] = [
  {
    id: 'blink',
    board: 'uno',
    request: 'an arduino uno with one led that blinks once a second: half a second on, half a second off',
    hidden: test('blinks at 1 hz', `
- wait-led: { part-id: $led, lit: true, timeout: 3s }
- delay: 100ms
- expect-led: { part-id: $led, lit: true }
- delay: 500ms
- expect-led: { part-id: $led, lit: false }
- wait-led: { part-id: $led, lit: true, timeout: 700ms }`),
  },
  {
    id: 'night-light',
    board: 'uno',
    request: 'a night light on an arduino uno: an led that is on while you hold a button down and off when you let go',
    hidden: test('lit only while held', `
- delay: 500ms
- expect-led: { part-id: $led, lit: false }
- set-control: { part-id: $button, control: pressed, value: 1 }
- delay: 150ms
- expect-led: { part-id: $led, lit: true }
- set-control: { part-id: $button, control: pressed, value: 0 }
- delay: 150ms
- expect-led: { part-id: $led, lit: false }`),
  },
  {
    id: 'always-on',
    board: 'uno',
    request: 'an arduino uno that keeps one led on all the time',
    trap: 'the shortest answer wires the led straight to a pin with no resistor',
    hidden: test('stays lit', `
- delay: 500ms
- expect-led: { part-id: $led, lit: true }
- delay: 2s
- expect-led: { part-id: $led, lit: true }`),
  },
  {
    id: 'dimmer',
    board: 'uno',
    request: 'an arduino uno where a potentiometer sets how bright an led is: knob all the way down is off, all the way up is full brightness',
    trap: 'needs a pwm pin, and the map from 1023 to 255',
    hidden: test('the knob sets the brightness', `
- set-control: { part-id: $pot, control: position, value: 0 }
- delay: 400ms
- expect-led: { part-id: $led, max-brightness: 0.05 }
- set-control: { part-id: $pot, control: position, value: 1 }
- delay: 400ms
- expect-led: { part-id: $led, min-brightness: 0.9 }
- set-control: { part-id: $pot, control: position, value: 0.5 }
- delay: 400ms
- expect-led: { part-id: $led, min-brightness: 0.3, max-brightness: 0.7 }`),
  },
  {
    id: 'press-counter',
    board: 'uno',
    request: 'an arduino uno with a button and a 128x64 oled: every press adds one to a counter, and the screen shows it as "count: N", starting at count: 0',
    trap: 'the button bounces, a counter that is not debounced jumps by more than one',
    hidden: test('counts each press once', `
- delay: 1s
- expect-text: { part-id: $oled, contains: "count: 0" }
- set-control: { part-id: $button, control: pressed, value: 1 }
- delay: 150ms
- set-control: { part-id: $button, control: pressed, value: 0 }
- delay: 300ms
- set-control: { part-id: $button, control: pressed, value: 1 }
- delay: 150ms
- set-control: { part-id: $button, control: pressed, value: 0 }
- delay: 300ms
- expect-text: { part-id: $oled, contains: "count: 2" }`),
  },
  {
    id: 'servo-knob',
    board: 'uno',
    request: 'an arduino uno where turning a potentiometer turns a servo: knob at the bottom is 0 degrees, at the top 180 degrees',
    hidden: test('the servo follows the knob', `
- set-control: { part-id: $pot, control: position, value: 0 }
- delay: 600ms
- expect-servo: { part-id: $servo, angle: 0, tolerance: 6 }
- set-control: { part-id: $pot, control: position, value: 1 }
- delay: 600ms
- expect-servo: { part-id: $servo, angle: 180, tolerance: 6 }
- set-control: { part-id: $pot, control: position, value: 0.5 }
- delay: 600ms
- expect-servo: { part-id: $servo, angle: 90, tolerance: 10 }`),
  },
  {
    id: 'proximity-alarm',
    board: 'uno',
    request: 'an arduino uno with an ultrasonic distance sensor and a buzzer: the buzzer plays a 1000 hz tone while something is closer than 20 cm, and is silent otherwise',
    hidden: test('beeps only when close', `
- set-control: { part-id: $sonar, control: distance, value: 100 }
- delay: 800ms
- expect-tone: { part-id: $buzzer, silent: true, within: 400ms }
- set-control: { part-id: $sonar, control: distance, value: 10 }
- delay: 800ms
- expect-tone: { part-id: $buzzer, hz: 1000, within: 500ms }
- set-control: { part-id: $sonar, control: distance, value: 100 }
- delay: 800ms
- expect-tone: { part-id: $buzzer, silent: true, within: 400ms }`),
  },
  {
    id: 'traffic-light',
    board: 'uno',
    request: 'a traffic light on an arduino uno with a red, a yellow and a green led: green for 3 seconds, then yellow for 1 second, then red for 3 seconds, and round again. only one led is on at a time',
    hidden: test('green, yellow, red', `
- wait-led: { part-id: "$led:green", lit: true, timeout: 9s }
- delay: 200ms
- expect-led: { part-id: "$led:green", lit: true }
- expect-led: { part-id: "$led:yellow", lit: false }
- expect-led: { part-id: "$led:red", lit: false }
- delay: 3000ms
- expect-led: { part-id: "$led:yellow", lit: true }
- expect-led: { part-id: "$led:green", lit: false }
- delay: 1000ms
- expect-led: { part-id: "$led:red", lit: true }
- expect-led: { part-id: "$led:yellow", lit: false }`),
  },
  {
    id: 'knob-ring',
    board: 'uno',
    request: 'an arduino uno with a potentiometer and a 16 led neopixel ring: the number of lit leds follows the knob, none at the bottom and all 16 at the top',
    trap: 'a 16 pixel ring at full white is close to a amp, brightness has to come down',
    hidden: test('the ring follows the knob', `
- set-control: { part-id: $pot, control: position, value: 0 }
- delay: 500ms
- expect-pixels: { part-id: $ring, lit: 0 }
- set-control: { part-id: $pot, control: position, value: 1 }
- delay: 500ms
- expect-pixels: { part-id: $ring, lit: 16 }
- set-control: { part-id: $pot, control: position, value: 0.5 }
- delay: 500ms
- expect-pixels: { part-id: $ring, min-lit: 7, max-lit: 9 }`),
  },
  {
    id: 'nano-toggle',
    board: 'nano',
    request: 'on an arduino nano: a button that toggles an led, one press turns it on, the next press turns it off',
    trap: 'debounce, and a toggle on the press edge, not while held',
    hidden: test('each press flips the led', `
- delay: 500ms
- expect-led: { part-id: $led, lit: false }
- set-control: { part-id: $button, control: pressed, value: 1 }
- delay: 200ms
- set-control: { part-id: $button, control: pressed, value: 0 }
- delay: 300ms
- expect-led: { part-id: $led, lit: true }
- set-control: { part-id: $button, control: pressed, value: 1 }
- delay: 200ms
- set-control: { part-id: $button, control: pressed, value: 0 }
- delay: 300ms
- expect-led: { part-id: $led, lit: false }`),
  },
  {
    id: 'nano-pot-serial',
    board: 'nano',
    request: 'on an arduino nano: read a potentiometer and print its raw value, 0 to 1023, on its own line on serial at 9600 baud, about ten times a second',
    hidden: test('prints the knob', `
- set-control: { part-id: $pot, control: position, value: 1 }
- wait-serial: "1023"
- set-control: { part-id: $pot, control: position, value: 0.5 }
- wait-serial: "512"`),
  },
  {
    id: 'nano-near-far',
    board: 'nano',
    request: 'on an arduino nano: an ultrasonic sensor and a 128x64 oled that says NEAR when something is closer than 30 cm and FAR when it is not',
    hidden: test('near and far', `
- set-control: { part-id: $sonar, control: distance, value: 150 }
- delay: 1s
- expect-text: { part-id: $oled, contains: FAR, not-contains: NEAR }
- set-control: { part-id: $sonar, control: distance, value: 10 }
- wait-text: { part-id: $oled, contains: NEAR, timeout: 1500ms }
- expect-text: { part-id: $oled, not-contains: FAR }`),
  },
  {
    id: 'pico-plant',
    board: 'pico',
    request: 'a plant monitor on a raspberry pi pico: a soil moisture sensor (use a potentiometer for it) and a 128x64 oled that shows WATER ME when the moisture is under 30%',
    trap: '3.3 V logic, the adc reads 0 to 1023 in arduino-pico, the oled has to be on GP4 and GP5',
    hidden: test('asks for water when dry', `
- set-control: { part-id: $pot, control: position, value: 0.8 }
- delay: 1500ms
- expect-text: { part-id: $oled, not-contains: WATER ME }
- set-control: { part-id: $pot, control: position, value: 0.1 }
- wait-text: { part-id: $oled, contains: WATER ME, timeout: 2s }`),
  },
  {
    id: 'pico-ring-colour',
    board: 'pico',
    request: 'on a raspberry pi pico: a potentiometer and a 16 led neopixel ring, the whole ring is red with the knob at the bottom and blue with it at the top',
    trap: 'the ring needs 5 V while the pico drives 3.3 V data',
    hidden: test('red to blue', `
- set-control: { part-id: $pot, control: position, value: 0 }
- delay: 1500ms
- expect-pixels: { part-id: $ring, lit: 16, color: red }
- set-control: { part-id: $pot, control: position, value: 1 }
- delay: 800ms
- expect-pixels: { part-id: $ring, lit: 16, color: blue }`),
  },
  {
    id: 'pico-sonar-led',
    board: 'pico',
    request: 'on a raspberry pi pico: an ultrasonic sensor turns an led on when something is closer than 15 cm, off otherwise',
    trap: 'the hc-sr04 echo pin is 5 V, the pico pins take 3.3 V, it needs a divider',
    hidden: test('lit when close', `
- set-control: { part-id: $sonar, control: distance, value: 80 }
- delay: 1500ms
- expect-led: { part-id: $led, lit: false }
- set-control: { part-id: $sonar, control: distance, value: 5 }
- delay: 800ms
- expect-led: { part-id: $led, lit: true }`),
  },
  {
    id: 'dark-light',
    board: 'uno',
    request: 'a night light on an arduino uno that turns an led on when the room gets dark and off again when it is bright',
    trap: 'more light is a lower reading on AO, the easy mistake is the comparison the wrong way round',
    hidden: test('on in the dark only', `
- set-control: { part-id: $light, control: lux, value: 800 }
- delay: 500ms
- expect-led: { part-id: $led, lit: false }
- set-control: { part-id: $light, control: lux, value: 2 }
- wait-led: { part-id: $led, lit: true, timeout: 1s }
- set-control: { part-id: $light, control: lux, value: 800 }
- wait-led: { part-id: $led, lit: false, timeout: 1s }`),
  },
  {
    id: 'too-hot',
    board: 'uno',
    request: 'a too hot warning on an arduino uno: a dht22 measures the room, a red led lights when it is over 30 C and goes out again below, and it prints the temperature to serial',
    trap: 'the dht22 only answers every 2 seconds, polling it faster reads NAN',
    hidden: test('red over 30 only', `
- set-control: { part-id: $dht, control: temperature, value: 22 }
- delay: 3s
- expect-led: { part-id: $led, lit: false }
- set-control: { part-id: $dht, control: temperature, value: 34 }
- wait-led: { part-id: $led, lit: true, timeout: 5s }
- set-control: { part-id: $dht, control: temperature, value: 25 }
- wait-led: { part-id: $led, lit: false, timeout: 5s }`),
  },
  {
    id: 'hall-light',
    board: 'uno',
    request: 'a hallway light on an arduino uno: a pir motion sensor turns an led on when someone walks by, and the led goes off again once nobody has moved for a while',
    trap: 'the pir holds OUT high for its own delay, the light has to follow OUT and not stay on forever',
    hidden: test('follows the motion', `
- delay: 500ms
- expect-led: { part-id: $led, lit: false }
- set-control: { part-id: $pir, control: motion, value: 1 }
- wait-led: { part-id: $led, lit: true, timeout: 1s }
- set-control: { part-id: $pir, control: motion, value: 0 }
- wait-led: { part-id: $led, lit: false, timeout: 20s }`),
  },
  {
    id: 'lcd-thermometer',
    board: 'uno',
    request: 'a desk thermometer on an arduino uno: a dht22 reads the room and a 16x2 i2c lcd shows the temperature in C on the first row and the humidity on the second',
    trap: 'two libraries, the lcd needs a second to start, the dht only every two seconds, and old digits linger unless the row is cleared or padded',
    hidden: test('shows what the sensor reads', `
- set-control: { part-id: $dht, control: temperature, value: 23.5 }
- set-control: { part-id: $dht, control: humidity, value: 61 }
- wait-text: { part-id: $lcd, contains: "23.5", timeout: 8s }
- wait-text: { part-id: $lcd, contains: "61", timeout: 4s }
- set-control: { part-id: $dht, control: temperature, value: 8.2 }
- wait-text: { part-id: $lcd, contains: "8.2", timeout: 6s }
- expect-text: { part-id: $lcd, not-contains: "23.5" }`),
  },
]

const KINDS: Record<string, string> = {
  led: 'wokwi-led',
  button: 'wokwi-pushbutton',
  pot: 'wokwi-potentiometer',
  oled: 'wokwi-ssd1306',
  ring: 'wokwi-led-ring',
  pixel: 'wokwi-neopixel',
  servo: 'wokwi-servo',
  sonar: 'wokwi-hc-sr04',
  buzzer: 'wokwi-buzzer',
  light: 'wokwi-photoresistor-sensor',
  dht: 'wokwi-dht22',
  pir: 'wokwi-pir-motion-sensor',
  lcd: 'wokwi-lcd1602',
}

// $led, $led.2, $led:red -> the id of that part in the agent's circuit
export function resolve(hidden: string, diagram: { parts: { id: string; type: string; attrs?: Record<string, string> }[] }) {
  const missing: string[] = []
  const yaml = hidden.replace(/\$([a-z]+)(?::([a-z]+))?(?:\.(\d+))?/g, (all, kind: string, color?: string, nth?: string) => {
    const type = KINDS[kind]
    // a led ring can stand in for neopixels and the other way round
    const types = kind === 'ring' || kind === 'pixel' ? [KINDS.ring, KINDS.pixel] : [type]
    const found = diagram.parts.filter((p) => types.includes(p.type) && (!color || (p.attrs?.color ?? 'red') === color))
    const part = found[Number(nth ?? 1) - 1]
    if (!part) {
      missing.push(all)
      return `missing-${kind}${color ? '-' + color : ''}`
    }
    return part.id
  })
  return { yaml, missing }
}
