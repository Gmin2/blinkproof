// what you would want to know about a part before you buy it and wire it: what it runs on, what it draws,
// what level its signals swing to, and the one thing that catches people out. from the modules' datasheets
export type Facts = {
  what: string
  supply?: string
  draws?: string
  signal?: string
  // on a 3.3 V board like the pico
  pico: 'fine' | 'careful' | 'no'
  note?: string
}

export const FACTS: Record<string, Facts> = {
  'wokwi-arduino-uno': { what: 'ATmega328P board, the usual first Arduino', supply: '5 V from usb, or 7 to 12 V on VIN', draws: '50 mA itself, 500 mA for everything on usb', signal: '5 V pins, 20 mA each, 200 mA all together', pico: 'fine' },
  'wokwi-arduino-nano': { what: 'the Uno\'s chip on a board that fits a breadboard', supply: '5 V from usb', draws: 'about 20 mA itself', signal: '5 V pins, A6 and A7 are analog input only', pico: 'fine' },
  'wokwi-pi-pico': { what: 'RP2040, two cores at 133 MHz, 264 kb of ram', supply: '5 V from usb, 3.3 V out on 3V3', draws: 'about 25 mA', signal: '3.3 V pins, not 5 V tolerant, 3.8 V at most', pico: 'fine', note: 'analog only on GP26, GP27 and GP28' },
  'wokwi-led': { what: '5 mm led', draws: '20 mA at most, 10 mA is plenty', signal: 'red drops about 1.9 V, blue and white about 3.3 V', pico: 'fine', note: 'always through a resistor, 220 ohm on 5 V' },
  'wokwi-resistor': { what: 'quarter watt resistor, 5%', pico: 'fine', note: 'read it by its colour bands' },
  'wokwi-pushbutton': { what: '6 mm tactile button', pico: 'fine', note: 'its contacts bounce for a few ms, debounce in code' },
  'wokwi-slide-switch': { what: 'spdt slide switch, the middle pin meets one end or the other', pico: 'fine' },
  'wokwi-potentiometer': { what: '10 kΩ knob', draws: 'under 1 mA', signal: 'any voltage between GND and its VCC', pico: 'fine', note: 'on a pico give it 3V3, not 5 V' },
  'wokwi-hc-sr04': { what: 'ultrasonic distance sensor, 2 to 400 cm', supply: '5 V only', draws: '15 mA', signal: 'ECHO swings to 5 V', pico: 'careful', note: 'on a pico ECHO needs a divider, 1k and 2k' },
  'wokwi-photoresistor-sensor': { what: 'light sensor module, an ldr with a comparator', supply: '3.3 to 5 V', draws: 'about 5 mA', signal: 'AO falls as the light rises, DO goes high in the dark', pico: 'fine' },
  'wokwi-dht22': { what: 'temperature and humidity, -40 to 80 °C, 0 to 100%', supply: '3.3 to 6 V', draws: '1.5 mA while it measures', signal: 'one wire, at the level of its supply', pico: 'fine', note: 'answers every 2 seconds at most' },
  'wokwi-pir-motion-sensor': { what: 'hc-sr501 pir motion sensor', supply: '4.5 to 20 V', draws: 'under 0.1 mA', signal: 'OUT is 3.3 V high', pico: 'fine', note: 'its own pots set the hold time and range, it needs a minute to settle' },
  'wokwi-ssd1306': { what: '0.96 inch 128x64 oled over i2c', supply: '3.3 or 5 V', draws: '20 mA, more the more pixels are lit', signal: 'i2c pulled up to its supply', pico: 'careful', note: 'needs 1 kb of ram for its buffer, half an uno\'s' },
  'wokwi-lcd1602': { what: '16x2 character lcd with an i2c backpack', supply: '5 V', draws: '30 mA, mostly the backlight', signal: 'i2c pulled up to 5 V', pico: 'careful', note: 'on a pico the backpack pulls SDA and SCL to 5 V, use a level shifter. turn the contrast pot on the back if it shows blocks' },
  'wokwi-buzzer': { what: 'passive buzzer, plays the tone you give it', supply: '3 to 5 V', draws: '30 mA', signal: 'driven by tone()', pico: 'fine', note: 'loudest around 2 to 4 kHz' },
  'wokwi-servo': { what: 'sg90 micro servo, 0 to 180°', supply: '4.8 to 6 V', draws: 'up to 360 mA when it moves', signal: '50 Hz pulse, 1 to 2 ms', pico: 'careful', note: 'more than one wants its own 5 V supply, not the board' },
  'wokwi-led-ring': { what: 'ring of ws2812 leds', supply: '5 V', draws: 'up to 60 mA a pixel at full white', signal: 'one data pin', pico: 'careful', note: 'a 300 to 500 ohm resistor on DIN, keep the brightness down on usb' },
  'wokwi-neopixel': { what: 'one ws2812 pixel', supply: '5 V', draws: 'up to 60 mA', signal: 'one data pin', pico: 'careful' },
  'wokwi-rgb-led': { what: 'rgb led, three leds in one', draws: '20 mA a colour', signal: 'red drops 2 V, green and blue about 3.2 V', pico: 'fine', note: 'a resistor on each colour, pwm pins to mix' },
  'wokwi-7segment': { what: 'one digit seven segment display', draws: '20 mA a segment at most', signal: 'segments drop about 2 V', pico: 'fine', note: 'seven pins for one digit, a 74hc595 saves pins for more' },
}
