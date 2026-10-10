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
} satisfies Record<string, { pins: string[]; same?: string[][]; board?: boolean }>
