# blinkproof brand

the press kit and the code that makes it. everything in `kit/` is built from these sources: `src/mark.mjs` (the led), `src/favicon.mjs` (the tile, with the 16px drawn by hand), `src/logo.mjs` (the outlined wordmark), `src/pictos.mjs` (the outline parts) and `tokens.json`. change a source, run `pnpm -C brand build`, every asset regenerates. open `kit/index.html` to see it all.

## the look

quiet and warm. a paper ground, ink type, and thin stone lines that cut the page into cells. the parts a gadget is made of (an led, a resistor, a chip, a button, a knob, a square wave) sit in the cells as outlines, big, and get cropped by the edges. no mascot, no gradients, no shadows except the soft one under a code window.

## the rules

1. three brand colours: paper `#FBFAF9`, ink `#343433`, stone `#D1CAC2`. stone is for lines and outlines only, never for text.
2. the mark is a 5mm led side on, one filled path in ink. its two legs must stay apart at 16px, `build/verify.mjs` fails the build if they merge.
3. one face: geist medium for titles and the wordmark at -3% tracking, geist mono for code and labels. the wordmark is outlined so nothing needs the font.
4. og cards come in two kinds. grid: the title in one cell, outline parts in the others, 3px stone lines, mirrored left or right. code: a white window with three grey dots and a file name, a real sketch or test inside, running off the bottom right edge.
5. pictograms are strokes only, 3px at og size, round caps and joins, stone. one per cell, never two.
6. brand colours and ui colours are different things. the editor keeps its own accent, ok, bad and warn.
7. the app uses nucleo line icons. the led mark is the only filled icon.

## whats in kit/

```
logo/     mark, wordmark and lockup in ink, paper, white and stone, two png checks
pictos/   ten outline parts as svg and a sheet
tokens/   tokens.json, tokens.css, theme.ts
app/      icon 1024 and 512, apple touch 180, favicon 16 (by hand) 32 48, svg and ico. a paper led on an ink tile, so it reads on light and dark tabs
og/       grid cards (home, a release, docs, pico support) and code cards (blink.ino, test.yaml)
social/   avatar 400, x header 1500x500
```
