import { readFileSync } from 'node:fs'
import { compile } from '@blinkproof/compiler'

const file = (path: string) => readFileSync(new URL(`../../sketches/${path}`, import.meta.url), 'utf8')

export const source = (name: string) => file(`${name}/${name}.ino`)

// compiles through the same service the agent uses, cached after the first run
export async function build(src: string) {
  const r = await compile('uno', { 'sketch.ino': src })
  if (!r.hex) throw new Error(`did not compile: ${r.log}`)
  return r.hex
}

export const hex = (name: string) => build(source(name))

export const diagram = (name: string) => JSON.parse(file(`${name}/diagram.json`))
