import { Icon, type IconName } from './Icon'

export function Status({ ok, warn, size = 16 }: { ok: boolean; warn?: boolean; size?: number }) {
  return <Icon name={warn ? 'triangle-warning' : ok ? 'circle-check' : 'circle-xmark'} size={size} className={warn ? 'text-warn' : ok ? 'text-ok' : 'text-bad'} />
}

export const TOOL_ICON: Record<string, IconName> = {
  list_parts: 'box',
  write_circuit: 'frame',
  write_sketch: 'code',
  write_test: 'flask',
  compile: 'bolt',
  run_test: 'play',
  finish: 'paper-plane-2',
}

export const STEP_ICON: Record<string, IconName> = {
  delay: 'stopwatch',
  'wait-serial': 'terminal',
  'expect-serial': 'terminal',
  'write-serial': 'terminal',
  'set-control': 'sliders',
  'expect-pin': 'wire',
  'wait-text': 'computer',
  'expect-text': 'computer',
  'expect-pixels': 'loader',
  'expect-servo': 'servo',
  'expect-tone': 'volume-up',
  'expect-led': 'lightbulb-3',
}

export const PART_ICON: Record<string, IconName> = {
  'wokwi-arduino-uno': 'frame',
  'wokwi-arduino-nano': 'frame',
  'wokwi-pi-pico': 'frame',
  'wokwi-led': 'lightbulb-3',
  'wokwi-resistor': 'resistor',
  'wokwi-pushbutton': 'button',
  'wokwi-ssd1306': 'computer',
  'wokwi-potentiometer': 'gauge-3',
  'wokwi-neopixel': 'sparkle-3',
  'wokwi-led-ring': 'loader',
  'wokwi-servo': 'servo',
  'wokwi-hc-sr04': 'signal-2',
  'wokwi-buzzer': 'volume-up',
  'wokwi-photoresistor-sensor': 'sun',
  'wokwi-dht22': 'cloud',
  'wokwi-pir-motion-sensor': 'eye-open',
  'wokwi-lcd1602': 'layout-bottom',
}
