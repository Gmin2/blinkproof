# blinkproof business inputs (for cfo.ai)

paste these into cfo.ai, then export the plan and link it in the readme.

## one line
an ai that builds arduino and pico gadgets from plain words and has to prove they work in a simulator before handing them over.

## problem
chat ais write hardware code that looks right and fails on the bench: wrong pins, missing pull-ups, out of memory, 5v parts on 3.3v boards. makers burn parts, teachers cant debug 30 breadboards, startups lose days on proof of concept firmware.

## customers
- makers and hobbyists, self serve monthly
- schools and bootcamps, per student per year
- hardware startups and product teams, per seat
- ai coding tools and agent platforms, api per build

## market
- arduino: 33m+ active users, about 30k business customers
- tinkercad: about 100m users
- educational robotics kits: about $2.3b to $3.2b in 2025, growing 12 to 19% a year
- investors are funding "cursor for hardware" (schematik $4.6m, diode $11.4m series a, quilter $10m), none of them proves the build works

## pricing
- free: 5 proven builds a month
- maker $9/mo: 40 proven builds, then $0.20 each
- classroom $4 per student per year, min $199 per school: auto graded assignments with the same tests
- team $29 per seat per month: shared workspace, ci on every push
- api / mcp: $0.25 per proven build, $0.05 per verify only call

## costs
- llm per build: about $0.30 on sonnet (range $0.15 to $0.80), about 95% of cost
- compile and sim: under $0.002 per build
- hosting: one small aws box to start, about $40/mo
- the learning loop is the margin: every point of first try pass rate cuts fix loops and moves steps to a cheaper model. target $0.12 per build by month 6

## assumptions to model
- month 1: 300 free users, 3% convert to maker
- grow users 25% a month for 12 months
- 2 schools signed by month 4, +2 a month after
- 1 api customer at 2k builds a month from month 6
- average maker uses 20 builds a month
- solo founder, no salary first 6 months, then 1 hire at $3k/mo

## scenarios
- base: cost per build drops from $0.30 to $0.12 by month 6
- bad: cost stays at $0.30, maker plan loses money above 30 builds, so cap stays at 40
