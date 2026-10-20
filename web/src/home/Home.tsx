import { useEffect, useRef, useState } from 'react'
import Lenis from 'lenis'
import { Logo } from '../icons/Icon'
import { BEATS, camAt, clamp01, window01 } from './beats'
import { ANCHORS, PING_FROM, RING, benchMeshes, boardCorners, boardPoint } from './wire/bench'
import { projector, type Tracked } from './wire/camera'
import type { V3 } from './wire/vec'
import { Wire, type WireHandle } from './wire/Wire'
import { Early } from './Early'
import './home.css'

const MESHES = benchMeshes()

// points tracked in screen space every frame: callout anchors, the board's corners for the wash, and where its blobs sit
const WASH_UV: [number, number][] = [
  [0.3, 0.38],
  [0.6, 0.6],
  [0.45, 0.74],
  [0.74, 0.3],
]
const TRACKED: Tracked = { ...ANCHORS }
boardCorners().forEach((p, i) => (TRACKED[`bc${i}`] = p))
WASH_UV.forEach(([u, v], i) => (TRACKED[`wb${i}`] = boardPoint(u, v)))

// the wash starts as a failing run, warm, and turns green as the test passes
const FAIL = ['#f2552c', '#e4703a', '#e2c53c', '#f2552c']
const PASS = ['#1fa863', '#37a58b', '#7cc68f', '#1fa863']

const PINGS = 4
// how many of the ring's 16 pixels light up while it runs
const LIT = 11

