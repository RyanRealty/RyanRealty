# SESSION_BOOT — how a fresh agent starts

Program: Admin Product OS. Constitution, PDS schema, seed catalog, design amnesia, and
phase blocks live in `docs/plans/ADMIN_REBUILD/ADMIN-UI-UNIFICATION-PROMPT.md` (the
pack). Runner procedure: `.claude/skills/admin-product-os/SKILL.md`. Read both by path —
do not assume slash commands or autoload worked.

## Resume ritual (every session, in order)

1. `pwd` — confirm repo root is `/Users/matthewryan/RyanRealty`.
2. `ls docs/plans/ADMIN_PRODUCT` — confirm this memory root exists. If it is missing you
   are pre-BOOT: run Block BOOT from the pack (and register `ADMIN_PRODUCT/` in
   `docs/DEVELOPMENT_PROCESS.md` in the same commit — G44).
3. Read, in order: this file → `state.json` → `work-queue.json` → `progress.txt`
   (last ~80 lines) → `decisions.md` → skim `process-registry.json`.
4. Summarize in ≤5 bullets: phase, locks, top queue id, blockers, last progress line.
   Print the summary BEFORE doing any work.
5. Execute ONLY the top `work-queue.json` item, unless Matt named a process or phase
   override in his message.
6. Flush at the end of every unit: `state.json` (`phase`, `updated_at`,
   `current_process`, `awaiting_lock`), `work-queue.json` (next item crystal clear),
   `process-registry.json`, append `progress.txt`, keep this file accurate.

## Rules that bind every session

- `state.json.phase` is the only "where we are." Do not jump ahead.
- Locks count only when written in `decisions.md`. Never start P5 before the process
  lock, never P6 before the IA lock.
- Design amnesia is on: blacklist and allowlist are in the pack. Shape (names, nav,
  routes, groupings) is NOT inherited from the current admin — only behavior and data.
- Deepen exactly one process per unit in P2, full PDS schema, no empty sections.
- Deepen order (Matt 2026-08-04): `broker-alert → inbound-respond → cma-deliver →
  prospecting → suppression-guard → other daily → weekly/rare`.
- New `.md` files under `docs/plans/ADMIN_PRODUCT/` are covered by the `ADMIN_PRODUCT/`
  package row in `docs/DEVELOPMENT_PROCESS.md` — do not add per-file rows. Do not create
  plan `.md` files anywhere else.
- Memory-only units are docs: batch them and push once per session via `npm run push`.
  Do not end a session with valued work only local and unrecorded.
- Stop states: `BLOCKED_ON_MATT: process|ia|visual|litmus` (with the decision-package
  path) or `HANDOFF: phase=… next=… file=docs/plans/ADMIN_PRODUCT/work-queue.json`.

## Current program state (maintained by the agent)

- BOOT + P1 + P2 + P3 completed 2026-08-04. **Process lock GRANTED** (decisions.md,
  Matt 2026-08-04). Phase is `P4_DATA`, no lock awaited.
- Locked set: 15 KEEP / 5 MERGE / 1 thin — plus 5 locked directives (one deal entity;
  supervision alarms off the wake rail; reply-on-thread joins the wake rail; prospecting
  primary in P5; CMA signs as assigned broker). All in decisions.md.
- 21 PDS files in `processes/`; registry rows `locked` with verdicts;
  `page-inventory.json` maps 160 routes.
- **P4 COMPLETE 2026-08-05** — `data-atlas.md`: 17 chains, 4 MERGEs folded,
  weekly-sla-review has its own chain (its destination is a P5 decision). All four
  flagged unknowns resolved with evidence (investigation record at the bottom of the
  atlas): listing edits revert on re-sync (chain broken); awaiting_broker_next is
  visible (P2 assessment corrected); place copy has no manual surface and regenerates
  unconditionally; CRM↔TC has zero bridge and /admin/deals reads the legacy
  skyslope_transactions mirror.
- **P5 IA LOCKED 2026-08-05** (decisions.md "P5 IA LOCK") — 11 destinations final
  (Today, Messages, People, Prospecting, Valuations, Closings, Oversight, Reports,
  Audiences, Content, Settings); tabs Today · Messages · Prospecting · People ·
  Oversight; amendment: DSCR → Reports; `cut-list.md` FROZEN; 160/160 routes
  dispositioned in `page-inventory.json`. Phase is `P6_VISUAL`.
- **P6 PACKAGE WRITTEN 2026-08-05, AWAITING VISUAL LOCK** — `design_system/admin/`:
  `tokens.css` (Radix-derived light+dark, every pair contrast-computed),
  `ADMIN_UI.md` (thesis, 6 patterns, computed AA tables, header Option A left-rail
  recommended vs Option B, dark-mode ship-both, amnesia test, scorecard 8.5),
  `screens/{today,messages,oversight}.html` — browser-verified at 1280 + 375 in both
  themes (server: `admin-mockups` in `.claude/launch.json`, port 8094).
- **Next unit: NOTHING until Matt writes the visual lock into `decisions.md`.** When
  he does (header option + dark-mode + overall approval): set `locks.visual`, clear
  `awaiting_lock`, advance phase to `P7_PRIMITIVES` (components/admin/v2 primitives
  from the locked language + token-gate exemption widening). P8 litmus after that.
