# Current — 2026-09-13 01:45Z (Matt "fix it all": judge chain, rule freeze, content floor, land-or-kill)

Surface: Cursor (Claude Fable), primary checkout `/Users/matthewryan/RyanRealty`, on `main`.

- **Done, on main after this push (see `git log -8`):** (1) judge chain — `taste-evaluate.ts` and `taste-table.mjs` fall back from grok-4.6 (CLI 402 since 2026-09-11 10:17) to the claude CLI (sonnet, or opus for a Sonnet builder); receipts record the judge that answered; done-evidence refuses a bare 402. (2) rule freeze — `design_system/public/taste-rule-freeze.json` + `ci:rubric-freeze`: rubric stays `v1-2026-09-12` until every class has a table row on it. (3) no-regression floor — `contentFloor` on all 27 `ui_kits/<class>/parity.json`, `ci:route-content-floor` runs in `ci:runtime-gates` and CI before the evaluator. (4) accept test rewritten to Matt's order (catalog installed+imported → brand intact → floor holds → then score) in both site-queue SKILLs, the routine prompt, TASTE.md, `run-loop.mdc`. (5) land-or-kill: 16 worktrees removed, 106 landed local branches deleted, 152 merged origin branches deleted, 85 stale PRs closed.
- **Table rebaselined:** all 27 classes scored on `v1-2026-09-12` by claude-sonnet-5 (grok 402), 3 scorings, median — `design_system/public/taste-table.json`, block in `SITE_PAGES_E2E.md`. Range 43 (subdivisions) → 78 (reviews); at/past 70: reviews 78, market-report-annual 70. Bottom five: subdivisions 43, listing-detail 44, compare 45, buy 50, contact/community/neighborhood 51. `ci:rubric-freeze` OK. Two table bugs fixed on the way: a judge answer missing a criteria field is asked once more; a `[...slug]` route file was rejected as a `..` traversal (market-report-detail was INVALID three runs straight). Raw judge answers now sit at `.taste-table/<run>/<class>/judge-N.txt`.
- **Next:** run the site queue on the new accept order (`npx tsx scripts/site-queue-status.ts --json`), bottom of the table first. Grok launchd routine stays off until the Grok Build balance resets; the claude link carries the judge meanwhile. Pre-existing, not mine: `lib/cma/page-safety.int.test.ts` "overstuffed CMA" fails by +2.3pt on the COMPARABLE side label (p4–p6) — a CMA print fix, nothing in this push touches `lib/cma`.
- **Open PRs (7), on purpose:** #206 (live Claude lane), #207 (SITE-90, live cloud lane), #208 SITE-99 and #209 SITE-100 (stale claims, unlanded work), #183 / #192 / #194 (prospecting + CMA admin fixes, 2026-09-04, not superseded — Matt: land or close).
- **Worktree left in place:** `../RyanRealty-wt-site-90-20260912` (`cursor/site-90-about-fold-deb7`, 16 dirty files, live SITE-90 owner). Two WIP commits preserved on local branches `wt/site-76-oregon-city-20260910`, `wt/site-79-reviews-20260910` (nodes done; review or delete). Tag `archive/wt-site-72-20260910` holds one unlanded search-fold patch. 43 local branches with unlanded patches remain (`git branch`); the monthly `cleanup-branches.yml` sweeps origin.
- **Blockers:** none on Matt. `grok` CLI 402 is an account balance, not a code fault.
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
