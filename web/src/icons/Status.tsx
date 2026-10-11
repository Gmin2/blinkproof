import { Icon } from './Icon'
import type { IconName } from './hand'

// pass, fail or warn as a hand drawn icon, ink in the status colour
export function Status({ ok, warn, size = 16 }: { ok: boolean; warn?: boolean; size?: number }) {
  return <Icon name={warn ? 'warn' : ok ? 'pass' : 'fail'} size={size} className={warn ? 'text-warn' : ok ? 'text-ok' : 'text-bad'} />
}

// what each agent tool and each test step looks like
export const TOOL_ICON: Record<string, IconName> = {
  list_parts: 'examples',
  write_circuit: 'board',
  write_sketch: 'code',
  write_test: 'test',
  compile: 'build',
  run_test: 'play',
  finish: 'logo',
}

export const STEP_ICON: Record<string, IconName> = {
  delay: 'clock',
  'wait-serial': 'serial',
  'expect-serial': 'serial',
  'write-serial': 'serial',
  'set-control': 'knob',
  'expect-pin': 'wire',
  'wait-text': 'screen',
  'expect-text': 'screen',
  'expect-pixels': 'ring',
  'expect-servo': 'servo',
  'expect-tone': 'buzzer',
  'expect-led': 'led',
}
