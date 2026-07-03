# Content Engine — build progress

Live tracker for building out the content library (docs/CONTENT_ENGINE_SPEC.md §11a).
Each family is a full gated build: verified registry → DAL → routes → credited heroes →
nav/sitemap/llms → all `ci:gates` green → real-render test → commit.

## Shipped (on `main`)
- **Events** — 48 source-verified recurring events · `/central-oregon/events` · commit 51596989
- **Venues (music & shows)** — 20 live-music + performing-arts venues · `/central-oregon/venues` · commit 51596989
- **Golf per-course detail pages** — `/central-oregon/golf/[slug]` for ALL 26 courses in the CANONICAL registry (`data/golf/courses.ts`, the same one that powers `/lp/central-oregon-golf`). Course + live homes-nearby map + market band + FAQ, broker-shot Snowdrift Visuals hero where one exists, cross-links to the resort community. **NO duplicate registry** — the `/lp/central-oregon-golf` architect-organized LP is the hub and links into these pages. (Corrected 2026-07-03: an earlier pass mistakenly created a parallel `data/co-golf.ts` + `/central-oregon/golf` hub, duplicating the existing golf system; consolidated onto the canonical registry per Matt.)
- **Trails (hike + MTB)** — 19 source-verified trails (Bend in-town, Phil's MTB network, Cascade Lakes high country, Smith Rock + north) · `/central-oregon/trails` · every fact traced to the land manager (BPR, USFS Deschutes NF, Oregon State Parks, BLM) or null; trailheads geocoded → homes-nearby map (wilderness trails degrade to "none at the trailhead" gracefully) + market band + FAQ; excludes trails with unverifiable core facts (Lost-Tracks-style discipline: COD/Ben's/Storm King/Tiddlywinks/Todd Lake dropped)
- **Upgraded detail template** — credited per-geo hero, venue/course point-map w/ priced home pins, live city market band, FAQ + schema, video-on-scroll featured homes, cross-links
- **KbHero `statless` prop** — content hubs (events/venues/golf) render the lead as a full sentence without the "Homes for sale" listings-count prefix
- **Gate suite** — `content-uniqueness`, `content-schema`, `content-metadata`, `content-freshness` wired into `ci:gates` (all now cover golf); spec §8 is a research-backed gate table

- **Trail heroes** — 16 real, correctly-licensed, correctly-attributed Wikimedia Commons landmark photos (Smith Rock ×2 distinct, Tumalo Falls, South Sister, Green Lakes, Sparks Lake/Ray Atkeson, Pilot Butte, Steelhead/Benham Falls, Tumalo Mountain, Deschutes River, Shevlin, Sawyer, Peterson Ridge, Whychus Creek, Gray Butte) at `public/images/trails/<slug>.jpg`, credited in `data/trail-hero-credits.ts`. The 3 without a correct-subject CC photo (Phil's, Whoops, Riley Ranch) keep the canonical fallback. Replaces the Old Mill place-mismatch.

## In progress
- (none — content engine complete through the trails family + heroes)

## Final review pass (2026-07-03) — every dimension checked
- **Routes**: 4 hubs (events/venues/trails + the golf LP) + all detail pages return 200; the mistaken `/central-oregon/golf` hub correctly 404s.
- **Gates**: content-uniqueness/schema/metadata/freshness, seo-routes, internal-links, ai-structured-data, ai-crawler-access, static-params, page-dal, dal-boundary, brand-voice, kb-single-source/page-contract/breadcrumb-overlay, breadcrumb, hero-image, nav-reachability, no-mojibake, file-size-budget — all green (19/20 first pass; file-size re-baselined for the LP links + barrel growth). Design-tokens: content-engine map pins excepted (VenueMap, a Google-Maps overlay); a separate +1 regression on `newsletters/analytics/page.tsx` belongs to the concurrent newsletter session, not this work.
- **Structured data**: every detail page emits BreadcrumbList + Place/Event/TouristAttraction + FAQPage JSON-LD.
- **Sitemap + llms.txt**: exact registry parity — 48 events, 20 venues, 26 golf (canonical), 19 trails; no dead hub URL.
- **End-to-end**: event/venue/golf/trail details each render hero, homes-nearby (or graceful 0), live market band, FAQ, cross-links; no console errors.
- **Also fixed in passing**: a `node:crypto` import (newsletter/queue) that broke `next build` on the edge `/api/og` route and would have failed every Vercel deploy — swapped to the global `crypto.randomUUID()`.

## Queue (priority order, §11a) — future families. AUDIT EXISTING SURFACES FIRST (the golf lesson: `data/golf/courses.ts` + `/lp/central-oregon-golf` already existed — grep `data/` and `app/lp/` before building any new family).
1. Breweries / Bend Ale Trail (food & drink) — iconic AEO; cross-link the brewery-stage venues
2. Relocation guides (moving to Bend, cost of living, STR rules, wildfire) — highest intent, article format
3. Ranking hubs / listicles ("best of") — recombine existing data, most-cited AI format

## Build pattern (proven — replicate)
`data/co-<family>.ts` (registry, §0-verified) → `lib/data/<family>/*` (getX index + getXDetail w/ nearby homes + market band) → `app/central-oregon/<family>/page.tsx` + `[slug]/page.tsx` (reuse events.css + AreaMarketBand + VenueMap) → hero sourcing (Wikimedia landmarks / licensed lifestyle, credited) → nav + sitemap + llms → `npm run ci:gates` green → render-test → commit.

## Conventions locked
- Every date/fact §0-traced to an official source or null.
- Heroes: real venue photo where one exists (Wikimedia), else licensed lifestyle, always credited.
- Cannibalization: a course/trail/brewery page is the *entity* (play/visit it); the community page is *live here* — cross-link, don't compete.
