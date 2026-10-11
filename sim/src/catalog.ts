// the parts a circuit can use, with their pin names as @wokwi/elements 1.9.2 draws them.
// kept here too so node can check a circuit without a browser

export type PartType = keyof typeof PARTS

export const PARTS = {
  'wokwi-arduino-uno': {
    pins: ['A5.2', 'A4.2', 'AREF', 'GND.1', '13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0',
      'IOREF', 'RESET', '3.3V', '5V', 'GND.2', 'GND.3', 'VIN', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
    // pins that are one piece of copper on the board
    same: [['GND.1', 'GND.2', 'GND.3'], ['A4', 'A4.2'], ['A5', 'A5.2']],
    board: true,
  },
  'wokwi-arduino-nano': {
    pins: ['12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', 'GND.2', 'RESET.2', '0', '1', '13', '3.3V', 'AREF',
      'A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', '5V', 'RESET', 'GND.1', 'VIN', '12.2', '5V.2', '13.2', '11.2', 'RESET.3', 'GND.3'],
    // the icsp header repeats 11, 12, 13, 5V and GND
    same: [['GND.1', 'GND.2', 'GND.3'], ['5V', '5V.2'], ['11', '11.2'], ['12', '12.2'], ['13', '13.2'], ['RESET', 'RESET.2', 'RESET.3']],
    board: true,
  },
  // diagram type as wokwi names it, we draw it ourselves
  'wokwi-pi-pico': {
    pins: [...Array.from({ length: 23 }, (_, i) => `GP${i}`), 'GP26', 'GP27', 'GP28',
      ...Array.from({ length: 8 }, (_, i) => `GND.${i + 1}`), 'VBUS', 'VSYS', '3V3_EN', '3V3', 'ADC_VREF', 'RUN'],
    same: [Array.from({ length: 8 }, (_, i) => `GND.${i + 1}`)],
    board: true,
  },
  'wokwi-led': { pins: ['A', 'C'] },
  'wokwi-resistor': { pins: ['1', '2'] },
  'wokwi-pushbutton': { pins: ['1.l', '2.l', '1.r', '2.r'], same: [['1.l', '1.r'], ['2.l', '2.r']] },
  'wokwi-ssd1306': { pins: ['DATA', 'CLK', 'DC', 'RST', 'CS', '3V3', 'VIN', 'GND'] },
  'wokwi-potentiometer': { pins: ['GND', 'SIG', 'VCC'] },
  'wokwi-neopixel': { pins: ['VDD', 'DOUT', 'VSS', 'DIN'] },
  'wokwi-led-ring': { pins: ['GND', 'VCC', 'DIN', 'DOUT'] },
  'wokwi-servo': { pins: ['GND', 'V+', 'PWM'] },
  'wokwi-hc-sr04': { pins: ['VCC', 'TRIG', 'ECHO', 'GND'] },
  'wokwi-buzzer': { pins: ['1', '2'] },
  // the module: a photoresistor in a divider, and a comparator with its own trim pot for DO
  'wokwi-photoresistor-sensor': { pins: ['VCC', 'GND', 'DO', 'AO'] },
  'wokwi-dht22': { pins: ['VCC', 'SDA', 'NC', 'GND'] },
  'wokwi-pir-motion-sensor': { pins: ['VCC', 'OUT', 'GND'] },
  // common cathode unless attrs say common: anode
  'wokwi-rgb-led': { pins: ['R', 'COM', 'G', 'B'] },
  // value 0 joins 2 to 1, value 1 joins 2 to 3
  'wokwi-slide-switch': { pins: ['1', '2', '3'] },
  // one digit, its two common pins are one piece of metal
  'wokwi-7segment': { pins: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'DP', 'COM.1', 'COM.2'], same: [['COM.1', 'COM.2']] },
  // the i2c backpack version, drawn with pins="i2c"
  'wokwi-lcd1602': { pins: ['GND', 'VCC', 'SDA', 'SCL'] },
} satisfies Record<string, { pins: string[]; same?: string[][]; board?: boolean }>
