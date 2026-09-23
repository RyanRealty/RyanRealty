# p11-weekly-measurer

WIP branch: `claude/admiring-feynman-7lgwc3--wip-p11-weekly-measurer` (snapshot of the agent worktree). Original worktree: `.claude/worktrees/agent-aef96821b87805306`.

## Package spec (as given to the fix agent)

Read docs/plans/VISIBILITY_2026-09-22/FIX_BRIEF.md first and follow it exactly.

PACKAGE P11: make the loop measure itself every week, in the cloud, so a ranking loss becomes work automatically. Verdicts: docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/process.json (PROCESS-1, PROCESS-2), docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/tracking.json (TRACK-5, TRACK-11). Design intent: scratchpad/orchestrator/loop-redesign-draft.md ('How a ranking loss becomes work').
Facts: scripts/seed-gsc-ranking-queue.ts (landed 2026-09-22, Matt) pulls GSC query and query x page at rowLimit 25,000 and drafts 'GSC gap' SITE nodes (dry run today: 12 drafts, e.g. brasada ranch pos 11.7 / 3,168 impressions / 0% CTR split across four URLs); it runs only from a Mac LaunchAgent (scripts/site-queue-routine.sh), and the graph holds 0 'GSC gap' nodes. scripts/_gsc-by-class.mjs pulls pages by route class. COMPANY_SCOREBOARD.md is from 2026-08-15. The daily GSC ingestor stores only top-25 queries/pages. 7 site_improvement_ledger windows expired unlearned.
1. Refactor the seeder's logic into lib (lib/data/loop/ or lib/seo/) so both the CLI and a route call the same code.
2. Add a weekly Vercel cron route (Mondays, CRON_SECRET-guarded like the other crons; register in vercel.json so ci:cron-registered passes) that: pulls GSC page x query for the last settled 28 days (rowLimit 25,000 with startRow paging) into a table keyed by page class (write a migration; say in your report that it must be applied, do not apply it; make the route no-op gracefully if the table is missing), inserts the seeder's GSC-gap nodes as proposed/open SITE nodes (dedupe against existing titles), closes due ledger windows through the existing Learn function (closeImprovementLedgerRow or loop-learn-close-windows logic), and records a scoreboard snapshot row the brief can read (reuse company-scoreboard-probe's collector).
3. Close the 7 expired ledger windows now through the existing DAL function with verdict 'inconclusive' and a note naming this audit (this is the one DB write your package is allowed; rows close, never vanish). Print before/after rows.
4. Have scripts/loop-brief.ts print the latest scoreboard snapshot and the top three week-over-week GSC deltas by page class (touch only a new block; another agent edits the silent-zero block and the handoff block).
Files: scripts/seed-gsc-ranking-queue.ts, new lib module, new app/api/cron/<name>/route.ts, vercel.json (one new entry), supabase/migrations (new table), lib/data/loop/**, scripts/loop-brief.ts (new block only), tests. Use the GSC credentials the existing scripts use (read how _gsc-by-class.mjs authenticates) and do not print secrets.
