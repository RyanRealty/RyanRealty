# Current — 2026-09-13 02:00Z (builder chain, round judge, no APIs — Matt 2026-09-12)

Surface: Cursor (Claude Fable), primary checkout `/Users/matthewryan/RyanRealty`, on `main`.

- **Done, on main after this push (see `git log -12`):** (1) **builder chain** — `scripts/site-queue-routine.sh` (LaunchAgent `com.ryanrealty.site-queue`, 02/06/10/14/18/22 local, re-enabled) tries `grok` CLI (builds as grok-4.5) → `cursor-agent -p` → `claude` CLI (Opus, so Sonnet stays the judge); a link is skipped only on 402 / not logged in / missing, any other exit is that fire's result. Strips `XAI_API_KEY ANTHROPIC_API_KEY ANTHROPIC_AUTH_TOKEN CURSOR_API_KEY` first: subscriptions only, never an API. Old `site-queue-grok-routine.sh` is a shim. (2) **round judge** — `taste-evaluate.ts` / `taste-table.mjs` start the judge chain at `taste-table.json` `instrument.evaluatorModel` (claude-sonnet-5 now); grok-4.6 returns only at the next full table run, so a judge flip cannot rebaseline every route mid-round. `--api` on the table is refused unless `RR_ALLOW_PAID_API=1`. Written into TASTE.md, `run-loop.mdc`, both site-queue SKILLs, the routine prompt. (3) earlier today: judge chain, rule freeze `v1-2026-09-12` (`ci:rubric-freeze`), `contentFloor` + `ci:route-content-floor`, accept test in Matt's order, land-or-kill (16 worktrees, 258 branches, 85 PRs), one-block handoff.
- **Table:** all 27 classes on `v1-2026-09-12` by claude-sonnet-5, 3 scorings, median. Range 43 (subdivisions) → 78 (reviews); at/past 70: reviews 78, market-report-annual 70. Bottom five: subdivisions 43, listing-detail 44, compare 45, buy 50, contact/community/neighborhood 51. Judge noise: within-class spread median 10, max 18 — a rise floor (~+5) is a next-round rule, needs a full table re-run.
- **Needs Matt, one time:** `cursor-agent login` in a terminal (browser OAuth) so the Cursor link of the builder chain can run headless; until then that link logs "Authentication required → next builder". The grok link resumes by itself when the Grok Build balance resets (402 since 2026-09-11 10:17).
- **Next:** the queue runs itself on the chain; a human session runs `npx tsx scripts/site-queue-status.ts --json` and takes the bottom of the table first. Gap noted: `demoMatch` is enforced on receipts but not persisted on table rows. Pre-existing, not mine: `lib/cma/page-safety.int.test.ts` "overstuffed CMA" fails by +2.3pt (p4–p6 side label) — `lib/cma` untouched here.
- **Open PRs (7), on purpose:** #206 (live Claude lane), #207 (SITE-90, live cloud lane), #208 SITE-99 and #209 SITE-100 (stale claims, unlanded work), #183 / #192 / #194 (prospecting + CMA admin fixes, 2026-09-04 — Matt: land or close).
- **Worktree left in place:** `../RyanRealty-wt-site-90-20260912` (`cursor/site-90-about-fold-deb7`, live SITE-90 owner). WIP on local `wt/site-76-oregon-city-20260910`, `wt/site-79-reviews-20260910`; tag `archive/wt-site-72-20260910`.
- **Blockers:** only the one-time `cursor-agent login` above.
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
