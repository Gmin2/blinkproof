import { readFileSync } from 'node:fs'
import { compile } from '@blinkproof/compiler'

const file = (path: string) => readFileSync(new URL(`../../sketches/${path}`, import.meta.url), 'utf8')

// compiles through the same service the agent uses, cached after the first run
export async function hex(name: string) {
  const r = await compile('uno', { 'sketch.ino': file(`${name}/${name}.ino`) })
  if (!r.hex) throw new Error(`${name} did not compile: ${r.log}`)
  return r.hex
}

export const diagram = (name: string) => JSON.parse(file(`${name}/diagram.json`))
