import { useEffect, useRef, useState } from 'react'
import { Logo } from '../icons/Icon'
import { FACTS, FLOOR, partMeshes } from './trivia'
import { Wire, type WireHandle } from './turn/Wire'
import { SHADERS, surfaceById } from './turn/shaders'

const EVERY = 6500
const INK = { near: 0.74, far: 0.095, wNear: 0.85, wFar: 0.5 }

// the early access page: the form on the left, a part turning on the right with something worth knowing about it.
// a name, an email and what they do go to /agent/early
export function Early({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [error, setError] = useState('')
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', key)
    document.documentElement.style.overflow = 'hidden'
    return () => {
      removeEventListener('keydown', key)
      document.documentElement.style.overflow = ''
    }
  }, [onClose])

  async function send(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    setState('sending')
    try {
      const r = await fetch('/agent/early', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: f.get('name'), email: f.get('email'), what: f.get('what') }),
      })
      if (!r.ok) throw new Error(await r.text())
      setState('done')
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : 'that did not go through')
      setState('failed')
    }
  }

  return (
    <div className="early" role="dialog" aria-modal="true" aria-labelledby="early-title">
      <section className="early__side">
        <header className="early__top">
          <span className="nav__brand">
            <Logo size={22} className="text-[#141414]" />
            <span>blinkproof</span>
          </span>
          <button type="button" className="nav__link" onClick={onClose}>
            Back
          </button>
        </header>

        <div className="early__body">
          {state === 'done' ? (
            <>
              <h2 id="early-title">You are on the list.</h2>
              <p>We will mail you when blinkproof opens up.</p>
              <button type="button" className="btn btn--lg early__wide" onClick={onClose}>
                Back to the page
              </button>
            </>
          ) : (
            <form onSubmit={send}>
              <h2 id="early-title">Request early access</h2>
              <p>blinkproof is opening up slowly. Leave your details and we will let you in.</p>
              <label>
                Name
                <input ref={first} name="name" required maxLength={120} autoComplete="name" placeholder="Ada Lovelace" />
              </label>
              <label>
                Email
                <input name="email" type="email" required maxLength={200} autoComplete="email" placeholder="you@example.com" />
              </label>
              <label>
                What do you do
                <textarea name="what" rows={3} maxLength={1000} placeholder="student, maker, teacher, what you want to build" />
              </label>
              {state === 'failed' && <span className="early__err">{error}</span>}
              <button type="submit" className="btn btn--lg early__wide" disabled={state === 'sending'}>
                {state === 'sending' ? 'Sending' : 'Request access'}
              </button>
            </form>
          )}
        </div>

        <span className="early__note">blinkproof 2026</span>
      </section>

      <section className="early__art" aria-hidden="true">
        <Trivia />
      </section>
    </div>
  )
}

// one part at a time on a turntable, a new one every few seconds
function Trivia() {
  const [i, setI] = useState(0)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let t = 0
    const id = setInterval(() => {
      setGone(true)
      t = window.setTimeout(() => {
        setI((k) => (k + 1) % FACTS.length)
        setGone(false)
      }, 260)
    }, EVERY)
    return () => (clearInterval(id), clearTimeout(t))
  }, [])

  const f = FACTS[i]
  return (
    <>
      <div className="early__show">
        <div className={`early__turn${gone ? ' is-gone' : ''}`}>
          <Turntable key={f.id} id={f.id} />
        </div>
        <span className="early__fig">{f.title.toUpperCase()}</span>
      </div>
      <div className={`early__cap${gone ? ' is-gone' : ''}`}>
        <span>
          <em>{String(i + 1).padStart(2, '0')}</em> while you wait
        </span>
        <b>{f.title}</b>
        <p>{f.text}</p>
      </div>
    </>
  )
}

function Turntable({ id }: { id: string }) {
  const wire = useRef<WireHandle>(null)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const t0 = performance.now()
    const tick = (now: number) => {
      const t = (now - t0) / 1000
      const w = box.current?.clientWidth ?? 400
      const h = box.current?.clientHeight ?? 240
      const meshes = [FLOOR, ...partMeshes(id, -0.4 + (still ? 0 : t * 0.35))]
      const cam = { yaw: -0.62, pitch: 0.47, dist: 8.4, fov: 0.55, roll: 0, target: [0, 0.15, 0] as [number, number, number], solid: true }
      wire.current?.draw(cam, { w, h, scale: Math.min(1, w / 600) }, meshes, {})
      if (!still) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id])

  return (
    <div className="early__wire" ref={box}>
      <Wire handle={wire} ink={INK} shader={SHADERS[0]} surface={surfaceById('iso-warm')} grain={0} />
    </div>
  )
}
