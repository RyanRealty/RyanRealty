# Current — 2026-09-13 15:30Z (grok-4.6 is the round judge, through Cursor)

Surface: Cursor (Claude Fable), primary checkout `/Users/matthewryan/RyanRealty`, on `main`.

- **Done this pass (`9819b477`, `6af8108d`):** the WHOLE table is re-scored on **grok-4.6 through the Cursor CLI** (`cursor-agent -p --mode ask --model cursor-grok-4.6-high`, auth `CURSOR_API_KEY` from `.env.local` — it draws on the Cursor plan, so it is the subscription, not a per-token console; the no-APIs rule is otherwise unchanged). 27/27 classes, 3 scorings each, on the 2026-09-12T23-38-57 production shots, run as three parallel `--cursor --evaluate-only --classes` lanes (~100 s per scoring). `instrument.evaluatorModel grok-4.6`, `judgeLink cursor`. **Range 42 (cities) → 67 (reviews); nothing at 70; `demoMatch: true` only on place-type and reviews.** Every row carries `demoMatch`/`demoMatchVotes`/`runDir`/`shotsHash`; `tableRowsBindFrom` = 2026-09-13 so `ci:rubric-freeze` holds all 27 (OK). Bottom of the table on this judge: cities 42, subdivisions 43, contact 50, market-report 51, oregon-city 51, place-type-community 52, zip 52.
- **Rise floor is now 3** (`RISE_FLOOR`, `RISE_FLOOR_FROM 2026-09-13`), re-derived from this table's own 81 scorings: residual sd 2.24 (sonnet was 4.84); P(noise rise ≥1) 30%, ≥2 12%, ≥3 4.1%. Definition fixed in `scripts/taste-rise-floor.mjs`: the floor is the SMALLEST rise k with P(noise rise ≥ k) ≤ 5% (the old 95th-percentile *value* let noise pass 12% here, 6.6% on sonnet). Sonnet basis + the partial repeat kept as `riseFloorBasis.priorBasis`. **Rule: any re-score of the table re-derives the floor in the same change.**
- **Cursor CLI traps fixed (`9819b477`):** bare `--model grok-4.6` is answered silently on an unnamed model (Auto trap) — judge pinned to `cursor-grok-4.6-high`, verified against the account's list each run; `--list-models` prints "No models available" on this CLI build while models exist — list read from the CLI's refusal of a fake id (`cursorModelListText`). `cursor-agent login` (browser) never completed on this Mac; the key path is live and is the one in use.
- **Next:** the queue. `npx tsx scripts/site-queue-status.ts --json`, bottom of the table first (cities 42, subdivisions 43, contact 50, market-report 51). A node is done when grok-4.6 (Cursor link, or grok CLI once Grok Build has balance) scores the class ≥ prior + 3 with `demoMatch: true` — receipt shape in `scripts/lib/taste-receipt.mjs`. `.taste-table/2026-09-12T23-38-57-170Z` is the shot set behind every row.
- **Untracked, not mine to delete:** `live-home-fold.png` (repo root), `design_system/ryan-realty/ui_kits/place-type/shots/_film-check.png`, `…/desktop-mcp.png`.
- **Open PRs (7), on purpose:** #206 (live Claude lane), #207 (SITE-90, live cloud lane), #208 SITE-99 and #209 SITE-100 (stale claims, unlanded work), #183 / #192 / #194 (prospecting + CMA admin fixes, 2026-09-04 — Matt: land or close).
- **Worktree left in place:** `../RyanRealty-wt-site-90-20260912` (`cursor/site-90-about-fold-deb7`, live SITE-90 owner). WIP on local `wt/site-76-oregon-city-20260910`, `wt/site-79-reviews-20260910`; tag `archive/wt-site-72-20260910`.
- **Blockers:** none. Claude CLI weekly limit resets Sep 15 12pm PT (third link); grok CLI is 402 until Grok Build has balance (first link); the Cursor link answers now.
- Skills read: `.claude/skills/site-queue/SKILL.md`, `.cursor/skills/site-queue/SKILL.md`, `design_system/public/TASTE.md`, `docs/DEVELOPMENT_PROCESS.md`.

# Prior

Everything before this block (8,025 lines, 2026-06 → 2026-09-12) is in
`docs/archive/CROSS_AGENT_HANDOFF-through-2026-09-12.md`. Read it only for a named SHA.
This file holds ONE Current block: replace it, do not stack a new one on top
(Matt 2026-09-12 — the stack was the problem, nobody read past line 18).

## Parallel lanes

Lane plan and the shared files to watch: `components/site/v3/index.ts`, `package.json`,
this file. Two nodes touching one route go in the same lane, in sequence. Claim with
`npx tsx scripts/site-queue-status.ts --claim`, never by hand.
