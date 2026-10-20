import { useEffect, useRef, useState } from 'react'

// the early access form: a name, an email and what they do. it goes to /agent/early
export function Early({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done' | 'failed'>('idle')
  const [error, setError] = useState('')
  const first = useRef<HTMLInputElement>(null)

  useEffect(() => {
    first.current?.focus()
    const key = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    addEventListener('keydown', key)
    return () => removeEventListener('keydown', key)
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
    <div className="early" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="early__card" role="dialog" aria-modal="true" aria-labelledby="early-title">
        <button type="button" className="early__x" onClick={onClose} aria-label="close">
          <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
            <path d="M1 1l8 8M9 1 1 9" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
          </svg>
        </button>
        {state === 'done' ? (
          <>
            <h2 id="early-title">You are on the list.</h2>
            <p>We will mail you when blinkproof opens up.</p>
            <button type="button" className="btn btn--lg" onClick={onClose}>
              Back to the page
            </button>
          </>
        ) : (
          <form onSubmit={send}>
            <h2 id="early-title">Request early access</h2>
            <p>blinkproof is opening up slowly. Leave your details and we will let you in.</p>
            <label>
              Name
              <input ref={first} name="name" required maxLength={120} autoComplete="name" />
            </label>
            <label>
              Email
              <input name="email" type="email" required maxLength={200} autoComplete="email" />
            </label>
            <label>
              What do you do
              <textarea name="what" rows={3} maxLength={1000} placeholder="student, maker, teacher, what you want to build" />
            </label>
            {state === 'failed' && <span className="early__err">{error}</span>}
            <button type="submit" className="btn btn--lg" disabled={state === 'sending'}>
              {state === 'sending' ? 'Sending' : 'Request access'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
