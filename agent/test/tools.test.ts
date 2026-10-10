import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { callTool, type Workspace } from '../src/tools.ts'

const file = (path: string) => readFileSync(new URL(`../../sketches/${path}`, import.meta.url), 'utf8')

describe('agent tools', () => {
  it('builds the parking sensor by hand through the tools, finish only once the test passed', async () => {
    const ws: Workspace = {}
    expect(await callTool(ws, 'finish', { summary: 'x' })).toMatchObject({ ok: false, refused: expect.stringContaining('has not passed') })
    expect(await callTool(ws, 'write_circuit', { diagram: JSON.parse(file('parking/diagram.json')) })).toMatchObject({ ok: true })
    expect(await callTool(ws, 'write_sketch', { code: file('parking/parking.ino') })).toMatchObject({ ok: true })
    expect(await callTool(ws, 'write_test', { yaml: file('parking/test.yaml') })).toMatchObject({ ok: true })
    expect(await callTool(ws, 'run_test', {})).toMatchObject({ ok: true })
    expect(await callTool(ws, 'finish', { summary: 'parking' })).toMatchObject({ ok: true, done: true })
  })

  it('refuses to finish after the sketch changed since the last passing run', async () => {
    const ws: Workspace = {}
    await callTool(ws, 'write_circuit', { diagram: JSON.parse(file('parking/diagram.json')) })
    await callTool(ws, 'write_sketch', { code: file('parking/parking.ino') })
    await callTool(ws, 'write_test', { yaml: file('parking/test.yaml') })
    await callTool(ws, 'run_test', {})
    await callTool(ws, 'write_sketch', { code: file('parking-ram/parking-ram.ino') })
    expect(await callTool(ws, 'finish', { summary: 'x' })).toMatchObject({ ok: false })
    const r = await callTool(ws, 'run_test', {})
    expect(r.ok).toBe(false)
    expect(String(r.parts)).toContain('ram:')
  })

  it('tells the model why a circuit is refused', async () => {
    const r = await callTool({}, 'write_circuit', { diagram: { version: 1, parts: [{ id: 'uno', type: 'wokwi-arduino-uno' }, { id: 'l', type: 'wokwi-led' }], connections: [['l:anode', 'uno:13', '']] } })
    expect(r).toEqual({ ok: false, errors: ['connection 0: wokwi-led has no pin anode. pins: A C'] })
  })

  it('wants a test that checks something', async () => {
    const r = await callTool({}, 'write_test', { yaml: 'name: t\nversion: 1\nsteps:\n  - delay: 1s\n' })
    expect(r.ok).toBe(false)
  })
})
