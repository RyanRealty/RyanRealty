# p15-crawl-monitor

WIP branch: `claude/admiring-feynman-7lgwc3--wip-p15-crawl-monitor` (snapshot of the agent worktree). Original worktree: `.claude/worktrees/agent-a3dbb472bf8bb359b`.

## Package spec (as given to the fix agent)

Read docs/plans/VISIBILITY_2026-09-22/FIX_BRIEF.md first and follow it exactly, including the 'MATT 2026-09-23' bullet.

PACKAGE P15: a production monitor so a crawl-surface break is caught in a day, not weeks. Evidence: docs/plans/VISIBILITY_2026-09-22/evidence/findings/gsc-trend.json gsc-trend-7 (the only sustained click loss, -30% 07-27..08-23, lined up with the sitemap/deploy outage commits 124348def, aa56d308d, 996ece96a, 0dbf2f1cc; sitemaps broke again 09-09 and 09-16), docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/seo-technical.json SEO-2 (plat 500s under crawler concurrency), SEO-9.
Build one daily cron route (CRON_SECRET-guarded like the other crons; register it in vercel.json so ci:cron-registered passes) that:
1. Fetches the sitemap index and every child with a Googlebot UA, asserts 200 within a time budget and a URL count within +/-5% of the expected count per child (compute the expectation from the same DAL functions app/sitemap.ts uses, or from yesterday's probe row when that is cheaper), and checks every URL in a child is unique and not a known redirect source.
2. Samples N URLs per page class from the sitemap (e.g. 10 per class, rotating by day) and fetches them with a Googlebot UA at concurrency 8: records status, time, x-vercel-cache, robots meta, canonical, and whether the canonical equals the URL; flags any 5xx, any noindex or foreign canonical on a sitemapped URL, and any fetch over 5 s.
3. Fetches the homepage and fails when any inline <script> does not parse or the GTM loader is missing (coordinate: another agent adds the same check to deploy:verify; put the parse check in a shared helper module under lib/ so both can use it, and if the other agent's helper exists at your base, reuse it).
4. Pulls the Search Console Sitemaps API (submitted vs indexed per sitemap) using the credentials scripts/_gsc-by-class.mjs uses.
5. Writes one row per check to site_signal with source='crawl_probe' (read the table's columns in docs/DATABASE_SCHEMA_SNAPSHOT.md; do not add columns) and, on any failure, raises the existing ops alert path the other health crons use (find it: crm-health-check / loop-health-check; it must alert the owner through the existing internal alert channel, not email a client). Make the loop see it: add the latest crawl_probe status to lib/data/loop/signals.ts so the scoreboard and brief show it.
Run the checks locally against production once (call the route handler function from a tsx script with a fake request, not via Vercel) and put the real output in your report. Files: new app/api/cron/<name>/route.ts, a new lib module, vercel.json (one entry), lib/data/loop/signals.ts (one additive block; another agent edits the GSC block there, keep hunks separate), tests.