export function Home() {
  const [asking, setAsking] = useState(false)
  const ask = () => setAsking(true)
  const wire = useRef<WireHandle>(null)
  const pin = useRef<HTMLDivElement>(null)
  const hero = useRef<HTMLElement>(null)
  const cards = useRef<(HTMLDivElement | null)[]>([])
  const leads = useRef<(SVGPathElement | null)[]>([])
  const dots = useRef<(SVGCircleElement | null)[]>([])
  const washClip = useRef<SVGPolygonElement>(null)
  const failG = useRef<SVGGElement>(null)
  const passG = useRef<SVGGElement>(null)
  const blobs = useRef<(SVGEllipseElement | null)[]>([])
  const pings = useRef<SVGPathElement>(null)
  const pixels = useRef<SVGPathElement>(null)

  useEffect(() => {
    const lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 })
    let forced: number | null = null
    ;(window as unknown as { __setProgress: (p: number) => void }).__setProgress = (p) => {
      forced = p
    }
    let raf = 0
    const t0 = performance.now()

    const tick = (now: number) => {
      lenis.raf(now)
      const el = hero.current
      const vh = window.innerHeight
      let p = 0
      if (el) p = clamp01(-el.getBoundingClientRect().top / Math.max(el.offsetHeight - vh, 1))
      if (forced !== null) p = forced
      const time = (now - t0) / 1000

      const box = pin.current
      const w = box?.clientWidth ?? window.innerWidth
      const h = box?.clientHeight ?? vh
      const cam = camAt(p)
      // projection follows the viewport height; on narrow screens scale it back so the bench still fits across
      const vp = { w, h, scale: Math.min(1, w / 860) }
      const a = wire.current?.draw(cam, vp) ?? {}
      const project = projector(cam, vp)

      // callouts and their leader lines
      for (let i = 0; i < BEATS.length; i++) {
        const b = BEATS[i]
        const vis = window01(p, b.in, b.out)
        const card = cards.current[i]
        const lead = leads.current[i]
        const dot = dots.current[i]
        if (!card) continue
        const cx = b.card[0] * w
        const cy = b.card[1] * h
        card.style.opacity = String(vis)
        card.style.left = `${cx}px`
        card.style.top = `${cy}px`
        card.style.transform = `translate3d(0, ${(1 - vis) * 7}px, 0)`
        const anchor = a[b.anchor]
        if (!lead || !dot || !anchor) continue
        if (vis <= 0.001) {
          lead.setAttribute('d', '')
          dot.setAttribute('r', '0')
          continue
        }
        const [ax, ay] = anchor
        // the leader meets the card on the side that faces the anchor
        const left = cx + card.offsetWidth / 2 < ax
        const ex = left ? cx + card.offsetWidth + 6 : cx - 6
        const elbowX = ax + (ex - ax) * 0.55
        lead.setAttribute('d', `M${ax.toFixed(1)} ${ay.toFixed(1)}L${elbowX.toFixed(1)} ${ay.toFixed(1)}L${ex.toFixed(1)} ${(cy + 11).toFixed(1)}`)
        lead.style.opacity = String(vis * 0.55)
        dot.setAttribute('cx', ax.toFixed(1))
        dot.setAttribute('cy', ay.toFixed(1))
        dot.setAttribute('r', String(2.1 * vis))
      }

      // the wash over the breadboard while the test runs: red first, green once it passes
      const corners = [0, 1, 2, 3].map((i) => a[`bc${i}`]).filter(Boolean)
      if (washClip.current && corners.length === 4) washClip.current.setAttribute('points', corners.map((c) => `${c[0].toFixed(1)},${c[1].toFixed(1)}`).join(' '))
      const wash = window01(p, 0.8, 1.04, 0.08)
      const passed = clamp01((p - 0.88) / 0.07)
      if (failG.current) failG.current.style.opacity = String(wash * (1 - passed) * 0.6)
      if (passG.current) passG.current.style.opacity = String(wash * passed * 0.5)
      const spanPx = corners.length === 4 ? Math.hypot(corners[1][0] - corners[0][0], corners[1][1] - corners[0][1]) : 300
      for (let i = 0; i < WASH_UV.length * 2; i++) {
        const c = a[`wb${i % WASH_UV.length}`]
        const e = blobs.current[i]
        if (!c || !e) continue
        const k = i % WASH_UV.length
        e.setAttribute('cx', c[0].toFixed(1))
        e.setAttribute('cy', c[1].toFixed(1))
        e.setAttribute('rx', (spanPx * (0.17 + k * 0.035)).toFixed(1))
        e.setAttribute('ry', (spanPx * (0.07 + k * 0.014)).toFixed(1))
      }

      // while it runs: sonar pings leave the cans, and the ring lights up pixel by pixel
      const run = window01(p, 0.5, 0.78, 0.06)
      if (pings.current) {
        if (run <= 0.002) pings.current.setAttribute('d', '')
        else {
          let d = ''
          for (let n = 0; n < PINGS; n++) {
            const k = (time * 0.55 + n / PINGS) % 1
            const r = 0.18 + k * 1.1
            const z = PING_FROM[2] + 0.1 + k * 2.2
            let first = true
            for (let s = 0; s <= 24; s++) {
              const ang = -Math.PI * 0.42 + (s / 24) * Math.PI * 0.84
              const q: V3 = [PING_FROM[0] + Math.sin(ang) * r * 1.6, PING_FROM[1] + Math.cos(ang) * r * 0.45, z]
              const pr = project(q)
              if (pr[2] <= 0.06) continue
              d += `${first ? 'M' : 'L'}${pr[0].toFixed(1)} ${pr[1].toFixed(1)}`
              first = false
            }
          }
          pings.current.setAttribute('d', d)
          pings.current.style.opacity = String(run * 0.6)
        }
      }
      if (pixels.current) {
        const lit = Math.round(run * LIT)
        let d = ''
        for (let i = 0; i < lit && run > 0.002; i++) {
          const ang = (i / 16) * Math.PI * 2
          const pr = project([RING.c[0] + Math.cos(ang) * RING.r, RING.c[1] + 0.06, RING.c[2] + Math.sin(ang) * RING.r])
          d += `M${(pr[0] - 2.4).toFixed(1)} ${pr[1].toFixed(1)}a2.4 2.4 0 1 0 4.8 0a2.4 2.4 0 1 0 -4.8 0`
        }
        pixels.current.setAttribute('d', d)
      }

      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      lenis.destroy()
    }
  }, [])

  return (
    <div className="home">
      <header className="nav">
        <a href="/" className="nav__brand" aria-label="blinkproof">
          <Logo size={24} className="text-[#141414]" />
          <span>blinkproof</span>
        </a>
        <div className="nav__right">
          <button type="button" className="btn" onClick={ask}>
            Request early access
          </button>
        </div>
      </header>

      <section className="hero" ref={hero}>
        <div className="hero__pin" ref={pin}>
          <h1 className="hero__h1">
            Just say what to build.
            <span>We make sure it runs.</span>
          </h1>
          <p className="hero__lede">
            Write one prompt. blinkproof lists the parts, lays them out on a breadboard, runs it in a <span className="mark-word">simulator</span> and has the agent verify it with a test. Your hardware works before you build it, no guessing.
          </p>

          <svg className="layer layer--heat">
            <defs>
              <clipPath id="wash-clip">
                <polygon ref={washClip} points="0,0" />
              </clipPath>
              <filter id="wash-blur" x="-40%" y="-40%" width="180%" height="180%">
                <feGaussianBlur stdDeviation="22" />
              </filter>
            </defs>
            {[FAIL, PASS].map((ink, g) => (
              <g key={g} ref={g ? passG : failG} clipPath="url(#wash-clip)" filter="url(#wash-blur)" opacity="0">
                {ink.map((c, i) => (
                  <ellipse key={i} ref={(el) => void (blobs.current[g * WASH_UV.length + i] = el)} fill={c} opacity={0.55 + i * 0.08} />
                ))}
              </g>
            ))}
          </svg>

          <Wire className="layer layer--wire" meshes={MESHES} tracked={TRACKED} handle={wire} />

          <svg className="layer layer--spray">
            <path ref={pings} stroke="var(--lit)" strokeWidth="1" strokeLinecap="round" fill="none" />
            <path ref={pixels} fill="var(--lit)" />
          </svg>

          <svg className="layer layer--lead">
            {BEATS.map((b, i) => (
              <g key={b.id}>
                <path ref={(el) => void (leads.current[i] = el)} stroke="var(--ink)" strokeWidth="0.6" fill="none" opacity="0" />
                <circle ref={(el) => void (dots.current[i] = el)} r="0" fill="none" stroke="var(--lit)" strokeWidth="1" />
              </g>
            ))}
          </svg>

          {BEATS.map((b, i) => (
            <div className="callout" key={b.id} ref={(el) => void (cards.current[i] = el)}>
              <div className="callout__kicker">{b.kicker}</div>
              <p className="callout__body">{b.body}</p>
            </div>
          ))}

          <div className="hero__foot">
            <button type="button" className="btn btn--lg" onClick={ask}>
              Request early access
              <svg width="11" height="9" viewBox="0 0 11 9" fill="none" aria-hidden="true">
                <path d="M1 4.5h8M6 1.2 9.4 4.5 6 7.8" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      <section className="after">
        <h2>
          Building any hardware as a hobby project is easy now.
          <br />
          <span>Say what you want. It comes wired, coded and tested.</span>
        </h2>
        <div className="figures">
          {[
            ['1 sentence', 'IS ALL IT TAKES TO START'],
            ['3 boards', 'UNO, NANO AND PICO'],
            ['20 parts', 'SENSORS, LIGHTS, SCREENS, MOTORS'],
            ['0 guessing', 'IT RUNS BEFORE YOU BUY A THING'],
          ].map(([v, l]) => (
            <div className="fig" key={l}>
              <b>{v}</b>
              <span>{l}</span>
            </div>
          ))}
        </div>
      </section>

      <footer className="foot">
        <a href="/" className="nav__brand" aria-label="blinkproof">
          <Logo size={20} className="text-[#141414]" />
          <span>blinkproof</span>
        </a>
        <nav>
          <button type="button" onClick={ask}>
            Request early access
          </button>
          <a href="https://github.com/Gmin2/blinkproof" target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
        </nav>
        <span className="foot__note">Built for neatHack 2026</span>
      </footer>
      {asking && <Early onClose={() => setAsking(false)} />}
    </div>
  )
}
