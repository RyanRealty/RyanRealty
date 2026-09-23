# p13-payload

WIP branch: `claude/admiring-feynman-7lgwc3--wip-p13-payload` (snapshot of the agent worktree). Original worktree: `.claude/worktrees/agent-a0ab740980d061329`.

## Package spec (as given to the fix agent)

Read docs/plans/VISIBILITY_2026-09-22/FIX_BRIEF.md first and follow it exactly.

PACKAGE P13: page weight on place pages and /about. Evidence: docs/plans/VISIBILITY_2026-09-22/evidence/findings/ux-live.json (UXLIVE-3, UXLIVE-6 cluster pills only), docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/seo-technical.json (SEO-10), docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/data-pipeline.json (DATA-5), scratchpad/verify/competitors/COMP-4.*.json.
Facts: /about is 4.68 MB decoded HTML with 5,671 listing records in one RSC push and a 982 KB inline SVG (app/about/page.tsx V3Atlas dots); /cities/bend 3.77 MB with 1,664 listing records; awbrey-butte 2.0 MB; field LCP p75 is 11-12 s on neighborhood pages, 6-7 s on community pages.
1. Keep counts, boundaries and text in the server HTML. Move the atlas dot arrays out of the RSC payload: serve them from a cached per-geo JSON route handler (ISR/unstable_cache, CDN cacheable) and fetch after paint in V3Atlas.client.tsx, with the same data and the same interactions. Serve heavy static basemap geometry as a cacheable asset instead of inline paths where it is static. Measure served HTML bytes before (production curl) and after (a local `npx next build` is too heavy; instead unit-test the props size or run `next dev` on one route and compare) and report both.
2. lib/atlas/pin-price.ts: cluster pills print the lowest ask in the cluster with '+' ('$50k+' over Bend). Print the cluster median list price (label it plainly) or the lowest ask within the page's active type filter; test it.
3. Add a gate that fails when a public place route's server-rendered props for the atlas exceed a byte budget (decide the budget from your measurement and state it).
Read design_system/public/TASTE.md and PUBLIC_UI.md before editing components; keep every page's parity.json requiredComponents satisfied. Files: components/site/v3/V3Atlas.client.tsx and its server wrapper, lib/atlas/**, app/about/page.tsx (atlas props only), app/cities/[slug]/page.tsx and app/cities/[slug]/[neighborhoodSlug]/page.tsx and app/communities/[slug]/page.tsx (atlas props only), a new app/api or app/(data) route for dots, tests, gate. Another agent edits app/subdivisions/** and the city page's child-places rail; stay out of those parts.
