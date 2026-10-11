import { describe, expect, it } from 'vitest'
import { PARTS, shop } from '../src'

describe('where to buy', () => {
  it('every part, the breadboards and the jumpers have somewhere to buy them', () => {
    for (const t of [...Object.keys(PARTS), 'breadboard-half', 'breadboard-full', 'jumpers']) {
      const links = shop(t)
      expect(links.length, t).toBeGreaterThan(0)
      for (const l of links) expect(l.url, t).toMatch(/^https:\/\//)
      // the search is always last, the exact part first when a store has it
      expect(links.at(-1)!.name, t).toBe('robu.in')
    }
  })
  it('picks the page for the colour, value and size', () => {
    expect(shop('wokwi-led', { color: 'green' })[0].url).toBe('https://www.adafruit.com/product/298')
    expect(shop('wokwi-led', { color: 'blue' }).map((l) => l.name)).toEqual(['robu.in'])
    expect(shop('wokwi-resistor', { value: '10000' })[0].url).toContain('10k+ohm+resistor')
    expect(shop('wokwi-led-ring', { pixels: '24' })[0].url).toBe('https://www.adafruit.com/product/1586')
  })
})
