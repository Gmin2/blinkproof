# blinkproof, neatHack 2026

## project
blinkproof is wokwi for ai agents. you describe a gadget in plain words, the agent picks the board, wires the
circuit, writes the firmware, runs it in a simulator in your browser and has to pass a test before it hands the
build over. every step is traced in neatlogs, and neatlogs investigations are how the agent gets better.

## team
- Gmin2

## stack
- simulator: avr8js (uno, nano) and later rp2040js (pico), both mit, the same code runs in the browser and in node
- part drawings: @wokwi/elements 1.9.2 (mit)
- compile: arduino-cli in docker, no network, a fixed library list
- agent: claude through the neatHack litellm proxy
- neatlogs for traces, detections and investigations, Entire for checkpoints, cfo.ai for the business plan

## build log

### 2026-10-11 01:15 ist
done
- workspace with `sim` (the engine) and `web` (the canvas)
- uno on avr8js with 2k of ram like the real chip, pins by arduino name, serial, adc, i2c bus
- ssd1306 oled model that can read text back off the screen, so tests check what a person would see
- blink and an oled sketch compiled with arduino-cli in docker (about 2s each)
- tests: blink every 500ms, oled shows "blinkproof" and the pot value, a wrong i2c address leaves the screen black
  (`pnpm -C sim test`, 3 passing)
- browser: uno, led, oled and pot on a dark canvas, wires drawn from each part's real pin positions, the sketch
  running live, turning the pot changes the number on the oled

found
- the adafruit oled library never checks that a screen answered, so a wrong address prints "oled ok" and the screen
  just stays black. the same happens on a real board. this is exactly the kind of mistake the agent has to catch
  with a test, not with the serial log

next
- compile service, a circuit file (diagram.json) the agent writes, neopixel, servo, button, ultrasonic, buzzer
- scenario runner

### 2026-10-11 entire and cfo.ai
- git init, `entire enable --agent claude-code` (entire cli 0.11.4), hooks and `.entire/settings.json` in place
- business inputs for cfo.ai written in `business.md`

### 2026-10-11 02:50 ist, slice 1 compile service
- `docs/plan.md`: 12 slices in order, each with a done when and an oracle. research notes go in `research/notes/`
- compile service: arduino-cli in docker behind http, cache, library allowlist, gcc errors with lines, flash and ram
- the canvas compiles sketches itself now
- found: arduino-cli's ram number leaves out malloc, so the oled's 1k buffer is invisible to it. the sim has to catch it

## demo
pending

## known limitations
- wires are a simple two bend route for now, they cross parts
- no electrical simulation, pull-ups and resistors will be checked by rules instead

## submission
- neatlogs traces: pending
- entire checkpoint link and id: pending
- cfo.ai plan: pending
- video: pending
