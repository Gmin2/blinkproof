import { useRef, useState } from 'react'

// a width someone set by dragging, kept for next time
export function useWidth(key: string, initial: number, min: number, max: number) {
  const [w, setW] = useState(() => {
    try {
      const v = Number(localStorage.getItem(`bp-width-${key}`))
      return v >= min && v <= max ? v : initial
    } catch {
      return initial
    }
  })
  const set = (v: number) => {
    const c = Math.round(Math.min(max, Math.max(min, v)))
    setW(c)
    try {
      localStorage.setItem(`bp-width-${key}`, String(c))
    } catch {}
  }
  return [w, set] as const
}

// the strip on a panel's inner edge: drag it to make the panel wider, double click for its usual width
export function Grip({ side, width, onWidth, onReset, onDrag }: { side: 'left' | 'right'; width: number; onWidth: (w: number) => void; onReset: () => void; onDrag?: (on: boolean) => void }) {
  const start = useRef<{ x: number; w: number } | null>(null)
  const [on, setOn] = useState(false)
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      title="drag to resize, double click to reset"
      onPointerDown={(e) => {
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { x: e.clientX, w: width }
        setOn(true)
        onDrag?.(true)
      }}
      onPointerMove={(e) => {
        if (!start.current) return
        const dx = e.clientX - start.current.x
        onWidth(start.current.w + (side === 'right' ? dx : -dx))
      }}
      onPointerUp={() => ((start.current = null), setOn(false), onDrag?.(false))}
      onPointerCancel={() => ((start.current = null), setOn(false), onDrag?.(false))}
      onDoubleClick={onReset}
      className={`group absolute inset-y-0 z-20 w-2 cursor-col-resize ${side === 'right' ? '-right-1' : '-left-1'}`}
    >
      <span className={`absolute inset-y-0 left-1/2 w-px -translate-x-1/2 transition-colors ${on ? 'bg-accent' : 'bg-transparent group-hover:bg-accent/60'}`} />
    </div>
  )
}
