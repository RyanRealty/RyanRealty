# P5 cut-list (FROZEN AT IA LOCK — draft until decisions.md records the lock)

Two kinds of cut: **route cuts** (the URL dies -> 301) and **surface cuts** (the job survives inside a destination; the standalone surface dies). Every route cut carries live GSC 90-day evidence (Search Console API, service account, pulled 2026-08-11). **Never resurrect a cut item during P9 rolls.**

| Route | Kind | GSC 90d (clicks/impr) | Verdict | Disposition |
|---|---|---|---|---|
| /account/saved-cities | route | 0 / 0 | SAFE_TO_CUT | Portal PDS §11: saved-cities/saved-communities merge into one 'places' concept inside the single account destination — three surfaces for one job. Noindex, so no GSC equity expecte |
| /account/saved-communities | route | 0 / 0 | SAFE_TO_CUT | Same merge as /account/saved-cities: one saved-places surface per portal PDS §11 consolidation. Noindex; no GSC equity expected, evidence pull still runs. |
| /area-guides | surface/route | 0 / 0 | SAFE_TO_CUT | Third parallel chooser duplicating the /cities + /communities ledgers (evaluate-a-place PDS §10 names it a duplicate path); the locked places destination is ONE exploration surface |
| /areas/[slug] | surface/route | 0 / 0 | SAFE_TO_CUT | Usage-dependent cut per the PDS destination implication: folds into places only if P4/P5 finds real usage; otherwise cut with a 301 plan. Missing slugs already render noindex and t |
| /builders | surface/route | 0 / 0 | SAFE_TO_CUT | PDS rise-or-die call: builders either rises to the anchor-family floor (facts SoR, map, stats, CTA, capture, discoverability) or is cut to a listing-detail rail only. Never sitemap |
| /builders/[slug] | surface/route | 0 / 0 | SAFE_TO_CUT | Thinnest variant in the anchor family (D2): entered only from the listing-detail builder rail, which can absorb the whole job. Rise-or-die per PDS; not sitemap-emitted, so no meani |
| /buy | surface/route | 0 / 0 | SAFE_TO_CUT | Fold into homes as the buyer-education layer per the locked P5 set and the plan-a-purchase PDS: the hub is orphaned from primary chrome (nav Buy group is /homes-for-sale, no footer |
| /buy/[intent] | surface/route | 1 / 21 | HAS_EQUITY_301_REQUIRED | Fold as homes buyer-education guides (modes/leaves of the browse destination) per the locked set; the three LPs keep their conversion job but stop being a parallel funnel with dupl |
| /compare | surface/route | 0 / 0 | SAFE_TO_CUT | P3 locked compare-homes → find-a-home: no standalone destination — the compare utility folds into the browse system as its shortlist-decision tool. Zero SEO equity blocks this (noi |
| /dashboard | route | 0 / 0 | SAFE_TO_CUT | Already an in-app redirect shell to /account (Matt 2026-06-14 Option A); portal PDS §11: /dashboard dies entirely — collapse the shell to a config-level 301. Noindex, no GSC equity |
| /dashboard/collections | route | 0 / 0 | SAFE_TO_CUT | Redirect shell to /account/collections; same /dashboard-dies consolidation — config 301. Noindex. |
| /dashboard/collections/[id] | route | 0 / 0 | SAFE_TO_CUT | Redirect shell in the /dashboard family — config 301 per portal PDS §11. Noindex. |
| /dashboard/history | route | 0 / 0 | SAFE_TO_CUT | Redirect shell to /account/history — config 301 per /dashboard consolidation. Noindex. |
| /dashboard/likes | route | 0 / 0 | SAFE_TO_CUT | Redirect shell to /account/saved-homes — config 301 per /dashboard consolidation. Noindex. |
| /dashboard/marketing | route | 0 / 0 | SAFE_TO_CUT | Admin-plane surface living in the public /dashboard namespace (which is itself a portal-dup consolidation candidate). Relocate under the /admin plane; admin-gated with zero SEO equ |
| /dashboard/marketing/inbox | route | 0 / 0 | SAFE_TO_CUT | Same as parent: admin-plane surface in public namespace; relocate under /admin with the marketing dashboard. Zero SEO equity. |
| /dashboard/notifications | route | 0 / 0 | SAFE_TO_CUT | Redirect shell to /account/notifications — config 301 per /dashboard consolidation. Noindex. |
| /dashboard/saved | route | 0 / 0 | SAFE_TO_CUT | Redirect shell to /account/saved-homes — config 301 per /dashboard consolidation. Noindex. |
| /dashboard/searches | route | 0 / 0 | SAFE_TO_CUT | Redirect shell to /account/saved-searches — config 301 per /dashboard consolidation. Noindex. |
| /dashboard/settings | route | 0 / 0 | SAFE_TO_CUT | Redirect shell to /account/profile — config 301 per /dashboard consolidation. Noindex. |
| /feed | surface/route | 0 / 6 | SAFE_TO_CUT | P3 lock (Matt 2026-08-11): 'keep /videos, fold /feed' — the grid is the indexable canonical surface and the vertical feed becomes a mode of it. Route disposition is this pass: 301  |
| /housing-market/reports/[slug]/[geoName] | surface/route | 0 / 15 | SAFE_TO_CUT | Redirect-only re-export of the legacy reporting_cache-era route (app/housing-market/reports/[slug]/[geoName]/page.tsx re-exports the permanentRedirect at app/reports/[slug]/[geoNam |
| /lp/bend | surface/route | 0 / 2 | SAFE_TO_CUT | Dual-role indexable LP competing with the canonical Bend city node (/cities/bend) — arrive-from-ad PDS §11 says arrival surfaces are channel-owned and off-graph; indexable dual-rol |
| /lp/central-oregon-golf | surface/route | 0 / 59 | HAS_EQUITY_301_REQUIRED | Indexable dual-role LP overlapping the places golf content family (/central-oregon/golf/*) — same pick-a-side rule as the Tetherow pair. In the sitemap, so plausible SEO equity — G |
| /lp/tetherow | surface/route | 1 / 146 | HAS_EQUITY_301_REQUIRED | The page already declares rel=canonical to /communities/tetherow — the dual-role that produced the documented cannibalization defect. PDS §11: must pick a side; the community node  |
| /lp/tetherow/heath | surface/route | 0 / 2 | SAFE_TO_CUT | Second half of the indexable Tetherow dual-role pair (in sitemap per PDS acceptance check 1). Fold into the places subdivision/community tier with capture embedded. Indexable, so G |
| /motivated-sellers | surface/route | 1 / 13 | HAS_EQUITY_301_REQUIRED | Duplicate implementation of the deal-signals job (/price-drops serves the same visitor with a different metric window; zero cross-links either direction — hunt-price-cuts PDS §9).  |
| /motivated-sellers/[city] | surface/route | 1 / 41 | HAS_EQUITY_301_REQUIRED | Folds with its parent into the homes destination's deal mode (city-filtered). Same duplication with /price-drops/[city]. Sitemapped city-scoped SEO doors — GSC per-URL pull before  |
| /offline | surface/route | 0 / 0 | SAFE_TO_CUT | PDS §11 P3 sub-decision: (A) wire the serwist offline worker for real, or (B) delete app/sw.ts, the serwist deps, and this page. The page is reachable only by typed URL today. Eith |
| /pulse | surface/route | 0 / 0 | SAFE_TO_CUT | PDS defect #1: two live feeds render the same activity_events plane; /pulse is a near-orphan (sitemap-emitted at app/sitemap.ts:152 but ZERO nav or component inbound links) while / |
| /reports | surface/route | 0 / 0 | SAFE_TO_CUT | Dual URL space (PDS defect #2): implementation lives at app/reports/*, canonical URLs at /housing-market/reports/*, stitched by next.config 308s plus 2-line re-export files. Collap |
| /reports/[slug] | surface/route | 0 / 3 | SAFE_TO_CUT | Same dual-URL-space consolidation as /reports: move implementation under /housing-market/reports/[slug], keep the 308. GSC evidence pull before file deletion; redirects stay perman |
| /reports/[slug]/[geoName] | surface/route | 0 / 0 | SAFE_TO_CUT | PDS defect #7: exists solely to permanentRedirect away from the dropped reporting_cache era (app/reports/[slug]/[geoName]/page.tsx:14-25, noindex). Keep the redirect mapping in nex |
| /reports/sales/[city]/[period] | surface/route | 0 / 86 | HAS_EQUITY_301_REQUIRED | Page survives but the URL is a consolidation candidate: it is the last LIVE surface in the retired /reports URL space, outside the canonical /housing-market/reports family. Rename  |
| /resources | surface/route | 0 / 0 | SAFE_TO_CUT | PDS §11 explicit: the resources annex dissolves into IA/nav unless P5 gives it a job the nav directory (lib/site-nav.ts:140-146) is not already doing — a router page whose links ar |
| /sell/[intent] | surface/route | 0 / 7 | SAFE_TO_CUT | plan-a-sale D4: all three landers (/sell/for-sale-by-owner, /sell/expired-listings, /sell/inherited-home) have ZERO internal links (organic-entry-only, sitemapped) and duplicate th |
| /sell/valuation | surface/route | 0 / 17 | SAFE_TO_CUT | Locked consolidation: ONE valuation intake spine at /sell#get-value; this page is a second, parallel capture contract (ValuationForm/submitValuationRequest vs the spine's SellerLPF |
| /site-index | surface/route | 0 / 1 | SAFE_TO_CUT | Named consolidation candidate in the P5 brief. It may be redundant with sitemap.xml + a well-linked IA, but in-page links carry crawl equity XML sitemaps do not, so the cut is usag |
| /tools/appreciation | surface/route | 2 / 608 | HAS_EQUITY_301_REQUIRED | run-the-numbers §11: no standalone Tools destination — the hold-math calculator is a utility node attached to the valuation spine, embeddable in context. The standalone URL survive |
| /tools/mortgage-calculator | surface/route | 0 / 36 | SAFE_TO_CUT | Standalone destination dissolves per run-the-numbers PDS §11 — the engine embeds in context (listing detail already mounts it) and the payment tool attaches to the homes pillar. UR |
| /tools/rental-property-calculator | surface/route | 1 / 11 | HAS_EQUITY_301_REQUIRED | Standalone destination dissolves per run-the-numbers PDS — underwrite attaches to the investor lens of browse + contact and already embeds on listing detail (RentalAnalysis). URL k |
| /home-valuation | surface/route | 0 / 0 | SAFE_TO_CUT | Already a 301 (next.config.ts:217 → /sell/valuation), so this is a retarget, not a cut: when /sell/valuation folds into the spine, repoint this redirect directly at the spine URL t |

## Explicitly NOT cut

- /oregon/* boundary tier (earned equity, refer-out-of-area locked KEEP)
- /luxury-homes-bend (built for a live GSC ranker)
- /open-houses, /price-drops (curated modes of the one browse system — modes, not cuts)
- /videos (P3: survivor of the video pair)
- Legal 7 + /sign/* + /cma/* + /bpo/* (frozen external contracts)
- /r/[code] referral, /alerts/unsubscribe + one-click API (live in sent mail)
- Every /listing resolver (by-address, by-key, odsmls — distributed-link equity)

## Lock line

When Matt locks: record answers in decisions.md, set state.json.locks.ia, clear awaiting_lock, FREEZE this file, advance phase to P6_VISUAL.
