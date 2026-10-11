import type { DiagramPart } from './circuit'

// where to buy each part: a store page for that exact part, then a robu.in search for buying in india.
// every store link was opened and its page title matched to the part (2026-10-12). where no store sells the
// exact part, only the search is given rather than a near match
export type Link = { name: string; url: string }

const adafruit = (id: number): Link => ({ name: `adafruit ${id}`, url: `https://www.adafruit.com/product/${id}` })
const robu = (query: string): Link => ({ name: 'robu.in', url: `https://robu.in/?s=${encodeURIComponent(query).replace(/%20/g, '+')}&post_type=product` })

const LED: Record<string, number> = { red: 299, green: 298, yellow: 2700, white: 754 }
const RING: Record<string, number> = { '12': 1643, '16': 1463, '24': 1586 }

export function shop(type: string, attrs: Record<string, string> = {}): Link[] {
  switch (type) {
    case 'wokwi-arduino-uno':
      return [{ name: 'arduino store', url: 'https://store.arduino.cc/products/arduino-uno-rev3' }, robu('arduino uno r3')]
    case 'wokwi-arduino-nano':
      return [{ name: 'arduino store', url: 'https://store.arduino.cc/products/arduino-nano' }, robu('arduino nano')]
    case 'wokwi-pi-pico':
      return [adafruit(4864), robu('raspberry pi pico')]
    case 'wokwi-led': {
      const c = attrs.color ?? 'red'
      return [...(LED[c] ? [adafruit(LED[c])] : []), robu(`${c} led 5mm`)]
    }
    case 'wokwi-resistor':
      return [...((attrs.value ?? '220') === '220' ? [adafruit(2780)] : []), robu(`${ohms(attrs.value ?? '220')} ohm resistor`)]
    case 'wokwi-pushbutton':
      return [adafruit(367), robu('tactile push button 6mm')]
    case 'wokwi-slide-switch':
      return [adafruit(805), robu('spdt slide switch')]
    case 'wokwi-potentiometer':
      return [adafruit(356), robu('10k potentiometer')]
    case 'wokwi-hc-sr04':
      return [adafruit(3942), robu('hc-sr04')]
    case 'wokwi-servo':
      return [adafruit(169), robu('sg90 servo')]
    case 'wokwi-buzzer':
      return [adafruit(1536), robu('passive buzzer')]
    case 'wokwi-dht22':
      return [adafruit(385), robu('dht22')]
    case 'wokwi-pir-motion-sensor':
      return [adafruit(189), robu('hc-sr501 pir')]
    case 'wokwi-led-ring': {
      const n = attrs.pixels ?? '16'
      return [...(RING[n] ? [adafruit(RING[n])] : []), robu(`ws2812 ring ${n}`)]
    }
    case 'wokwi-neopixel':
      return [adafruit(1938), robu('ws2812 5mm led')]
    case 'wokwi-ssd1306':
      return [adafruit(326), robu('0.96 oled i2c')]
    case 'wokwi-lcd1602':
      return [robu('lcd1602 i2c')]
    case 'wokwi-photoresistor-sensor':
      return [robu('ldr sensor module')]
    case 'wokwi-7segment':
      return [robu('7 segment display')]
    case 'wokwi-rgb-led':
      return [...(attrs.common === 'anode' ? [adafruit(159)] : []), robu(`rgb led common ${attrs.common === 'anode' ? 'anode' : 'cathode'}`)]
    case 'breadboard-half':
      return [adafruit(64), robu('400 point breadboard')]
    case 'breadboard-full':
      return [adafruit(239), robu('830 point breadboard')]
    case 'jumpers':
      return [adafruit(758), robu('male to male jumper wires')]
  }
  return []
}

export const shopFor = (p: DiagramPart) => shop(p.type, p.attrs)
const ohms = (v: string) => (Number(v) >= 1000 ? `${Number(v) / 1000}k` : v)
