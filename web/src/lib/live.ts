import { Bench, Circuit, colorName, type Diagram, type PartState } from '@blinkproof/sim'
import { useEffect, useRef, useState } from 'react'
import { compile, type Build } from './compile'

export type Point = { ms: number; v: number }
export type Happening = { ms: number; text: string; tone?: 'ok' | 'bad' | 'warn' }

// what one part is doing right now, as cards, one number to chart, and a line for the log when it changes
export type Reading = { cards: [string, string][]; value?: number; unit?: string; max?: number; line: string }

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

// the gadget running in the page: compile once, then the bench in real time, sampled ten times a second
export function useLive(diagram: Diagram | null | undefined, source: string | undefined, on: boolean): Live {
  const [build, setBuild] = useState<Build>()
  const [error, setError] = useState<string>()
  const [frame, setFrame] = useState<Omit<Live, 'state' | 'error' | 'build' | 'control'>>({ simMs: 0, speed: 0, readings: {}, history: {}, log: {}, serial: [] })
  const bench = useRef<Bench | null>(null)
  const board = diagram?.parts.find((p) => p.type === 'wokwi-pi-pico') ? 'pico' : diagram?.parts.find((p) => p.type === 'wokwi-arduino-nano') ? 'nano' : 'uno'

  useEffect(() => {
    if (!on || !source) return
    let stale = false
    setBuild(undefined)
    setError(undefined)
    compile(source, board)
      .then((b) => !stale && (b.ok ? setBuild(b) : setError(`line ${b.diagnostics[0]?.line}: ${b.diagnostics[0]?.message}`)))
      .catch(() => !stale && setError('the compiler is not running'))
    return () => {
      stale = true
    }
  }, [on, source, board])

  useEffect(() => {
    const firmware = build?.hex ?? build?.uf2
    const circuit = diagram && Circuit.parse(diagram).circuit
    if (!on || !firmware || !circuit) return
    const b = new Bench(circuit, firmware, build?.symbols)
    bench.current = b
    const history: Record<string, Point[]> = {}
    const log: Record<string, Happening[]> = {}
    const last: Record<string, string> = {}
    const serial: Happening[] = []
    let read0 = 0
    let partial = ''
    let raf = 0
    let prev = performance.now()
    let sampled = 0
    let windowWall = 0
    let windowSim = 0
    let speed = 0
    const tick = (now: number) => {
      const wall = now - prev
      prev = now
      const before = b.board.ms
      b.run(Math.min(50, wall))
      windowWall += wall
      windowSim += b.board.ms - before
      if (windowWall > 600) {
        speed = windowSim / windowWall
        windowWall = windowSim = 0
      }
      // serial, line by line, stamped with the sim time the newline came in
      const text = b.board.serial
      if (text.length !== read0) {
        const parts = (partial + text.slice(read0)).split('\n')
        read0 = text.length
        partial = parts.pop() ?? ''
        for (const t of parts) serial.push({ ms: b.board.ms, text: t.replace(/\r$/, ''), tone: /(error|fail)/i.test(t) ? 'bad' : /(ready|ok\b)/i.test(t) ? 'ok' : undefined })
        if (serial.length > 400) serial.splice(0, serial.length - 400)
      }
      if (now - sampled > 100) {
        sampled = now
        const readings: Record<string, Reading> = {}
        for (const [id, p] of Object.entries(b.parts)) {
          if (BOARDS.includes(p.type) || p.type === 'wokwi-resistor') continue
          const r = read(p)
          if (!r) continue
          readings[id] = r
          if (r.value !== undefined) {
            const h = (history[id] ??= [])
            h.push({ ms: b.board.ms, v: r.value })
            if (h.length > HISTORY) h.shift()
          }
          if (r.line !== last[id]) {
            last[id] = r.line
            const l = (log[id] ??= [])
            l.push({ ms: b.board.ms, text: r.line })
            if (l.length > 200) l.shift()
          }
        }
        setFrame({ simMs: b.board.ms, speed, readings, history: { ...history }, log: { ...log }, serial: [...serial] })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      bench.current = null
    }
  }, [on, build, diagram])

  return {
    state: !on ? 'off' : error ? 'failed' : build ? 'running' : 'compiling',
    error,
    build,
    ...frame,
    control: (id, name, value) => {
      try {
        bench.current?.control(id, name, value)
      } catch {}
    },
  }
}
