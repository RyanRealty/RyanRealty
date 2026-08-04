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

- BOOT + P1 + all of P2 completed 2026-08-04. Phase is `P3_PROCESS_LOCK`,
  `awaiting_lock: process`.
- 21 processes deepened — full PDS files in `processes/`, registry all `deepened`,
  `page-inventory.json` maps 160 routes.
- The P3 decision package (verdict table, fix-the-class list, 5 open questions) is in
  `decisions.md` under "P3 PROCESS LOCK PACKAGE — AWAITING MATT".
- **Next unit: NOTHING until Matt writes the process lock into `decisions.md`.** When he
  does: append his verdicts, set `locks.process`, clear `awaiting_lock`, advance phase to
  `P4_DATA`, and run the P4 block (data atlas for KEEP processes only — P4-flagged
  unknowns are listed at the end of the decision package).
