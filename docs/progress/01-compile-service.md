# slice 1: the compile service (done)

**why:** the agent and the canvas both need to turn a sketch into a hex on demand. before this the canvas imported
hex files built by hand into gitignored folders.

**built**
- `compiler/`: `compile(board, files)` runs arduino-cli in the `bp-avr` image with no network, 1g of memory and 2
  cpus, two builds at a time
- boards: uno, nano, mega
- a cache by sha256 of board and sources in `.cache/compile/`. builds that fail on the code are cached too, builds
  that fail for no reason gcc gave (docker down, a timeout) are not
- `#include` checked before docker starts: the libraries baked into the image, core headers, `avr/`, `util/`,
  `Fonts/`, and local files. anything else is refused with its line and the list of what is there
- gcc errors come back as `{file, line, col, severity, message}`, and flash and ram from arduino-cli's summary,
  so the agent can see how much of the 2k it used
- `node src/server.ts` on 127.0.0.1:5200, `POST /compile`, `GET /health`. vite proxies `/api` to it
- the canvas compiles the sketch source itself and shows compile time, flash and ram in the header. pause no longer
  restarts the sim

**oracle:** blink through the service gives the same hex, byte for byte, as arduino-cli run by hand.

**caught**
- the ram number arduino-cli prints leaves out malloc. hello-oled shows 579 of 2048 b, but the oled library
  mallocs its 1024 b screen buffer at runtime. the agent cannot trust that number for the ram bug, the sim has to
  catch it. a test pins this down

**numbers:** 8 compiler tests, about 2s a cold build, under 100ms cached.

**next:** slice 2, the circuit file.
