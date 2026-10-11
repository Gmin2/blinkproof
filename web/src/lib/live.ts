import { colorName, type Bench, type PartState } from '@blinkproof/sim'
import { useEffect, useRef, useState } from 'react'
import type { Build } from './compile'
import type { BenchState } from '../Workbench'

export type Point = { ms: number; v: number }
export type Happening = { ms: number; text: string; tone?: 'ok' | 'bad' | 'warn' }

// what one part is doing right now, as cards, one number to chart, and a line for the log when it changes
export type Reading = { cards: [string, string][]; value?: number; unit?: string; max?: number; line: string }

// lux runs from starlight to sunlight, round it the way a person would say it
export const fmtLux = (lux: number) => (lux >= 1000 ? `${Math.round(lux / 100) / 10}k` : lux >= 10 ? String(Math.round(lux)) : String(Math.round(lux * 10) / 10))

export function read(p: PartState): Reading | undefined {
  switch (p.type) {
    case 'wokwi-led':
      return { cards: [['Light', p.lit ? 'on' : 'off'], ['Brightness', `${Math.round(p.brightness * 100)}%`]], value: Math.round(p.brightness * 100), unit: '%', max: 100, line: p.lit ? `lit ${Math.round(p.brightness * 100)}%` : 'dark' }
    case 'wokwi-potentiometer':
      return { cards: [['Position', `${Math.round(p.position * 100)}%`], ['Reads', String(Math.round(p.position * 1023))]], value: Math.round(p.position * 100), unit: '%', max: 100, line: `at ${Math.round(p.position * 100)}%` }
    case 'wokwi-pushbutton':
      return { cards: [['State', p.pressed ? 'pressed' : 'up'], ['Presses', String(p.presses)]], value: p.pressed ? 1 : 0, max: 1, line: p.pressed ? 'pressed' : 'released' }
    case 'wokwi-hc-sr04':
      return { cards: [['Distance', `${p.distance} cm`], ['Pings', String(p.sensor?.pings ?? 0)]], value: p.distance, unit: 'cm', max: 400, line: `${p.distance} cm away` }
    case 'wokwi-buzzer':
      return { cards: [['Tone', p.buzzer?.hz ? `${Math.round(p.buzzer.hz)} hz` : 'silent'], ['Beeps', String(p.buzzer?.notes.length ?? 0)]], value: Math.round(p.buzzer?.hz ?? 0), unit: 'hz', line: p.buzzer?.hz ? `${Math.round(p.buzzer.hz)} hz` : 'silent' }
    case 'wokwi-servo':
      return { cards: [['Angle', p.servo?.pulses ? `${p.servo.angle}°` : '-'], ['Pulses', String(p.servo?.pulses ?? 0)]], value: p.servo?.angle ?? 0, unit: '°', max: 180, line: p.servo?.pulses ? `at ${p.servo.angle}°` : 'no pulses' }
    case 'wokwi-ssd1306': {
      const text = p.oled?.text().replace(/\s+/g, ' ').trim() ?? ''
      return { cards: [['Screen', !p.oled ? 'not on the bus' : p.oled.on ? 'on' : 'off'], ['Frames', String(p.oled?.frames ?? 0)]], line: text ? `shows "${text.slice(0, 40)}"` : 'blank' }
    }
    case 'wokwi-dht22':
      return { cards: [['Temperature', `${p.temperature} °C`], ['Humidity', `${p.humidity}%`], ['Reads', String(p.sensor?.reads ?? 0)]], value: p.temperature, unit: '°C', max: 50, line: !p.sensor ? 'no power' : `${p.temperature} °C, ${p.humidity}%` }
    case 'wokwi-photoresistor-sensor':
      return { cards: [['Light', `${fmtLux(p.lux)} lux`], ['AO', p.powered ? `${p.volts.toFixed(2)} V` : '-'], ['DO', !p.powered ? '-' : p.dark ? 'high, dark' : 'low, light']], value: p.lux, unit: 'lux', max: 1000, line: !p.powered ? 'no power' : `${fmtLux(p.lux)} lux, ${p.dark ? 'dark' : 'light'}` }
    case 'wokwi-led-ring':
    case 'wokwi-neopixel': {
      const px = p.strip?.pixels ?? []
      const lit = px.filter((c) => colorName(c) !== 'off')
      const colors = [...new Set(lit.map(colorName))]
      return { cards: [['Lit', `${lit.length} of ${px.length || '-'}`], ['Frames', String(p.strip?.frames ?? 0)]], value: lit.length, max: px.length || 16, line: lit.length ? `${lit.length} lit, ${colors.join(' ')}` : 'all off' }
    }
  }
  return undefined
}

