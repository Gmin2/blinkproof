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

// the hex and where the heap pointer lives, for tests that look at ram
export async function firmware(src: string, board: 'uno' | 'nano' | 'mega' = 'uno') {
  const r = await compile(board, { 'sketch.ino': src })
  if (!r.hex) throw new Error(`did not compile: ${r.log}`)
  return { hex: r.hex, symbols: r.symbols ?? {}, ram: r.ram! }
}

export const diagram = (name: string) => JSON.parse(file(`${name}/diagram.json`))
