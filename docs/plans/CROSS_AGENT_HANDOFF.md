# Current — 2026-09-13 04:00Z ("there can be no gaps" — Matt 2026-09-12)

Surface: Cursor (Claude Fable), primary checkout `/Users/matthewryan/RyanRealty`, on `main`.

- **Done, on main after this push (see `git log -6`):** every gap named in the previous block is closed by code, not by a note. (1) **Rise floor 6** — `RISE_FLOOR`/`RISE_FLOOR_FROM 2026-09-13` in `scripts/lib/taste-receipt.mjs`; a +1..+5 rise is refused with the number it needs; basis is the table's own 81 scorings (`node scripts/taste-rise-floor.mjs --json`: seeded bootstrap, one-sided q95; P(noise rise ≥1)=34%, ≥6=6.6%), written to `taste-rule-freeze.json` `riseFloorBasis`, held by `ci:rubric-freeze` (drift + `q95 === riseFloor`) and a test that the committed manifest agrees with the committed table. Pre-2026-09-13 receipts stay valid. (2) **Table rows owe what receipts owe** — `taste-table-core.mjs` rows carry `demoMatch` (majority of 3, `demoMatchVotes`), `runDir`, `shotsHash`; `demo` column in `SITE_PAGES_E2E.md`; `ci:rubric-freeze` requires both on any table evaluated from `tableRowsBindFrom` 2026-09-14 (first UTC date after the table on disk). (3) **Judge-out abort** — `taste-table.mjs` stops at the first 402/missing judge (`JudgeOutError`), merges only what it scored, exits 3 and prints the `--evaluate-only <runDir> --classes …` resume; `claudeCliFailure` reads `api_error_status` 429 and "hit your weekly limit" as the judge being out. Directory lock on `taste-table.json` for parallel lanes. (4) **CMA** — `lib/cma/render-css-sections.ts`: comp-matrix column heads wrap instead of clipping; `lib/cma/page-safety.int.test.ts` green 4/4. Docs: TASTE.md, `run-loop.mdc`, both site-queue SKILLs, routine prompt. `ci:gates` 118/118, `test:unit` 11028 passed.
- **Table:** unchanged — 27 classes on `v1-2026-09-12` by claude-sonnet-5 (evaluated 2026-09-13 UTC), range 43 (subdivisions) → 78 (reviews). The full re-score that would bind every row (demoMatch/shotsHash) stopped at 4/27: claude CLI weekly limit (resets **Sep 15 12pm PT**), grok CLI 402 (Grok Build balance) the same hour. Partial table NOT committed. Shots are on disk at `.taste-table/2026-09-12T23-38-57-170Z`; resume with `node scripts/taste-table.mjs --evaluate-only .taste-table/2026-09-12T23-38-57-170Z` once a judge answers, then `node scripts/taste-rise-floor.mjs --pair <copy of the current table> --json` and write `riseFloorBasis` from paired data in the same change. Repeat check so far (4 identical-shot pairs): buy −1, about 0, blog −2, cities **+6** — the floor sits at the edge of the noise (`riseFloorBasis.repeatCheck`).
- **Needs Matt:** (a) one-time `cursor-agent login` (browser OAuth) so the Cursor link of the builder chain runs headless; (b) a judge — Grok Build balance top-up, or wait for the claude weekly reset Sep 15 12pm PT. Until one answers, no SITE node can be accepted: the routine's evaluator step returns the 402 by name and the node stays `in_progress` (by design, no APIs).
- **Next:** with a judge back, finish the table (command above), re-derive the floor from paired data, then the queue: `npx tsx scripts/site-queue-status.ts --json`, bottom of the table first (subdivisions 43, listing-detail 44, compare 45, buy 50).
- **Open PRs (7), on purpose:** #206 (live Claude lane), #207 (SITE-90, live cloud lane), #208 SITE-99 and #209 SITE-100 (stale claims, unlanded work), #183 / #192 / #194 (prospecting + CMA admin fixes, 2026-09-04 — Matt: land or close).
- **Worktree left in place:** `../RyanRealty-wt-site-90-20260912` (`cursor/site-90-about-fold-deb7`, live SITE-90 owner). WIP on local `wt/site-76-oregon-city-20260910`, `wt/site-79-reviews-20260910`; tag `archive/wt-site-72-20260910`.
- **Blockers:** the two Matt items above; nothing else.
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