const BOARDS = ['wokwi-arduino-uno', 'wokwi-arduino-nano', 'wokwi-pi-pico']
const HISTORY = 240

export type Live = {
  state: 'compiling' | 'running' | 'failed' | 'off'
  error?: string
  build?: Build
  simMs: number
  speed: number
  readings: Record<string, Reading>
  history: Record<string, Point[]>
  log: Record<string, Happening[]>
  serial: Happening[]
  control: (id: string, name: string, value: number) => void
}

type Frame = Omit<Live, 'state' | 'error' | 'build' | 'control'>
const empty = (): Frame => ({ simMs: 0, speed: 0, readings: {}, history: {}, log: {}, serial: [] })

// the gadget running in a workbench, read ten times a second into readings, a history to chart and a log of changes.
// the workbench hands its bench over so controls move the same sim that is drawn
export function useSampler(on: boolean, reset: unknown) {
  const bench = useRef<Bench | null>(null)
  const kept = useRef({ history: {} as Record<string, Point[]>, log: {} as Record<string, Happening[]>, last: {} as Record<string, string>, sampled: 0, simMs: 0, build: null as Build | null })
  const [frame, setFrame] = useState<Frame>(empty)
  const [build, setBuild] = useState<Build | null>(null)
  useEffect(() => {
    kept.current = { history: {}, log: {}, last: {}, sampled: 0, simMs: 0, build: null }
    setFrame(empty())
    setBuild(null)
  }, [reset])

  const onState = (s: BenchState) => {
    const k = kept.current
    if (s.build !== k.build) setBuild((k.build = s.build))
    const now = performance.now()
    if (now - k.sampled < 100) return
    k.sampled = now
    // a fresh boot starts the charts over
    if (s.simMs < k.simMs) Object.assign(k, { history: {}, log: {}, last: {} })
    k.simMs = s.simMs
    const readings: Record<string, Reading> = {}
    for (const [id, p] of Object.entries(s.parts)) {
      if (BOARDS.includes(p.type) || p.type === 'wokwi-resistor') continue
      const r = read(p)
      if (!r) continue
      readings[id] = r
      if (r.value !== undefined) {
        const h = (k.history[id] ??= [])
        h.push({ ms: s.simMs, v: r.value })
        if (h.length > HISTORY) h.shift()
      }
      if (r.line !== k.last[id]) {
        k.last[id] = r.line
        const l = (k.log[id] ??= [])
        l.push({ ms: s.simMs, text: r.line })
        if (l.length > 200) l.shift()
      }
    }
    const serial = s.lines.slice(-400).map((l) => ({ ms: l.ms, text: l.text, tone: /(error|fail)/i.test(l.text) ? ('bad' as const) : /(ready|ok\b)/i.test(l.text) ? ('ok' as const) : undefined }))
    setFrame({ simMs: s.simMs, speed: s.speed, readings, history: { ...k.history }, log: { ...k.log }, serial })
  }

  const live: Live = {
    state: !on ? 'off' : build && !build.ok ? 'failed' : build ? 'running' : 'compiling',
    error: build && !build.ok ? `line ${build.diagnostics[0]?.line}: ${build.diagnostics[0]?.message}` : undefined,
    build: build ?? undefined,
    ...frame,
    control: (id, name, value) => {
      try {
        bench.current?.control(id, name, value)
      } catch {}
    },
  }
  return { live, onState, bench }
}
