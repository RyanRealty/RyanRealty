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

## In progress
- (none — trails shipped)

## Queue (priority order, §11a)
1. Trail hero-sourcing — 16 real CC-licensed Wikimedia landmark photos already sourced + verified (Smith Rock, Tumalo Falls, South Sister, Pilot Butte, Sparks Lake, Green Lakes, Steelhead/Benham Falls, Shevlin, Sawyer, Whychus Creek, etc.). Download → optimize → `public/images/trails/` → populate `data/trail-hero-credits.ts` with author + license + Commons link. (Golf heroes DONE via the existing broker photos.)
2. Breweries / Bend Ale Trail (food & drink) — iconic AEO; cross-link the brewery-stage venues
3. Relocation guides (moving to Bend, cost of living, STR rules, wildfire) — highest intent, article format
4. Ranking hubs / listicles ("best of") — recombine existing data, most-cited AI format

## Build pattern (proven — replicate)
`data/co-<family>.ts` (registry, §0-verified) → `lib/data/<family>/*` (getX index + getXDetail w/ nearby homes + market band) → `app/central-oregon/<family>/page.tsx` + `[slug]/page.tsx` (reuse events.css + AreaMarketBand + VenueMap) → hero sourcing (Wikimedia landmarks / licensed lifestyle, credited) → nav + sitemap + llms → `npm run ci:gates` green → render-test → commit.

## Conventions locked
- Every date/fact §0-traced to an official source or null.
- Heroes: real venue photo where one exists (Wikimedia), else licensed lifestyle, always credited.
- Cannibalization: a course/trail/brewery page is the *entity* (play/visit it); the community page is *live here* — cross-link, don't compete.
