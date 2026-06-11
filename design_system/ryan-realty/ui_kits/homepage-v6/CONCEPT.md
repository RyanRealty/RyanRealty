# Homepage v6 — LOCKED (Matt, 2026-06-11)

**Concept pick:** #3 — **Linear finish on v6 bones.**

**Tagline:** The city is the homepage.

**Visual anchor:** [Linear](https://linear.app) product discipline — precision over theatrics. Not cinema.

## Keep (v6 bones)

- Live city hero (Google 3D Tiles with static poster fallback)
- Natural-language ask bar
- Deal-flow activity (market events as first-class UI)
- Neighborhood ledger with verified stats + source line
- Coordinates / camera readout as data chrome

## Finish (Linear discipline)

| Rule | Implementation |
|---|---|
| Precision over theatrics | Hairline 1px borders, glass panels, micro-tracked labels, 8px spacing ladder |
| Type gets quieter | **One Amboqia moment** — hero H1 only. Geist 400/500/600 everywhere else |
| Data UI is the jewelry | Deal-flow cards, ledger rows, coords panel — terminal-grade polish |
| Motion = engineered | **150ms** ease-out only. No float, no cinematic drift, no marquee scroll |
| Boundaries | Static 1px strokes. No dash-draw animation |

## Mockup

`index.html` — open locally. Optional `?key=` for Google 3D Tiles (never commit keys).

## Production status

**Concept artifacts only.** `app/page.tsx` still runs HomepageHeroV3 until Matt approves the finished mockup and a production build is scheduled.

## Data slots (wire to DAL at build)

All figures mirror 2026-06-10 SSR snapshot:

- Active SFR: 1,808 (region)
- Median list: $740,000
- Neighborhood rows: `market_pulse_live` per Bend district
- Deal-flow cards: `activity_events` / pulse feed
