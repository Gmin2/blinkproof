import { useImperativeHandle, useRef, type Ref } from 'react'
import { buildLayers, SHADES, SURF_BINS, type Cam, type Tracked, type Viewport } from './camera'
import type { Mesh } from './vec'
import { ShaderDefs, type Shader, type Surface } from './shaders'

export type Ink = { near: number; far: number; wNear: number; wFar: number }

export type WireHandle = {
  draw(
    cam: Cam,
    vp: Viewport,
    meshes: Mesh[],
    tracked: Tracked,
  ): Record<string, [number, number, number]>
}

/**
 * The drawing: a depth ladder of paired fill and stroke paths, painted back to
 * front. Geometry arrives at draw time rather than as a prop so a variant whose
 * shape changes across the scroll can hand over fresh meshes each frame without
 * a React render.
 */
export function Wire({
  handle,
  ink,
  shader,
  surface,
  grain,
  className,
}: {
  handle: Ref<WireHandle>
  ink: Ink
  shader: Shader
  surface: Surface
  grain: number
  className?: string
}) {
  const fills = useRef<(SVGPathElement | null)[]>([])
  const lines = useRef<(SVGPathElement | null)[]>([])
  const solid = useRef(false)
  solid.current = surface.fill !== undefined || surface.tints !== undefined

  useImperativeHandle(handle, () => ({
    draw(cam, vp, meshes, tracked) {
      const l = buildLayers(meshes, cam, vp, tracked)
      for (let i = 0; i < SURF_BINS; i++) {
        lines.current[i]?.setAttribute('d', l.line[i] || '')
        for (let s = 0; s < SHADES; s++) {
          const k = i * SHADES + s
          fills.current[k]?.setAttribute('d', solid.current ? l.fill[k] || '' : '')
        }
      }
      return l.anchors
    },
  }), [])

  const n = SURF_BINS
  return (
    <svg className={className} aria-hidden="true">
      <ShaderDefs />
      {Array.from({ length: n }, (_, i) => {
        // bin 0 is furthest, so depth runs backwards through the ladder
        const u = 1 - i / (n - 1)
        const w = (ink.wNear + (ink.wFar - ink.wNear) * u) * (shader.weight?.(i, n) ?? 1)
        const o = (ink.near + (ink.far - ink.near) * u) * (shader.alpha?.(i, n) ?? 1)
        const f = shader.filter?.(i, n)
        return (
          <g key={i}>
            {surface.fill || surface.tints
              ? Array.from({ length: SHADES }, (_, s) => (
                  <path
                    key={s}
                    ref={(el) => { fills.current[i * SHADES + s] = el }}
                    fill={surface.tints ? surface.tints[s] : surface.fill}
                    stroke={surface.stroke}
                    strokeWidth={surface.strokeWidth}
                    strokeLinejoin="round"
                  />
                ))
              : null}
            <path
              ref={(el) => { lines.current[i] = el }}
              fill="none"
              stroke={surface.line ?? shader.ink(i, n)}
              strokeWidth={w}
              strokeOpacity={Math.min(1, o)}
              strokeLinecap="round"
              strokeLinejoin="round"
              filter={f ? `url(#${f})` : undefined}
              vectorEffect="non-scaling-stroke"
            />
          </g>
        )
      })}
      {grain > 0 ? (
        <rect width="100%" height="100%" filter="url(#grain)" opacity={grain} />
      ) : null}
    </svg>
  )
}
