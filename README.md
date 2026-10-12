# blinkproof

wokwi for ai agents. you describe a gadget in plain words, the agent picks the board, wires the circuit, writes the
firmware, runs it in a simulator and has to pass a test before it hands the build over. every build is traced in
neatlogs, and what neatlogs finds in those traces is how the agent gets better.

- `sim` the simulator: uno and nano on avr8js, pico on rp2040js, parts, wiring rules, test scenarios
- `compiler` arduino-cli in docker behind http
- `agent` the agent, its tools, the server and the evals
- `web` the canvas you watch a build on
- `evidence` eval results and the neatlogs writeup

## for the judges

the neatHack rubric, item by item, and where the proof is. everything under `evidence/` is committed and comes from
real runs. the items that have no proof in the repo yet are marked as missing, not described.

### agent (30)

an agent that goes from words to a passing build with no one watching.

- the agent can not hand over a build that fails its test. `finish` refuses until `run_test` passes on the current
  circuit and sketch (`agent/src/tools.ts`, the `finish` case)
- 22 eval cases across uno, nano and pico, each scored by a hidden test the agent never sees (`agent/evals/cases.ts`,
  `agent/evals/run.ts`)
- results for four prompt versions, every case with turns, tokens, the hidden test result and the trace id:
  `evidence/eval-base.md`, `evidence/eval-v2.md`, `evidence/eval-v3.md`, `evidence/eval-v4.md`, plus the raw `.json`
  beside each. 22 / 22 on base, v2 and v3, 21 / 22 on v4
- failure and recovery: proximity-alarm on the base prompt failed its own test, ran `run_test` 6 times and still
  shipped a pass after 18 turns (trace `9e801c3f0e0f0e2f882adbce0287210e`). the cause and the fix are in
  `evidence/neatlogs.md`, item 1, and on v2 to v4 the same case passes in 7 to 9 turns
- what the agent still gets wrong: press-digit on v4 ran out of turns, written up under "what this does not show" in
  `evidence/neatlogs.md`

### tool use (25)

**neatlogs.** every build is traced with the neatlogs sdk (`agent/src/agent.ts`, `trace` and `wrapOpenAI`). there is one
agent trace per build, a span per tool call, `finish` as a guardrail and a span for the verdict.

- the improvement loop, with before and after numbers: `evidence/neatlogs.md`. it covers five problems found in the
  traces, the fix for each and the turns and tokens per flagged case from base to v4
- neatroots, neatlogs' local run checker, read the same traces. `evidence/neatroots/home.jpg` is the baseline view,
  25 runs, 16% with problems. `evidence/neatroots/proximity-alarm-base.jpg` is the flagged run
- every trace id in the eval tables can be looked up

**Entire.** enabled on the repo since the first commit (`.entire/settings.json`). missing: no checkpoint is saved
yet, so there is no checkpoint link or id to show.

**cfo.ai.** missing: the business plan is not in the repo yet.

### demo video (20)

missing: no video yet.

### building in public (15)

- the public repo, about 80 commits, all dated inside the hack (first one 2026-10-11 02:04 ist). each pr says what
  changed and what was found
- missing: no #neatHack posts are linked yet

### originality (10)

no other entry we have seen does hardware. the agent proves its build in a simulator before it hands it over, and the
simulator fails the way a real board does. a backwards led stays dark, an oled on the wrong i2c address stays black
while the serial log still says ok, and a 100 sample average on the uno runs out of its 2k of ram and reboots in a loop
while arduino-cli reports 988 of 2048 bytes and is happy. the wiring rules are built from datasheet numbers
(`sim/src/rules.ts`).

## run it

```
pnpm install
pnpm test                               # sim, compiler and agent tests
pnpm -C agent eval --check              # hidden tests on the reference sketches, no model calls
pnpm -C agent eval --model claude-haiku # the full eval, needs .env with the proxy and neatlogs keys
pnpm -C agent serve                     # the agent server the canvas talks to
```
