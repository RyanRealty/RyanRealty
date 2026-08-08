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

**The live phase is always `state.json.phase` — read it first. The bullets below are
history in the order it happened, and each names the phase it closed; a phrase like
"Phase is `P4_DATA`" is what was true THEN, not now.**

- BOOT + P1 + P2 + P3 completed 2026-08-04. **Process lock GRANTED** (decisions.md,
  Matt 2026-08-04). Phase moved to `P4_DATA`, no lock awaited.
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
- **P6 VISUAL LOCKED 2026-08-05** (decisions.md "P6 VISUAL LOCK") — locked language:
  `design_system/admin/tokens.css` + `ADMIN_UI.md` (six patterns; tile boards
  retired; Oversight = verdict + needs-you pattern after Matt's rework round) +
  three reference screens. Header Option A left rail; dark mode ship both; the
  locked 5-tab phone bar. Local preview server: `admin-mockups` (port 8094,
  launch.json is gitignored/local).
- **P7 COMPLETE 2026-08-05** — `components/admin/v2/`: 10 primitives + admin-v2.css
  + tokens.css (byte-copy of the locked spec). New gate `ci:admin-v2-tokens`
  (`scripts/check-admin-v2-tokens.mjs`): tokens parity, var(--a-*)-only color,
  brand-leak + legacy-import ban — in the ci:gates chain. Brand token gate now
  exempts `app/admin/` + `components/admin/v2/` (baseline ratcheted 314→267).
  No pages migrated (by design).
- **P8 COMPLETE, LITMUS SIGNED OFF 2026-08-05** (decisions.md "P8 LITMUS
  SIGN-OFF") — re-proof on current main (LITMUS.md re-proof section: 2 taps,
  ~4.2s kickoff, real SMS rail, worker draft 44s, zero-residue cleanup) + the
  stale-session deep-link defect Matt's phone found, fixed at 3 redirect sites
  (2b0286b5), deployed, confirmed live. ALL FOUR LOCKS GRANTED.
- **P9 FINISH ROUND COMPLETE (2026-08-05, prod c48f653):** all 11 locked
  destinations LIVE on the v2 language (Today, Messages, People, Prospecting,
  Valuations, Closings, Oversight, Reports, Audiences, Content, Settings);
  locked 5-tab bar complete; P10 gates landed (ci:admin-nav-ia parity +
  ci:admin-contrast computed-AA, both in ci:gates); wake-up deep links repointed
  to /admin/people/[id] and the litmus RE-TIMED on production (2 taps, address
  prefilled, ~3.5s kickoff). Bonus incident closed: the 23h-stuck delta cursor
  (numeric overflow class) — clamp at the mapper chokepoint, heal verified.
- **P11 INTERIOR MIGRATION COMPLETE 2026-08-07** (8d60e4d1) — 143/143 admin
  pages import `@/components/admin/v2`; `ci:admin-ui` rule B (legacy pages)
  reads **0**, down from 131. The ratchet is shrink-only: re-seed with
  `--write-baseline` and commit the smaller baseline only when counts genuinely
  drop.
- **P12 CORRECTNESS is the live phase** (`state.json.phase = P12_CORRECTNESS`).
  Units shipped: entity-scope gate + three scope fixes (unit 1–2), SMS send
  idempotency incl. the pre-hydration window (unit 3). The queue in
  `work-queue.json` is the worklist; `progress.txt` is authoritative over any
  queue note that predates it.
- **11F (the P11 tail) runs alongside P12.** Pages are on v2 SHELLS but many
  still MOUNT legacy client islands, which token-gate rule 3 blacklists — so
  only some pages sit inside `ci:admin-v2-tokens`. Unit 1 took crm/reporting
  (`4c0186e1`), unit 2 the shared CRM config-table editor (`a76013b4`,
  `629564b5`), unit 4 the nine operations panels (`168060e8`): **106 of 170
  admin pages token-gated**, up from 86, and the `ci:admin-ui` ratchet re-seeded
  smaller (104 raw elements, 11 widths). Pick the next family by
  pages-per-shared-island, not by page count.
- **The v2 barrel is the pressure valve.** When a migration needs a control the
  barrel lacks, ADD THE PRIMITIVE — never widen a ratchet baseline and never
  reach back into `components/ui`. It now carries Button, IconButton, Switch,
  Dialog, ConfirmDialog, **Sheet, Menu, SearchField**, ToolbarSelect,
  ToolbarCheck, the Field family, ReportGrid, and the `av2-subnav` /
  `av2-cardlist` / `av2-reorder` patterns. Every one requires its accessible
  name in the TYPE, so a nameless control cannot compile.
- **A surface that SENDS is gated around its composer, never through it.**
  people/[id], email/compose, dscr and crm/inbox all mount the canonical
  SmsComposer / EmailComposer that `ci:composer-discipline` requires; those files
  stay file-form in SCAN_DIRS with the reason at the entry. Forking the one send
  interface to satisfy a colour gate defeats the gate that matters more.
- **Wiring the gate is part of the unit.** Twice now a migration finished and the
  pages were never added to SCAN_DIRS — work done, invisible to CI, and absent
  from the coverage count. Check `TOKEN-GATED n of 170` before calling a unit
  complete.
- **A gate that inspects code reads the AST, never the text.** Twice in one
  session a text-scanning check matched its own explanatory COMMENT: the new
  `ci:server-type-reexport` matched its worked example, and `ci:admin-ui` rule D
  matched a `max-w-*` token inside the comment explaining that token's removal.
  Both are AST-based now, and rule D's width count fell 11 → 9 once comments
  stopped counting. Regression-prove a gate three ways: green clean, FIRES on the
  re-injected bug, green again.
- **A dead orchestrator is not a dead unit.** When a Workflow process exits
  mid-run, the agents' EDITS are already on disk — only their self-reports are
  lost, and those were never evidence. Verify the tree, not the transcript:
  diff each file against its pre-migration content on behavioural signals
  (server actions, FormData fields, state, handlers, aria/role/name attrs).
- **A 404 on `/` means the SERVER, not the code.** A live next-server can serve
  404 for every route while the files exist and every gate is green; restart via
  `preview_start`. curl then getting 403 is the bot screen working, not a fault.
- **The token gate reads IMPORTS, not appearance.** It bans `components/ui`
  imports, raw hex and Tailwind PALETTE classes — it does NOT see shadcn
  *semantic* classes (`bg-card`, `text-foreground`, `text-muted-foreground`,
  `border-border`), which render the PUBLIC palette. Nine operations panels had
  8 import violations and 298 semantic classes. Grep those names per file before
  migrating, and assert 0 inside the page's own `.av2-scope` after.
- **Verify by loading routes at 375 AND 1280 and asserting visible-control
  COUNTS.** Status codes are not enough: a settings page shipped rendering every
  row's toggle, rename and delete twice with every gate green (`md:hidden` plus
  an inline `display` — the inline style wins). A responsive class and an inline
  display property on one element is always a bug.
- **Two gates measure different things — do not read one as the other.**
  `ci:admin-ui` = the migration ratchet (legacy pages, raw elements, widths).
  `ci:admin-v2-tokens` = what is inside the *scanned* paths (color, brand leak,
  legacy imports). A page can pass the first and be invisible to the second.
