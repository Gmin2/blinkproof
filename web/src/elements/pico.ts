// a raspberry pi pico drawn from its datasheet: 21 x 51 mm, two rows of 20 pins 17.78 mm apart on a 2.54 mm pitch.
// pin names match wokwi's diagram format (GP0..GP28, GND.1..GND.8, VBUS, VSYS, 3V3, 3V3_EN, ADC_VREF, RUN)

const MM = 3.78
const W = 21
const H = 51
const PITCH = 2.54
const TOP = 1.37
const LEFT_X = 1.61
const RIGHT_X = 19.39

// physical pins 1 to 20 down the left, 21 to 40 up the right
const LEFT = ['GP0', 'GP1', 'GND.1', 'GP2', 'GP3', 'GP4', 'GP5', 'GND.2', 'GP6', 'GP7', 'GP8', 'GP9', 'GND.3', 'GP10', 'GP11', 'GP12', 'GP13', 'GND.4', 'GP14', 'GP15']
const RIGHT = ['GP16', 'GP17', 'GND.5', 'GP18', 'GP19', 'GP20', 'GP21', 'GND.6', 'GP22', 'RUN', 'GP26', 'GP27', 'GND.7', 'GP28', 'ADC_VREF', '3V3', '3V3_EN', 'GND.8', 'VSYS', 'VBUS']

type Pin = { name: string; x: number; y: number }

function pins(): Pin[] {
  const out: Pin[] = []
  LEFT.forEach((name, i) => out.push({ name, x: LEFT_X * MM, y: (TOP + i * PITCH) * MM }))
  // pin 21 is at the bottom of the right row
  RIGHT.forEach((name, i) => out.push({ name, x: RIGHT_X * MM, y: (TOP + (19 - i) * PITCH) * MM }))
  return out
}

const label = (name: string) => name.replace(/^GND\.\d$/, 'GND').replace('ADC_VREF', 'VREF').replace('3V3_EN', 'EN')

function svg(led: boolean) {
  const pad = (p: Pin, side: 'l' | 'r') => {
    const ground = p.name.startsWith('GND')
    const tx = side === 'l' ? p.x + 7 : p.x - 7
    return `
      <rect x="${(side === 'l' ? 0 : W * MM - 2.2 * MM)}" y="${p.y - 0.85 * MM}" width="${2.2 * MM}" height="${1.7 * MM}" rx="1" fill="${ground ? '#1b1b1b' : '#caa04a'}" opacity="0.55"/>
      <circle cx="${p.x}" cy="${p.y}" r="${0.85 * MM}" fill="#d9b25a" stroke="#8a6a24" stroke-width="0.6"/>
      <circle cx="${p.x}" cy="${p.y}" r="${0.42 * MM}" fill="#20120a"/>
      <text x="${tx}" y="${p.y + 1.8}" font-size="5.2" font-family="ui-monospace, monospace" fill="${ground ? '#9aa79c' : '#eef6ee'}" text-anchor="${side === 'l' ? 'start' : 'end'}">${label(p.name)}</text>`
  }
  const all = pins()
  return `
  <svg xmlns="http://www.w3.org/2000/svg" width="${W * MM}" height="${H * MM}" viewBox="0 0 ${W * MM} ${H * MM}">
    <rect x="0" y="0" width="${W * MM}" height="${H * MM}" rx="${1 * MM}" fill="#1f6b3a"/>
    <rect x="0.6" y="0.6" width="${W * MM - 1.2}" height="${H * MM - 1.2}" rx="${1 * MM}" fill="none" stroke="#2f8a50" stroke-width="1"/>
    <rect x="${6.5 * MM}" y="${-1.2 * MM}" width="${8 * MM}" height="${5.6 * MM}" rx="2" fill="#b9bec4" stroke="#7d848b"/>
    <rect x="${7.4 * MM}" y="${0.2 * MM}" width="${6.2 * MM}" height="${1.6 * MM}" rx="1" fill="#6f767d"/>
    <rect x="${3.2 * MM}" y="${8 * MM}" width="${3 * MM}" height="${3 * MM}" rx="2" fill="#f2f2f2" stroke="#aaa"/>
    <circle cx="${4.7 * MM}" cy="${9.5 * MM}" r="${0.9 * MM}" fill="#e8e8e8" stroke="#999"/>
    <rect x="${14 * MM}" y="${7.2 * MM}" width="${1.6 * MM}" height="${0.9 * MM}" rx="1" fill="${led ? '#7cf29a' : '#2c4b35'}"/>
    ${led ? `<circle cx="${14.8 * MM}" cy="${7.65 * MM}" r="${2.4 * MM}" fill="#7cf29a" opacity="0.25"/>` : ''}
    <rect x="${5.5 * MM}" y="${19 * MM}" width="${10 * MM}" height="${10 * MM}" rx="2" fill="#16181b" stroke="#2c2f33"/>
    <text x="${10.5 * MM}" y="${24.6 * MM}" font-size="6" font-family="ui-monospace, monospace" fill="#8d939b" text-anchor="middle">RP2040</text>
    <rect x="${7 * MM}" y="${33 * MM}" width="${7 * MM}" height="${4 * MM}" rx="1.5" fill="#202326"/>
    <text x="${10.5 * MM}" y="${46 * MM}" font-size="6" font-family="ui-sans-serif, sans-serif" fill="#cfe9d6" text-anchor="middle" letter-spacing="0.6">Raspberry Pi Pico</text>
    ${all.slice(0, 20).map((p) => pad(p, 'l')).join('')}
    ${all.slice(20).map((p) => pad(p, 'r')).join('')}
  </svg>`
}

export class PicoElement extends HTMLElement {
  private _led = false

  get pinInfo() {
    return pins()
  }

  // the onboard led on GP25
  get led() {
    return this._led
  }
  set led(on: boolean) {
    if (on === this._led) return
    this._led = on
    this.render()
  }

  connectedCallback() {
    this.style.display = 'block'
    this.style.width = `${W * MM}px`
    this.style.height = `${H * MM}px`
    this.render()
  }

  private render() {
    this.innerHTML = svg(this._led)
  }
}

if (!customElements.get('bp-pi-pico')) customElements.define('bp-pi-pico', PicoElement)
