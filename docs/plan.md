# blinkproof plan

you describe a gadget, the agent picks the board, wires it, writes the firmware, runs it in the simulator and has
to pass a test before it hands it over. neatlogs traces every step and is how the agent gets better.

## how we build
- **one slice at a time, in this order.** a slice starts crude, runs for real, then hardens one concern at a time.
  never start a slice on top of one that has not been run.
- **no reference, no guessing.** when a slice needs facts we have no checked source for (a part's timing, a file
  format, how a library drives a pin), research sub-agents fetch and quote real sources into `research/notes/`
  with links, and name the oracle. then we build.
- **every slice has an oracle.** the real library running on our sim, the datasheet's numbers, arduino-cli's own
  output. "looks right" is not a check.
- after each slice: a note in `docs/progress/`, a line in `hackathon.md`, one pr.

## slices

| | slice | done when | oracle |
|---|---|---|---|
| 0 | sim core: uno, i2c, ssd1306 with text readback, canvas | blink and oled tests pass, pot changes the screen | real adafruit library on the sim |
| 1 | compile service: http around the bp-avr image, hash cache, library allowlist | blink compiles through the api, same hex as the cli; an unknown `#include` is refused with a clear error | arduino-cli |
| 2 | the circuit file: wokwi style `diagram.json`, canvas draws from it, the sim binds parts by their connections | hello-oled runs from a file, nothing hardcoded; moving the oled to other pins breaks it like a real board | wokwi diagram format docs |
| 3 | parts: button, neopixel, servo, hc-sr04, buzzer | each part driven by its real arduino library gives the datasheet numbers (servo angle from pulse width, distance from echo time, pixel colours, tone frequency) | datasheets, the libraries |
| 4 | scenario runner: set, wait, expect on pins, serial, screen text, pixels | one file runs the same in node and in the browser, and a wrong sketch fails on the right step | wokwi automation scenarios |
| 5 | the parking sensor by hand | its scenario passes; the oled plus 16 pixels version runs out of ram and the test catches the black screen | the uno's 2k ram |
| 6 | rules: pull-ups, 5v on 3.3v, led without resistor, two parts on one pin, i2c address clash | each broken circuit fails on the right rule, the good ones pass | datasheets |
| 7 | agent tracer bullet: prompt to diagram, sketch and scenario, then compile, run, test, fix; neatlogs spans | "a night light with a button" goes from words to a passing test | the scenario |
| 8 | the build on screen: parts drop in, wires draw, code types, test runs | the whole build plays live in the browser | watching it |
| 9 | evals: 15 gadgets, v1 numbers in neatlogs | a pass rate per gadget, failures grouped | neatlogs |
| 10 | steering and fixes: neatroots checks, check_my_work, investigate, v2 | v2 beats v1 on pass rate and notes per build | neatlogs investigate |
| 11 | pico on rp2040js | the plant monitor passes on a pico | arduino-pico on the sim |
