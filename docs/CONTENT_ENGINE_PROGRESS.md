# Content Engine — build progress

Live tracker for building out the content library (docs/CONTENT_ENGINE_SPEC.md §11a).
Each family is a full gated build: verified registry → DAL → routes → credited heroes →
nav/sitemap/llms → all `ci:gates` green → real-render test → commit.

## Shipped (on `main`)
- **Events** — 48 source-verified recurring events · `/central-oregon/events` · commit 51596989
- **Venues (music & shows)** — 20 live-music + performing-arts venues · `/central-oregon/venues` · commit 51596989
- **Golf courses** — 19 source-verified courses across 8 cities (public, resort, private) · `/central-oregon/golf` · each clubhouse geocoded (Google Maps) → live homes-nearby map + market band + FAQ; cross-links to the resort community where the course sits; `TouristAttraction` schema (policy-safe, not `GolfCourse`/LocalBusiness)
- **Upgraded detail template** — credited per-geo hero, venue/course point-map w/ priced home pins, live city market band, FAQ + schema, video-on-scroll featured homes, cross-links
- **KbHero `statless` prop** — content hubs (events/venues/golf) render the lead as a full sentence without the "Homes for sale" listings-count prefix
- **Gate suite** — `content-uniqueness`, `content-schema`, `content-metadata`, `content-freshness` wired into `ci:gates` (all now cover golf); spec §8 is a research-backed gate table

## In progress
- (none — golf shipped)

## Queue (priority order, §11a)
1. Trails (hike + MTB) — distinct from parks; `trails` hero key already reserved
2. Breweries / Bend Ale Trail (food & drink) — iconic AEO; cross-link the brewery-stage venues
3. Relocation guides (moving to Bend, cost of living, STR rules, wildfire) — highest intent, article format
4. Ranking hubs / listicles ("best of") — recombine existing data, most-cited AI format
5. Golf hero-sourcing pass — 19 courses currently on the canonical Central Oregon hero; source real CC-attributed course photos (Wikimedia) or licensed lifestyle, credited, per `data/golf-hero-credits.ts`

## Build pattern (proven — replicate)
`data/co-<family>.ts` (registry, §0-verified) → `lib/data/<family>/*` (getX index + getXDetail w/ nearby homes + market band) → `app/central-oregon/<family>/page.tsx` + `[slug]/page.tsx` (reuse events.css + AreaMarketBand + VenueMap) → hero sourcing (Wikimedia landmarks / licensed lifestyle, credited) → nav + sitemap + llms → `npm run ci:gates` green → render-test → commit.

## Conventions locked
- Every date/fact §0-traced to an official source or null.
- Heroes: real venue photo where one exists (Wikimedia), else licensed lifestyle, always credited.
- Cannibalization: a course/trail/brewery page is the *entity* (play/visit it); the community page is *live here* — cross-link, don't compete.
