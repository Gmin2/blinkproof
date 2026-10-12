# neatlogs and neatroots: finding and fixing what the agent wastes

the agent is traced with the neatlogs sdk on every build (`agent/src/agent.ts`, `trace` and `wrapOpenAI`). in production
the traces go to neatlogs cloud. for this loop the same traces went to [neatroots](https://github.com/neatlogs/neatroots),
neatlogs' local run checker, by pointing `NEATLOGS_ENDPOINT` at it. no agent code changed for that.

the loop: run the 22 eval cases (hidden tests, uno, nano and pico), let neatroots check every run, read the flagged runs
through its mcp tools (`list_findings`, `get_run_outline`, `get_span`), fix the agent, run again, compare.

## the numbers, one run of 22 cases each, claude haiku 4.5

| prompt | passed | tokens | turns | test runs | median tokens |
|---|---|---|---|---|---|
| base | 22 / 22 | 1,172,426 | 194 | 42 | 44,596 |
| v2 | 22 / 22 | 1,172,031 | 189 | 39 | 44,782 |
| v3 | 22 / 22 | 1,100,745 | 180 | 35 | 42,301 |
| v4 | 21 / 22 | 1,393,869 | 206 | 42 | 42,149 |

## the runs neatroots flagged, turns / tokens

| case | base | v2 | v3 | v4 |
|---|---|---|---|---|
| proximity-alarm | 18 / 127k | 9 / 55k | 7 / 41k | 7 / 42k |
| lcd-thermometer | 16 / 108k | 9 / 54k | 21 / 150k | 7 / 42k |
| night-light | 11 / 64k | 7 / 38k | 8 / 46k | 6 / 33k |
| nano-near-far | 11 / 69k | 9 / 56k | 7 / 42k | 7 / 41k |
| pico-plant | 13 / 88k | 21 / 168k | 7 / 42k | 10 / 68k |

these were the most expensive runs in the baseline. the two spikes after it each had a new cause, found the same way and
fixed the next round: pico-plant in v2 (a compile that failed with nothing to fix, 2 below) and lcd-thermometer in v3
(floats on the uno, 4 below).

## what neatroots found, and the fix

**1. repeated run_test, in 4 of 22 baseline runs.** neatroots' `repeated-tool-call` check fired on proximity-alarm
(run_test 6 times), lcd-thermometer, nano-near-far and night-light. reading the spans showed the cause was not the tool:
- proximity-alarm and nano-near-far tested right at the distance threshold (20 cm, 30 cm). the simulated sonar reads a
  cm under, so the check flipped and the agent rewrote a correct sketch five times. trace `9e801c3f0e0f0e2f882adbce0287210e`
- night-light's test waited for a serial line "boot" the sketch never printed. trace `841447adb9731915b9dec6e91b5215b5`
- lcd-thermometer wrote rows longer than 16 characters, then checked before the start screen cleared. trace `9350f5aabfc11fb083222c4d31b01514`

fix (v2): the prompt says to write the test from the sketch, never to test on a threshold, to wait for the main screen,
and that attrs are strings. the lcd note says a row holds 16 characters.

**2. a compile that failed with nothing to fix (v2, pico-plant).** the first pico build failed on the build server, the
agent got arduino-cli's library list as the error, then `run_test` answered `compile_errors: []` three times. fix (v3):
a failed build with no compiler error is retried once and the agent is told it was the server, not its sketch.

**3. edges in other forms (v2, pico-plant and blink).** exact percentages a knob rounds, and checking a blink at the 500 ms
switch. fix (v3): the edge rule covers knobs, percentages and timing.

**4. floats on the uno (v3, lcd-thermometer, 151k tokens).** `sprintf("%.1f")` prints `?` on avr, the agent read that as
a broken sensor. fix (v4): the prompt says so, and to use `print(value, 1)` or `dtostrf()`.

**5. a half drawn lcd (v4 check runs, `runaway-loop` and `token-budget` findings).** `lcd.clear()` every loop over slow
i2c let the test read the screen mid redraw. fix (v4): the lcd note says to overwrite padded text instead.

## what this does not show

one run per prompt is noisy on haiku: the whole suite swings around 20% in tokens from run to run, and every run has a
new long tail case (v4: press-digit wired its 7 segment display without its resistor and ran out of turns, dark-light
misread which way the light sensor goes). the totals above are not a claim that v4 is cheaper overall. the claim is
narrower: every pattern neatroots flagged was found from the trace and fixed, and the fixed cases end at 6 to 10 turns.

## files

- `eval-base.md`, `eval-v2.md`, `eval-v3.md`, `eval-v4.md` and the `.json` beside them: every case, turns, tokens, the
  hidden test result and the trace id
- `neatroots/home.jpg`: neatroots after the baseline, 25 runs, 16% with problems
- `neatroots/proximity-alarm-base.jpg`: the flagged baseline run, run_test 6 times, 18 llm calls, 127,474 tokens
