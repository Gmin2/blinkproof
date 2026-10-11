import { useEffect, useRef } from 'react'

type Props = {
  value: string
  onChange: (v: string) => void
  onRun: () => void
  // while the agent types the sketch, follow it and keep hands off
  readOnly?: boolean
}

// a plain editor: line numbers beside a textarea in the same font, tab indents two spaces, cmd+enter runs
export function CodeEditor({ value, onChange, onRun, readOnly }: Props) {
  const area = useRef<HTMLTextAreaElement>(null)
  const gutter = useRef<HTMLDivElement>(null)
  const lines = value.split('\n').length

  useEffect(() => {
    if (readOnly && area.current) area.current.scrollTop = area.current.scrollHeight
  }, [value, readOnly])

  const key = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      onRun()
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      const el = e.currentTarget
      const { selectionStart: a, selectionEnd: b } = el
      const next = value.slice(0, a) + '  ' + value.slice(b)
      onChange(next)
      requestAnimationFrame(() => el.setSelectionRange(a + 2, a + 2))
    }
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden font-mono text-[11px] leading-[18px]">
      <div ref={gutter} className="w-9 shrink-0 select-none overflow-hidden pb-3 pr-2 text-right text-dim/60" aria-hidden>
        {Array.from({ length: lines }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        ref={area}
        value={value}
        readOnly={readOnly}
        spellCheck={false}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={key}
        onScroll={(e) => gutter.current && (gutter.current.scrollTop = e.currentTarget.scrollTop)}
        className="min-h-0 flex-1 resize-none whitespace-pre bg-transparent pb-3 pr-3 text-ink outline-none"
        style={{ tabSize: 2 }}
      />
    </div>
  )
}
