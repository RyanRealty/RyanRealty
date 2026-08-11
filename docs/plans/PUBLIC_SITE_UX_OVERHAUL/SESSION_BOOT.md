# SESSION_BOOT — Public Site UX Overhaul

Program: **Public site reimagine** — every page, every section, competitor-scored.  
Constitution: `README.md` in this folder.

## Resume ritual (every session)

1. Confirm repo root is RyanRealty.  
2. Read in order: this file → `state.json` → `work-queue.json` → `progress.txt` (last ~50 lines) → `decisions.md`.  
3. If ledgers exist, skim counts: `inventory/PAGE_LEDGER.json` and `SECTION_LEDGER.json` (unaudited / audited / shipped).  
4. Print ≤6 bullets: phase, locks, top queue item, ledger remaining, blockers, last progress — **before** work.  
5. Execute only the top ready `work-queue.json` item unless Matt overrides.  
6. End of unit: update `state.json`, queue, append `progress.txt`, update ledgers if touched.

## Hard rules

- **Sacred only:** navy/cream + Amboqia/Geist.  
- **§0 + brand voice** absolute.  
- **Every page and every section** must appear in the ledgers; no silent orphans.  
- **Competitive matrix** required before disposition “keep” or “ship.”  
- **Design amnesia** until IA + visual locks are in `decisions.md`.  
- **No production restyle** of families before those locks (P0 bugs/measurement OK).  
- After locks: pages compose **library sections only**; ratchet legacy → 0.  
- Render proof closes findings; code inspection does not.  
- Admin Product OS is out of scope.

## Tracks

- **T Truth** — inventory, audit, competitive, journeys  
- **S System** — IA, visual, section library, primitives  
- **R Roll** — ship spines then drain every page  

## Current state

See `state.json` (source of truth).
