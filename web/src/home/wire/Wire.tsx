import { useImperativeHandle, useRef, type Ref } from 'react'
import { BINS, buildLayers, SHADES, type Cam, type Tracked, type Viewport } from './camera'
import type { Mesh } from './vec'

// paper faces in three tones, lit from the top left, so the solids hide what is behind them
const TONES = ['var(--home-face-0)', 'var(--home-face-1)', 'var(--home-face-2)']
// near lines are dark, far ones fade, like a drafting overlay
const INK = { near: 0.78, far: 0.14, wNear: 0.85, wFar: 0.5 }

export type WireHandle = {
  draw(cam: Cam, vp: Viewport): Record<string, [number, number, number]>
}

export function Wire({ meshes, tracked, handle, className }: { meshes: Mesh[]; tracked: Tracked; handle: Ref<WireHandle>; className?: string }) {
  const fills = useRef<(SVGPathElement | null)[]>([])
  const lines = useRef<(SVGPathElement | null)[]>([])
  const floor = useRef<SVGPathElement>(null)

  useImperativeHandle(
    handle,
    () => ({
      draw(cam, vp) {
        const l = buildLayers(meshes, cam, vp, tracked)
        floor.current?.setAttribute('d', l.under)
        for (let i = 0; i < BINS; i++) {
          lines.current[i]?.setAttribute('d', l.line[i] || '')
          for (let s = 0; s < SHADES; s++) fills.current[i * SHADES + s]?.setAttribute('d', l.fill[i * SHADES + s] || '')
        }
        return l.anchors
      },
    }),
    [meshes, tracked],
  )

  return (
    <svg className={className} aria-hidden="true">
      <path ref={floor} fill="none" stroke="var(--home-ink)" strokeWidth={0.5} strokeOpacity={0.12} vectorEffect="non-scaling-stroke" />
      {Array.from({ length: BINS }, (_, i) => {
        // bin 0 is the furthest
        const u = 1 - i / (BINS - 1)
        return (
          <g key={i}>
            {TONES.map((t, s) => (
              <path key={s} ref={(el) => void (fills.current[i * SHADES + s] = el)} fill={t} />
            ))}
            <path
              ref={(el) => void (lines.current[i] = el)}
              fill="none"
              stroke="var(--home-ink)"
              strokeWidth={INK.wNear + (INK.wFar - INK.wNear) * u}
              strokeOpacity={INK.near + (INK.far - INK.near) * u}
              strokeLinecap="round"
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
    </svg>
  )
}
