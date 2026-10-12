import type { Cam } from './wire/camera'

export type Key = { t: number; yaw: number; pitch: number; dist: number; y: number }

// the camera over the whole scroll: a high three quarter view, round to the sonar's face, then up over the board
export const PATH: Key[] = [
  { t: 0.0, yaw: -0.42, pitch: 0.42, dist: 14.2, y: 0.25 },
  { t: 0.26, yaw: -0.22, pitch: 0.38, dist: 13.6, y: 0.2 },
  { t: 0.5, yaw: 0.08, pitch: 0.24, dist: 12.8, y: 0.1 },
  { t: 0.72, yaw: 0.3, pitch: 0.4, dist: 13.4, y: 0.0 },
  { t: 1.0, yaw: 0.14, pitch: 0.6, dist: 13.8, y: -0.15 },
]

const ease = (x: number) => (x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2)

export function camAt(t: number): Cam {
  let i = 0
  while (i < PATH.length - 2 && t > PATH[i + 1].t) i++
  const a = PATH[i]
  const b = PATH[i + 1]
  const u = ease(Math.max(0, Math.min(1, (t - a.t) / (b.t - a.t))))
  const mix = (p: number, q: number) => p + (q - p) * u
  return { yaw: mix(a.yaw, b.yaw), pitch: mix(a.pitch, b.pitch), dist: mix(a.dist, b.dist), fov: 0.55, roll: 0, target: [0, mix(a.y, b.y), 0] }
}

export type Beat = {
  id: string
  // the scroll window the callout is on screen for
  in: number
  out: number
  anchor: string
  // where the card sits, as a fraction of the viewport
  card: [number, number]
  kicker: string
  body: string
}

export const BEATS: Beat[] = [
  {
    id: 'wire',
    in: 0.13,
    out: 0.42,
    anchor: 'uno',
    card: [0.07, 0.62],
    kicker: 'THE PARTS — 01 LIST AND WIRE',
    body: 'From your prompt the agent picks real parts, lists what to buy, and lays them out on a breadboard pin by pin: the sonar on D9 and D10, the ring on D6, the oled on i2c, the buzzer on D8.',
  },
  {
    id: 'run',
    in: 0.5,
    out: 0.78,
    anchor: 'sonar',
    card: [0.66, 0.66],
    kicker: 'THE SIMULATOR — 02 RUN',
    body: 'It writes the firmware and runs it in the simulator, cycle for cycle. Bring the car closer and the ring fills, the buzzer speeds up and the oled counts down, before a single part arrives.',
  },
  {
    id: 'prove',
    in: 0.83,
    out: 1.02,
    anchor: 'oled',
    card: [0.66, 0.5],
    kicker: 'THE TEST — 03 VERIFY',
    body: 'Then the agent verifies it with a written test that moves the sonar and checks every pin. The first build ran out of ram, it read the failure, fixed it, and now every step passes.',
  },
]

// 0 outside the window, 1 in the middle, with soft shoulders
export function window01(t: number, from: number, to: number, shoulder = 0.055) {
  if (t < from - shoulder || t > to + shoulder) return 0
  if (t < from) return (t - from + shoulder) / shoulder
  if (t > to) return (to + shoulder - t) / shoulder
  return 1
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x)
