# p03-plat-500s

WIP branch: `claude/admiring-feynman-7lgwc3--wip-p03-plat-500s` (snapshot of the agent worktree). Original worktree: `.claude/worktrees/agent-ac8dfdd9159dec731`.

## Package spec (as given to the fix agent)

Read docs/plans/VISIBILITY_2026-09-22/FIX_BRIEF.md first and follow it exactly.

PACKAGE P3: sitemapped place pages that return HTTP 500 to crawlers.
Verdicts: docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/data-pipeline.json (DATA-6, DATA-1), docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/seo-technical.json (SEO-2), docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/exposure.json (EXP-7).
Known reproductions: /subdivisions/elkai-woods (500 on 3 of 3 fetches, deterministic), /subdivisions/blakley-heights, /subdivisions/waywest-properties, /subdivisions/ponderosa-pines; and about 25% of untouched plat URLs at crawler concurrency 8 with a Googlebot UA.

1. Re-confirm the 500s live (x-vercel-id present = origin, not the sandbox proxy).
2. Find the throwing frame without Vercel logs: write a tsx harness under your worktree's scratch folder (not committed) that imports and calls, for elkai-woods and the other slugs, every read the route performs in generateMetadata and the page (app/subdivisions/[slug]/page.tsx: loadSubdivisionCore, getIndexableSubdivisions, getPlatBoundaryCity, the sold-history and section reads), catching and printing each error. If a harness cannot reproduce it, run `npx next dev -p 3107` in your worktree (set NODE_OPTIONS=--max-old-space-size=6144), fetch the slugs and read the server stack. Fix the real cause.
3. Wrap every read in the generateMetadata of the place routes (app/subdivisions/[slug]/page.tsx first; then app/cities/[slug]/page.tsx, app/cities/[slug]/[neighborhoodSlug]/page.tsx, app/communities/[slug]/page.tsx) with the repo's withTimeoutFallback (or try/catch to the route's unavailable metadata) so a DAL failure degrades instead of killing the render. Do not add pages/500. Do not put 2,642 slugs into generateStaticParams (ci:ssg-budget).
4. Add a bounded, resumable warmer for indexable plat URLs if one does not exist (extend /api/cron/warm-sitemaps if present; register any new cron in vercel.json so ci:cron-registered passes), and add a route-smoke/unit check using elkai-woods as the deterministic case.
Another agent (P2) is editing app/subdivisions/** for phase grouping and the directory: keep your edits in app/subdivisions/[slug]/page.tsx confined to generateMetadata and the read wrappers, and put helpers in new files, so merges stay clean. Report the root cause with the exact error text.
