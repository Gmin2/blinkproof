# blinkproof brand

the press kit and the code that makes it. everything in `kit/` is built from three sources: `src/mascot.mjs` (the firefly body and its five states), `src/logo.mjs` (the outlined wordmark) and `tokens.json`. `src/pixels.mjs` holds the 16px firefly, drawn by hand. change a source, run `pnpm -C brand build`, every asset regenerates. open `kit/index.html` to see it all.

## the firefly

the firefly blinks a light to say something, and a wrong pattern gets it eaten. it is the agent doing the work, and its lantern is the proof. the body never changes, only the eyes and the lantern.

| state | eyes | lantern | where |
|---|---|---|---|
| idle | half lidded | dark | empty canvas, waiting for a prompt, docs |
| building | small, looking down | dark | the agent picks parts, wires, writes firmware |
| testing | wide | blinks 500ms on, 500ms off, dim | the test is running |
| failed | flat squints, drops 4 | two red flashes, then dark | a step failed. the log says what, not the firefly |
| proven | happy arcs, lifts 4 | steady glow with a halo | the test passed, the build is handed over |

## the rules

1. the body is fixed. swap only the eyes and the lantern, never redraw the outline for a mood.
2. the lantern lights only for proven. it blinks while testing, flashes red for a failed step, and is never decorative.
3. the mark is one filled path with the eyes as holes, so it stays one colour at any size. at 16px use the hand drawn pixels, not a scaled outline. `build/verify.mjs` fails the build if the eyes close up.
4. one colour owns it: glow `#A6F24A`, on ink `#141414`. never glow text on paper, it fails contrast. on paper glow is only the lantern and the dot of the i.
5. brand colours and ui colours are different things. the ui keeps its own accent, ok, bad and warn. glow means the whole gadget is proven, ok means one check passed.
6. one face: geist, with geist mono for the voice of the machine (serial, pins, test steps, the og kicker). the wordmark is geist semibold at -2% tracking with the dot of the i swapped for a round led, outlined so nothing needs the font.
7. the firefly never explains a failure. the written test result does, the firefly only reacts.
8. the mark is the only filled icon in the app. everything else is a nucleo line icon.
9. og cards: lockup top left, title bottom left, a mono kicker led by an led (lit when proven, dark when not), the firefly peeking from the bottom right. ink for home and projects, paper for docs.

## whats in kit/

```
mascot/   five states as character svg and png, one colour marks, states.json with the raw paths, sheet.png
logo/     mark, wordmark and lockup in ink, paper and white, a lit lockup, two png checks
tokens/   tokens.json, tokens.css, theme.ts
app/      icon 1024 and 512, apple touch 180, favicon 16 (hand drawn) 32 48 and an svg that follows the theme
og/       home, a proven project, an unproven draft, docs, blog
social/   avatar 400, x header 1500x500
bitmap/   firefly.h, the firefly as PROGMEM arrays for an ssd1306
```
