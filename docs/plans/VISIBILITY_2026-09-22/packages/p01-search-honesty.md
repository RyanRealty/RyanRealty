# p01-search-honesty

WIP branch: `claude/admiring-feynman-7lgwc3--wip-p01-search-honesty` (snapshot of the agent worktree). Original worktree: `.claude/worktrees/agent-a0e69257db72a151f`.

## Package spec (as given to the fix agent)

Read docs/plans/VISIBILITY_2026-09-22/FIX_BRIEF.md first and follow it exactly.

PACKAGE P1: search-route honesty (the /homes-for-sale/{city}/{area}[/{preset}] family and its sitemap legs).
Verdicts: docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/seo-technical.json (SEO-1 p0, SEO-6), docs/plans/VISIBILITY_2026-09-22/evidence/verdicts/exposure.json (EXP-2 p0, EXP-4, EXP-6).

1. SEO-1 (p0): any made-up second segment renders 200, index,follow, self-canonical and a fabricated title/H1 title-cased from the slug. Make the route resolve the area (neighborhood boundary, listings-derived subdivision name, resort registry community, or preset) and fail CLOSED when it does not: robots noindex,follow, an honest title and body (the SubdivisionUnavailable pattern), no fabricated place name. Keep ci:seo-routes / lib/seo-route-contracts.test.ts green. Add a test with two garbage slugs under two cities.
2. EXP-4 / SEO-6: 651 plat slugs have both /homes-for-sale/{city}/{slug} and /subdivisions/{slug} indexable with the same H1. When the plat is in the indexable plat set (getIndexableSubdivisions or its equivalent), give the browse URL rel=canonical to /subdivisions/{slug} and drop it from the sitemap (non-cut consolidation; no 301). Use one shared decision function for page metadata and app/sitemap.ts.
3. EXP-2 (p0): about 59% of the 1,815 sitemapped browse pairs render one line ('No homes match...'). For a pair that is NOT a plat twin and has no active inventory, render the sold history and plat link the MVs already hold (subdivision_city_inventory_mv status_counts, subdivision_plat_closed_mv) so no sitemapped URL is a one-line page; if you cannot give it real content, set noindex,follow and leave it out of the sitemap, deciding on lifetime depth so the emitted set is stable (see app/sitemap.ts comments near the browse leg). Keep MLS-abbreviation names withheld (publishPlatDisplayName).
4. EXP-6: the ~260 place-type pages (/cities/{c}/types/{t}, /communities/{c}/types/{t}) are richer than their preset twins (/homes-for-sale/{city}/{preset}) but are in no sitemap. Add a types leg to app/sitemap.ts for type pages that have active inventory, and rel=canonical the preset twin to the type page where both exist. Do not add a mega-menu column (SITE_PAGES.md menu lock).
Files: app/search/[...slug]/*, lib/seo/getSearchMatrixEntries.ts, app/sitemap.ts, lib/sitemap-guard.ts, lib/data (read helpers only as needed), their tests and gates (check-seo-routes, check-sitemap-*, check-inventory-gate, check-seo-shell). Another agent owns app/subdivisions/** and plat grouping; do not edit those. Verify live behavior against production HTML for the before-state and with unit tests for the after-state.
