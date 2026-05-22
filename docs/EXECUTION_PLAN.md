# Ryan Realty Website — Full Execution Plan

**Status:** Ready to execute. End-to-end. No phase splits.
**Date:** 2026-05-22
**Owner:** Matt Ryan (Principal Broker, Ryan Realty, Bend OR)

---

## 1. The bar (acceptance criteria — machine-checkable)

Best real estate website in Central Oregon. Listing detail BEATS Zillow Showcase. Sub-1s LCP everywhere. Cannot regress. One canonical Data Access Layer means every page gets data the same way.

**Done = every one of these passes:**

- [ ] `npm run build` exits 0 with zero type errors
- [ ] `npm run lint` exits 0 (with all new ESLint rules)
- [ ] `npm run ci:design-tokens` exits 0 (no raw hex, no retired fonts, no raw HTML primitives where shadcn exists)
- [ ] `npm run ci:dal-boundary` exits 0 (zero `.from('listings')` etc. outside `lib/data/`)
- [ ] `npm run ci:brand-voice` exits 0 (no banned words in JSX strings)
- [ ] `npm run ci:seo-routes` exits 0
- [ ] `lhci autorun` passes on every LP route: Perf ≥ 90, A11y ≥ 95, BP ≥ 90, SEO ≥ 95, LCP ≤ 2500ms
- [ ] Vercel Analytics 7-day window: listing detail TTFB p95 < 200ms, LP routes p95 < 300ms, homepage p95 < 200ms
- [ ] Initial JS bundle ≤ 250 KB per route (bundle analyzer in CI)
- [ ] Lighthouse CI is wired into `.github/workflows/CI.yml` and blocks PRs on regression
- [ ] All 4 materialized views (`listing_tile_mv`, `geo_snapshot_mv`, `listing_detail_mv`, `similar_listings_mv`) refresh successfully for 7 consecutive days
- [ ] Every page in `app/` imports data access from `@/lib/data/` — zero raw queries (greppable)
- [ ] Production deploy at ryan-realty.com is live and serves all LP families without 5xx
- [ ] Pixel diff between every page section and corresponding mockup in `design_system/ryan-realty/ui_kits/website/index.html` — human sign-off per section

---

## 2. Assets we already own (the moats)

**Data:**
- Supabase `dwvlophlbvvygjfxcrhm` ("ryan-realty-platform")
- 589K rows in `listings` (RETS, mixed-case quoted columns)
- `market_stats_cache` — 6h freshness, 11 cities + 14 Bend neighborhoods + 14 resort communities + ZIPs
- `market_pulse_live` — 10-15min freshness, current inventory
- `listing_history` — 4.1 GB, every status change, every price change
- Authoritative GIS boundaries (Bend GIS, Deschutes DIAL, Census TIGER)
- `video_tours_cache` — 48 luxury MLS listings with professional videographer embeds (Aryeo, Riley Visuals, Vimeo, YouTube, Cloudflare Stream) — nightly refresh from MLS feed
- `listings.details.Videos` JSONB — additional MLS-supplied video URLs per listing
- `competitor_intel` — 442 rows from past scrapes

**Design + voice:**
- Design System v2 at `design_system/ryan-realty/` (locked 2026-05-13)
- Navy `#102742` + cream `#faf8f4` two-color palette
- Amboqia Boriango (display) + AzoSans (accent print) + Geist (body/UI)
- Homepage mockup at `design_system/ryan-realty/ui_kits/website/index.html` — pixel target
- Heritage kit: Jax mascot, 14 wordmarks, 2 scene illustrations
- Canonical hero photos in `design_system/ryan-realty/assets/hero/`
- 3 broker headshots (transparent PNG, 800×1200 normalized) at `design_system/ryan-realty/assets/team/`
- Brand voice locked at `marketing_brain_skills/brand-voice/voice_guidelines.md`

**Brokers (the people):**
- Matt Ryan (Principal) — `541.703.3095` FUB / `541.213.6706` direct
- Paul Stevenson — `541.977.6841`
- Rebecca Ryser Peterson — `415.308.9087`

**Tooling:**
- Next.js 15 App Router, TypeScript strict, Tailwind v4, shadcn/ui radix-nova
- Supabase + PostGIS
- Vercel
- `lighthouserc.cjs` configured (not yet wired into PRs)
- `scripts/lint-design-tokens.js` (needs extension)
- Existing CI at `.github/workflows/CI.yml`

**Research already on disk:**
- `docs/competitor-intelligence-2026-05-13.md` — 40,778 bytes
- `out/fb-ad-recon/` — 426 FB ads scraped across 5 luxury brands
- `out/design-recon/` — IG + flyer layout patterns
- `public/template-picker/preview/ig-refs/` — 26 IG reference images

---

## 3. Site structure (every route, in order of importance)

```
/                                       Homepage
/listing/[listingKey]                   Listing detail (the Zillow Showcase beater)
/cities/[slug]                          11 cities
/cities/[slug]/[neighborhood]           14 Bend neighborhoods
/communities/[slug]                     14 resort communities
/zip/[zip]                              10+ ZIPs
/search                                 Search + map view
/lp/seller-home-value                   Seller LP → FUB seller workflow
/lp/buyer-listing-alerts                Buyer LP → FUB
/lp/expired-listing                     Expired listing LP
/housing-market/reports/[slug]          Market reports
/sell, /about, /team                    Supporting pages
/admin/*                                Admin (lower perf scope)
```

11 cities: bend, redmond, sisters, la-pine, sunriver, madras, prineville, culver, terrebonne, tumalo, powell-butte

14 Bend neighborhoods: awbrey-butte, old-mill, larkspur, pilot-butte, northwest-crossing, river-west, westside, downtown, eastside, century-west, bear-creek, mountain-view, se-bend, brookswood

14 resort communities: tetherow, sunriver, eagle-crest, pronghorn, brasada-ranch, black-butte-ranch, caldera-springs, crosswater, aspen-lakes, thousand-trails, seven-peaks, mt-bachelor-village, broken-top, widgi-creek

---

## 4. The Data Access Layer — the actual guardrail

This is the structural fix. Every page calls ONE set of typed functions. No page touches `.from('listings')` directly. ESLint blocks it. TypeScript types are the contract.

### Directory structure

```
lib/data/
├── index.ts                          Re-export every public function
├── client.ts                         Supabase server + browser clients
├── types/
│   ├── listing.ts                    Listing, ListingDetail, ListingTile, ListingStatus
│   ├── geo.ts                        City, Neighborhood, Community, Zip, GeoSlug
│   ├── market.ts                     MarketStats, MarketPulse, MoSVerdict, PriceHistoryPoint
│   ├── video.ts                      ListingVideo, VideoEmbed, VideoSource
│   ├── broker.ts                     Broker, BrokerSlug
│   ├── activity.ts                   ActivityEvent
│   ├── lead.ts                       BuyerLead, SellerLead, ExpiredLead, LeadResult
│   └── shared.ts                     Currency, Slug, IsoDate, etc.
├── listings/
│   ├── getListingDetail.ts           (key) → ListingDetail | null
│   ├── getListingTile.ts             (key) → ListingTile | null
│   ├── getSimilarListings.ts         (key, limit) → ListingTile[]
│   ├── searchListings.ts             (query, filters) → SearchResult
│   ├── getListingsByCity.ts          (slug, filters) → ListingTile[]
│   ├── getListingsByNeighborhood.ts  (citySlug, slug, filters) → ListingTile[]
│   ├── getListingsByCommunity.ts     (slug, filters) → ListingTile[]
│   ├── getListingsByZip.ts           (zip, filters) → ListingTile[]
│   └── resolveListingByAddress.ts    (citySlug, addressSlug) → string | null
├── videos/
│   ├── getListingVideos.ts           (key) → VideoEmbed[]   ← THE 3-TIER FALLBACK
│   └── resolveVideoSource.ts         (rawUrl) → VideoEmbed
├── geo/
│   ├── getCityLP.ts                  (slug) → CityLPData | null
│   ├── getNeighborhoodLP.ts          (citySlug, slug) → NeighborhoodLPData | null
│   ├── getCommunityLP.ts             (slug) → CommunityLPData | null
│   ├── getZipLP.ts                   (zip) → ZipLPData | null
│   ├── listCities.ts                 () → CityRow[]
│   ├── listCommunities.ts            () → CommunityRow[]
│   └── getNeighborhoodBoundary.ts    (slug) → GeoJSON | null
├── market/
│   ├── getMarketStats.ts             (geoType, slug) → MarketStats
│   ├── getMarketPulse.ts             (geoType, slug) → MarketPulse
│   ├── getPriceHistory.ts            (geoType, slug, periodType) → PriceHistoryPoint[]
│   └── getMarketReport.ts            (slug) → MarketReport | null
├── brokers/
│   ├── getBrokers.ts                 () → Broker[]
│   ├── getBrokerByEmail.ts           (email) → Broker | null
│   └── resolveListingAgent.ts        (listingDetail) → Broker | null
├── activity/
│   ├── getRecentActivity.ts          (limit) → ActivityEvent[]
│   └── subscribeActivity.ts          (cb) → Unsubscribe (client-only)
├── leads/
│   ├── createBuyerLead.ts            (input) → LeadResult
│   ├── createSellerLead.ts           (input) → LeadResult
│   └── createExpiredLead.ts          (input) → LeadResult
└── cache/
    ├── unstable-cache.ts             Wrapper with sane defaults
    └── redis.ts                      Upstash Redis wrapper
```

### Function signature pattern (every function follows)

```typescript
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/data/client'
import type { ListingDetail } from '@/lib/data/types/listing'

const InputSchema = z.object({ listingKey: z.string().min(1).max(100) })

export const getListingDetail = unstable_cache(
  async (listingKey: string): Promise<ListingDetail | null> => {
    InputSchema.parse({ listingKey })
    const { data, error } = await supabaseServer
      .from('listing_detail_mv')                     // ← MV only, never raw listings
      .select('*')
      .eq('listing_key', listingKey)
      .maybeSingle()
    if (error) { console.error('[getListingDetail]', { listingKey, error }); return null }
    return data
  },
  ['listing-detail'],
  { revalidate: 60, tags: ['listings', `listing:${listingKey}`] }
)
```

### Listing videos — the 3-tier fallback (corrects my earlier misunderstanding)

```typescript
// lib/data/videos/getListingVideos.ts
export async function getListingVideos(listingKey: string): Promise<VideoEmbed[]> {
  // Tier 1: our own published renders (rare — only our 3 listings if we publish them)
  const our = await getOurPublishedVideos(listingKey)
  if (our.length) return our

  // Tier 2: video_tours_cache — MLS-supplied, professionally produced, nightly refreshed
  // (Aryeo, Riley Visuals, Vimeo, YouTube, Cloudflare Stream — agent paid videographer)
  const cached = await getFromVideoToursCache(listingKey)
  if (cached.length) return cached

  // Tier 3: raw listings.details.Videos JSONB from MLS feed
  const raw = await getFromListingsDetailsVideos(listingKey)
  return raw
}

type VideoEmbed = {
  source: 'our-render' | 'mls-aryeo' | 'mls-vimeo' | 'mls-youtube' | 'mls-cloudflare-stream' | 'mls-direct-mp4' | 'mls-other'
  embedType: 'iframe' | 'video-tag'
  url: string
  posterUrl?: string
  durationSeconds?: number
  orientation?: 'portrait' | 'landscape' | 'square'
  professional: boolean           // true for any MLS-supplied
}
```

**The site embeds whatever the listing agent paid for via MLS. We don't render videos for other agents' listings.**

### Caching per function

| Function | Layer | Revalidate | Tags |
|---|---|---|---|
| getListingDetail | unstable_cache + ISR | 60s | listings, listing:{key} |
| getListingTile | unstable_cache | 60s | listings |
| getSimilarListings | unstable_cache | 300s | listings |
| searchListings | none | — | — |
| getListingsByCity | unstable_cache | 120s | listings, city:{slug} |
| getListingVideos | unstable_cache | 600s | listings, videos |
| getCityLP | unstable_cache | 120s | city:{slug} |
| getNeighborhoodLP | unstable_cache | 300s | neighborhood:{slug} |
| getCommunityLP | unstable_cache | 120s | community:{slug} |
| getMarketStats | unstable_cache | 21600s (6h) | market |
| getMarketPulse | unstable_cache | 900s (15min) | market |
| getRecentActivity | unstable_cache | 60s | activity |
| getBrokers | unstable_cache | 86400s | brokers |

Redis (Upstash, already in middleware):
- `slug:{citySlug}:{addressSlug}` → listingKey, 10min TTL (replaces the 1,000-row JS fetch)
- Rate limiting (existing)

### Error handling

- Every function returns `T | null` for "not found"
- Errors logged via `console.error` with structured context (Sentry breadcrumbs auto)
- No throws to page render code

### Enforcement — ESLint rule (the actual guardrail)

```json
// .eslintrc.json
{
  "rules": {
    "no-restricted-syntax": ["error", {
      "selector": "CallExpression[callee.property.name='from'][arguments.0.value=/^(listings|listing_videos|video_tours_cache|listing_history|market_stats_cache|market_pulse_live|engagement_metrics|properties|neighborhoods|communities|cities|listing_photos|listing_agents|open_houses|boundaries|neighborhood_subdivisions|subdivision_flags|app_config|activity_events|expired_listings|cmas|cma_comps)$/]",
      "message": "Direct supabase.from() on this table is banned. Use the canonical function from @/lib/data/ instead. See docs/DATA_ACCESS_LAYER.md."
    }]
  },
  "overrides": [{
    "files": ["lib/data/**/*.ts"],
    "rules": { "no-restricted-syntax": "off" }
  }]
}
```

ONLY `lib/data/*` files can touch Supabase tables. Every other file is forced through the canonical API. ESLint fails CI on violation.

---

## 5. Materialized views — the speed foundation (per ADR-001)

Four MVs. Refreshed on Spark sync completion (every 10 min). All `WITH DATA`, all `CONCURRENTLY` refreshable.

### MV 1 — `listing_tile_mv`

Compact projection per listing for tiles + cards. Replaces 50+ column projection. Pre-computes address slug + geometry point.

Indexes: unique on listing_key, composite (city_lower, standard_status, modified_at DESC) WHERE active, (city_lower, address_slug) for URL resolution, GiST geo, GIN search vector.

Used by: `getListingTile`, `getListingsByCity`, `getListingsByNeighborhood`, `getListingsByCommunity`, `searchListings`, map views.

### MV 2 — `geo_snapshot_mv`

One row per city + per community + per neighborhood with: active count (SFR + all), pending count, median list price, community count, banner URL. Pre-aggregated.

Indexes: unique (geo_type, geo_key).

Used by: `getCityLP`, `getCommunityLP`, `getNeighborhoodLP`, `getZipLP`.

### MV 3 — `listing_detail_mv`

Wide pre-joined row per listing. All RETS fields + photos JSONB (cap to first 20) + agent fields + community + neighborhood + city context. Eliminates the 5-serial-await chain.

Refresh: per-row trigger on `listings` INSERT/UPDATE.

Indexes: unique (listing_key), (city_slug_computed, address_slug), (community_slug) WHERE NOT NULL.

Used by: `getListingDetail`.

### MV 4 — `similar_listings_mv`

Precomputed nearest 12 per active listing. Scope to `StandardStatus = 'Active'` only (~2K rows).

Indexes: unique (anchor_key, similar_key), (anchor_key, rank).

Used by: `getSimilarListings`.

### Refresh wiring

Edit `/api/cron/sync-delta`:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY public.listing_tile_mv;
REFRESH MATERIALIZED VIEW CONCURRENTLY public.geo_snapshot_mv;
```

`listing_detail_mv` refresh via per-row trigger. `similar_listings_mv` nightly cron.

Fallback `*/30` cron in `vercel.json` if post-sync hook fails.

---

## 6. Missing indexes (per ADR-001)

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY idx_listings_sub_city_status
  ON public.listings ("SubdivisionName", "City", "StandardStatus");

CREATE INDEX CONCURRENTLY idx_listings_city_trgm
  ON public.listings USING gin ("City" gin_trgm_ops);

CREATE INDEX CONCURRENTLY idx_listings_subdivision_trgm
  ON public.listings USING gin ("SubdivisionName" gin_trgm_ops);

CREATE INDEX CONCURRENTLY idx_listings_list_agent_email
  ON public.listings ("ListAgentEmail")
  WHERE "ListAgentEmail" IS NOT NULL;

CREATE INDEX CONCURRENTLY idx_listings_city_active_tile
  ON public.listings ("City", "StandardStatus", "ModificationTimestamp" DESC NULLS LAST,
    "ListPrice", "BedroomsTotal", "BathroomsTotal", "TotalLivingAreaSqFt",
    "SubdivisionName", "PhotoURL", "StreetNumber", "StreetName",
    "PostalCode", "Latitude", "Longitude")
  WHERE "StandardStatus" IN ('Active', 'Coming Soon', 'Active Under Contract', 'Pending');
```

All CONCURRENTLY, no downtime.

---

## 7. ILIKE → EQ patch (zero-risk Step 1, 60-80% TTFB win)

Per `/tmp/ILIKE_TO_EQ_PATCH.md`:
- 52 call sites identified
- Canonical city name list verified live: Bend, Redmond, La Pine, Sisters, Sunriver, Prineville, Madras, Terrebonne, Powell Butte, Culver, etc.
- Slug → canonical name table documented
- Edge case: `listing-detail.ts:313` needs title-casing transform

No schema changes. No migrations. Reversible by single revert.

---

## 8. Competitive positioning (from the competitive-brief skill framework)

### Executive summary

The Central Oregon real estate web landscape splits into two tiers. **Tier 1** (Cascade Sotheby's, Engel & Völkers, Compass) have content infrastructure or brand positioning. **Tier 2** (Coldwell Banker, Windermere, Stellar, RE/MAX) have functional listing tools but zero editorial voice. **Nobody publishes live neighborhood-level market data on their site.** That's the moat.

### Positioning statement

> For Central Oregon home buyers and sellers who want honest, specific local guidance, **Ryan Realty** is the brokerage website that gives you the actual numbers — median price for THIS subdivision, DOM in THIS neighborhood, and a real broker's direct cell — because we own the data and we don't hide behind clichés.

### Per-competitor messaging analysis

**Cascade Sotheby's / Hasson SIR:** Premium positioning, regional market reports, video channel (CascadeLife.TV), Asia Desk. Vulnerability: Cloudflare bot-blocking hurts SEO, jQuery 1.8 / slow, listing detail not fetchable to crawlers.

**Compass Bend:** "Find an agent who knows your market best." Agent-first not property-first. Vulnerability: zero Bend-specific market content, no local moat.

**Engel & Völkers Bend:** "Local experts with a passion for exceeding expectations." Vulnerability: cliché-dense, client-side renders so first-paint is slow, no proof beyond superlatives.

**Coldwell Banker Bain:** Best search (1,399 Bend listings, real-time freshness). Vulnerability: zero editorial voice, hides DOM, high lead-capture friction.

**Windermere Central Oregon:** Subdomain 302-redirects to national windermere.com with zero Bend content. Functional moat is gone.

**Stellar Realty NW:** *"We love this business. We really do."* Cliché-dense, 2018 data, no market intelligence. Easy to beat.

**RE/MAX Key Properties:** TLS misconfiguration blocks crawlers + some mobile browsers. Effectively invisible online.

**National premium (Zillow Showcase / Redfin / Compass / Realtor):** AI-labeled floor plans, 3D Home, climate risk, Zestimate, "Hot Homes" demand meter. Vulnerabilities: AI floor-plan labels are inaccurate on open layouts, climate risk is buried, lead capture is account-walled, no agent relationship surfaced at the listing level.

### What we MATCH (Zillow Showcase parity — table stakes)

- ☐ Cinematic photo gallery (50+ photos, lazy-loaded, fullscreen, AVIF)
- ☐ Listing video embedded at hero (via `getListingVideos` — MLS-supplied, professional)
- ☐ 3D tour (Matterport iframe when present in MLS feed)
- ☐ Floor plan (when MLS has it)
- ☐ Climate risk scores (First Street Foundation API — 5 categories)
- ☐ School data (GreatSchools + MLS school district fields)
- ☐ Walk Score (WalkScore API)
- ☐ Property history (from `listing_history`)
- ☐ Mortgage calculator inline
- ☐ Similar listings (from `similar_listings_mv`)
- ☐ Save / share
- ☐ Schedule tour CTA
- ☐ Mobile sticky CTAs

### What we BEAT (the moats — ranked by impact × feasibility)

| Rank | Feature | Feasibility | Impact |
|---|---|---|---|
| 1 | **Live neighborhood market context panel** — pulls `getMarketStats('neighborhood', slug)` for THIS subdivision: median, DOM, MoS, YoY. Inline below price. **No competitor does this.** | High (data exists) | Very High |
| 2 | **"Text Matt: 541.213.6706"** sticky CTA | High (1 link) | High |
| 3 | **Agent-authored narrative** — brand-voice-compliant property description, not MLS boilerplate | High (editorial) | High |
| 4 | **Price/sqft vs neighborhood pill** — inline value transparency | High (Supabase query) | High |
| 5 | **DOM shown prominently** (Coldwell hides it; we surface as trust signal) | Very High (1 field) | Medium-High |
| 6 | **Bend lifestyle data** — minutes to Mt. Bachelor, Deschutes River trail, brewery counts | High (static per listing) | Medium-High |
| 7 | **Transparent CMA summary** — "Priced from 6 recent comps" with PDF link | Medium (CMA workflow) | High |
| 8 | **Open house live countdown** | Medium (scheduling integration) | Medium-High |
| 9 | **Broker walkthrough video** (when recorded) — authentic, 30s | Medium (production) | High |
| 10 | **Real-time listing freshness pill** ("Updated 12 min ago" — beats Zillow's lag) | High (via `market_pulse_live`) | Medium-High |

### Voice differentiator

| ✗ Competitor copy | ✓ Ryan Realty copy |
|---|---|
| "Stunning custom home, must-see!" | "3 bd · 2 ba · 1,820 sqft. New roof 2023. HOA $0. 38 days on market." |
| "We pride ourselves on top notch service" | "Your local team. Thirty-seven closings in Bend last year." |
| "Beautifully maintained, move-in ready" | "Median sale in this subdivision last quarter: $895k. This list: $312/sqft vs neighborhood median $289/sqft." |

---

## 9. Execution order — wave by wave (every step listed)

Each wave is sequential because of dependencies. Inside each wave, work is parallel where possible. Every commit gates through draft-first review.

### WAVE 0 — Foundation (Day 1–2)

Every commit after this point is gated by CI.

- **0.1** Save existing draft artifacts to repo (after Matt review):
  - `/tmp/SITE_SPEC_DRAFT.md` → `docs/SITE_SPEC.md`
  - `/tmp/ADR_001_DATA_LAYER.md` → `docs/architecture/ADR_001_DATA_LAYER.md`
  - `/tmp/ILIKE_TO_EQ_PATCH.md` → `docs/patches/ILIKE_TO_EQ_PATCH.md`
  - `/tmp/RYAN_REALTY_FULL_PLAN.md` → `docs/EXECUTION_PLAN.md`
  - Write `docs/DATA_ACCESS_LAYER.md` — full DAL contract doc
  - Write `AGENTS.md` at repo root — shared rule surface

- **0.2** Wire Lighthouse CI into `.github/workflows/CI.yml`:
  - Add `lhci autorun --config=./lighthouserc.cjs` step
  - Initial threshold `0.85` (tighten to 0.90 after baseline)
  - Block PRs on regression

- **0.3** Extend `scripts/lint-design-tokens.js`:
  - Add retired font detection (Playfair, AzoSans in web, Helvetica, Inter)
  - Add `backgroundImage: url(...)` hero detection
  - Add non-canonical broker headshot path detection

- **0.4** Add 5 ESLint rules to `.eslintrc`:
  - DAL boundary (no raw `from('listings')` outside `lib/data/`)
  - `force-dynamic` + `revalidate` coexistence
  - Raw hex in JSX className/style
  - Sentry `tracesSampleRate > 0.2`
  - Missing `generateStaticParams` on `[slug]` routes

- **0.5** Scaffold `lib/data/`:
  - Create full directory tree (above)
  - Write `client.ts`, `cache/unstable-cache.ts`, `cache/redis.ts`
  - Write every `types/*.ts` file with TypeScript interfaces
  - Stub every function file with signature + throw `NotImplementedError`

- **0.6** Contract tests scaffolded:
  - `lib/data/*/__tests__/*.test.ts` — one per function
  - Vitest config wired into CI

- **0.7** Drop Sentry `tracesSampleRate: 1` → `0.1` in `sentry.server.config.ts` and `sentry.edge.config.ts`

**Commit: foundation lands. Diff shown. After approval: push.**

### WAVE 1 — Data layer (Day 3–5)

- **1.1** Apply ILIKE → EQ patch (per `/tmp/ILIKE_TO_EQ_PATCH.md`)
  - 52 call sites
  - Manual smoke test: hit `/cities/bend`, `/communities/tetherow` locally
  - Measure TTFB before/after with `time curl -s localhost:3000/cities/bend -o /dev/null`
- **Commit: ILIKE → EQ patch lands. 60-80% TTFB improvement.**

- **1.2** Add 5 missing indexes via Supabase migration (all CONCURRENTLY)
- **Commit: indexes land.**

- **1.3** Build `listing_tile_mv` + indexes + `getListingTile` / `getListingsBy*` functions
- **Commit: listing_tile_mv lands.**

- **1.4** Build `geo_snapshot_mv` + `getCityLP` / `getNeighborhoodLP` / `getCommunityLP` / `getZipLP`
- **Commit: geo_snapshot_mv lands.**

- **1.5** Build `listing_detail_mv` + per-row trigger + `getListingDetail`
- **Commit: listing_detail_mv lands.**

- **1.6** Build `similar_listings_mv` + `getSimilarListings`
- **Commit: similar_listings_mv lands.**

- **1.7** Wire MV refresh into `/api/cron/sync-delta`. Add `*/30` fallback cron.
- **Commit: MV refresh pipeline lands.**

- **1.8** Implement remaining DAL functions:
  - `getListingVideos` (3-tier fallback)
  - `getMarketStats` / `getMarketPulse` / `getPriceHistory`
  - `getBrokers` / `resolveListingAgent`
  - `getRecentActivity` / `subscribeActivity`
  - `createBuyerLead` / `createSellerLead` / `createExpiredLead`
- **Commit: full DAL functional.**

- **1.9** Migrate every page in `app/` to import from `@/lib/data/`:
  - Find every raw `from('table')` outside `lib/data/`
  - Replace with canonical function import
  - ESLint rule starts passing
  - Smoke test every route
- **Commit: every page on the DAL. Boundary rule active.**

### WAVE 2 — Visual layer (Week 2–4)

#### Layer 1 — Atomic primitives (3 days)
- `<Price>` (rounds to thousand, tabular)
- `<TabularNumber>`, `<PercentChange>`, `<DaysCount>`
- `<DisplayHeading>` (Amboqia), `<H1>`, `<H2>`, `<H3>`, `<Body>`, `<Caption>`, `<Eyebrow>`
- `<Logo>`, `<RyanRealtyMark>`, `<JaxMascot>`, `<MiddleDot>`
- `<CTAButton>`, `<TextLink>`, `<IconButton>`, `<BadgePill>` (on shadcn primitives)
- `<Container>`, `<Section>`, `<Stack>`, `<Grid>`
- Storybook entries for each
- **Commit per primitive after Matt review.**

#### Layer 2 — Layout shell (2 days)
- `<SiteHeader>` (matches mockup — navy bg, nav, search, mobile menu, sign in + list-your-home)
- `<SiteFooter>` (matches mockup — navy bg, 4 columns, partners, legal with license # 201206613, dotted phone, hyphen URL, middle-dot separator)
- `<MobileNav>` (sheet/drawer)
- `<RootProvider>` (Supabase + Sentry + GA + brand consent)
- `<MetadataBlock>` (OG + Twitter + JSON-LD per page)
- **Commit per shell component.**

#### Layer 3 — LP composition blocks (5 days)
- `<HeroBlock>` (canonical Old Mill kenburns + headline + lede + search bar)
- `<MarketStatsBlock>` (4 stat cards from `getMarketStats` + `getMarketPulse`)
- `<ListingsGrid>` + `<ListingCard>` (replaces every legacy ListingCard variant)
- `<NeighborhoodMap>` (dynamic-imported Google Maps with PostGIS polygon overlay)
- `<PriceChart>` (dynamic-imported recharts)
- `<LeadCaptureBlock>` (single form, FUB-wired, 4 variants: buyer/seller/expired/inquiry)
- `<BrokerCard>` (canonical transparent PNG, no rectangular frame)
- `<ContentSection>`, `<CTABar>`, `<BreadcrumbNav>`, `<FAQBlock>`, `<RelatedAreas>`
- `<PriceRangeTiles>`, `<CityGrid>`, `<ActivityFeed>` (Supabase Realtime subscription on `activity_events`)
- `<SocialProofBlock>`, `<TestimonialBlock>`
- **Commit per block after Matt review.**

#### Layer 4 — Listing detail surface (4 days)
- `<ListingDetailShell>`
- `<ListingVideoEmbed>` (uses `getListingVideos`, falls through tiers, autoplay muted on land, tap to unmute)
- `<PhotoGallery>` (lazy beyond fold, AVIF first, fullscreen, photo count)
- `<PriceBlock>` (rounded, status pill, DOM prominently, change history)
- `<PropertySpecs>` (beds/baths/sqft/lot/year/HOA/taxes/MLS#)
- `<DescriptionBlock>` (voice-scrubbed remarks, brand-voice gate at commit time)
- `<ListingAgentCard>` (broker resolved by `resolveListingAgent`, transparent PNG)
- `<MortgageCalculator>` (fresh interactive island)
- `<SimilarListings>` (uses `getSimilarListings`)
- `<PropertyHistory>`, `<OpenHouses>`, `<VacationRentalPotential>`, `<NearbySchools>`
- `<NeighborhoodMarketContext>` — **THE ZILLOW BEATER. Live market stats for THIS subdivision via `getMarketStats('neighborhood', slug)`.**
- `<PriceVsNeighborhoodPill>` — inline value transparency
- `<BendLifestylePanel>` — minutes to Mt. Bachelor, Deschutes River trail, brewery count, school walking distance
- `<TextMattCTA>` (sticky bottom on mobile, prominent on desktop)
- `<TransparentCMASummary>` (when CMA exists for this listing)
- `<ClimateRiskBlock>` (First Street Foundation API)
- **Commit per surface component after Matt review.**

### WAVE 3 — Page rebuild (Week 4–6)

For each route in this order:

1. Identify component composition from mockup
2. Wire data through DAL functions only
3. Add `generateStaticParams` for dynamic routes (top 20 cities/communities, all 14 neighborhoods, all top listings)
4. Set `revalidate` per acceptance criteria
5. Run Lighthouse locally
6. Visual diff against mockup section
7. **Commit. Matt reviews. After approval: push. Vercel deploys.**

Order:
- `/` (homepage) — must match `ui_kits/website/index.html` exactly
- `/listing/[listingKey]` — the Zillow Showcase beater
- `/cities/[slug]` — all 11
- `/cities/[slug]/[neighborhood]` — all 14 Bend neighborhoods
- `/communities/[slug]` — all 14 resort communities
- `/zip/[zip]` — all 10+
- `/lp/seller-home-value`, `/lp/buyer-listing-alerts`, `/lp/expired-listing`
- `/housing-market/reports/[slug]`
- `/search`
- `/sell`, `/about`, `/team`

Delete orphans during this wave:
- `/listings/[listingKey]` (SSR no-cache duplicate of `/listing/[listingKey]`)
- `/listing/by-address/[...slug]`, `/listing/by-key/[listingKey]` (redirect shims)
- `/app/lp/bend`, `/app/lp/tetherow`, `/app/lp/tetherow/heath` (replace with canonical city/community LPs)
- `/app/reports/*` (consolidate with `/housing-market/reports/`)
- Legacy components in `components/lp/`, `components/city/`, `components/neighborhood/`, `components/geo-page/`, `components/listing/showcase/`, `components/seller-lp/`, `components/home/` (replaced by Wave 2 layer)

### WAVE 4 — Premium listing detail features (Week 5–6, concurrent with Wave 3 listing page)

Match-then-beat checklist (Section 8). Every item lands as a separate commit through Wave 4.

### WAVE 5 — Ship + measure (Week 6–7)

- **5.1** Production deploy via Vercel push (already automatic on main)
- **5.2** Lighthouse CI active on every PR
- **5.3** Monitor Vercel Analytics for 7 days:
  - TTFB p50/p95 per LP route
  - LCP p75 per route
  - Bundle size per route
  - Error rate per route
- **5.4** If any acceptance criterion fails: fix + reship before next iteration
- **5.5** Promote ryanrealty.vercel.app → ryan-realty.com (DNS + SSL)
- **5.6** Final SEO sweep:
  - sitemap.xml validated
  - robots.txt validated
  - Structured data validated via Google Rich Results Test
  - Google Search Console verification
  - All canonical URLs set

---

## 10. CI gates (every PR must pass)

```yaml
# .github/workflows/CI.yml
jobs:
  build:
    - npm run build
  lint:
    - npm run lint                      # ESLint with all custom rules
    - npm run ci:design-tokens          # extended scripts/lint-design-tokens.js
    - npm run ci:dal-boundary           # new scripts/check-dal-boundary.mjs
    - npm run ci:brand-voice            # new scripts/check-brand-voice.mjs
    - npm run ci:seo-routes             # existing
  test:
    - npm run test                      # Vitest contract tests
  lighthouse:
    - lhci autorun --config=./lighthouserc.cjs
  bundle:
    - npm run analyze                   # per-route budget ≤ 250 KB
```

No PR merges unless every check is green. No overrides.

---

## 11. Roles + execution rhythm

- I do the code work in this terminal.
- Every commit: I write, I run `npm run build && npm run lint && npm run test` locally, I show you the diff via `git status` + `git diff --stat`.
- You review at every commit gate per draft-first rule.
- After your "go" / "ship it" / "approved": I commit + push immediately. No PRs, no feature branches.
- Production deploys via Vercel automatic on push.
- We work until every acceptance criterion is green. No phases. No audits between. No "we'll do this next quarter."

---

## 12. Listing video reality (correction)

- MLS-supplied professional videos are already in our DB via the nightly Spark sync.
- Agents pay videographers (Aryeo, Riley Visuals, Walker & Homes, Vimeo creators, etc.). Videographers deliver. Agent uploads to MLS. MLS feeds us via `listings.details.Videos` → cached nightly into `video_tours_cache`.
- `video_tours_cache` has 48 luxury listings with embeds today (16 Vimeo, 8 YouTube, 6 Aryeo, 2 Cloudflare Stream, 5 Riley Visuals, etc.).
- `getListingVideos(key)` in the DAL is the single way pages get them.
- Our Remotion pipeline matters only for the 3 listings WE list — bonus content.
- The site embeds whatever the listing agent paid for.

---

## 13. Risk register

| Risk | Mitigation |
|---|---|
| `listing_detail_mv` ~3 GB storage | Cap photos JSONB to 20 in MV; full array on-demand |
| MV refresh delays sync | `CONCURRENTLY` doesn't lock reads; defer 30s after sync |
| Per-row trigger breaks under concurrent updates | Use `ON CONFLICT DO UPDATE` not DELETE+INSERT |
| `tag_all_listings_boundaries()` OOM on 589K | Batch 10K rows with `pg_sleep(0.1)` |
| Stale MV if cron silently fails | `refreshed_at` column per MV; alert if stale > 1h |
| Vercel ISR not invalidating after MV refresh | `revalidateTag()` from post-sync pipeline |
| Lighthouse perf < 90 on initial baseline | Initial threshold 0.85, tighten weekly |
| Bundle size > 250 KB on a route | bundle analyzer flags in CI; investigate per-route |

---

## 14. What's NOT in scope

- `marketing_brain_skills/` (content generation pipeline)
- `video_production_skills/` (Remotion video production — except for the canonical `<ListingVideoEmbed>` consumer)
- Social posting automation
- Transaction coordination (SkySlope, Vault, OREF forms)
- The 46 cron jobs not related to web rendering
- Email/SMS sends (FUB handles those via its own action plans)

---

## 15. First three commits (concrete starting point)

When Matt says "go":

**Commit 1 — Foundation:**
- `docs/SITE_SPEC.md` (from `/tmp/SITE_SPEC_DRAFT.md`)
- `docs/architecture/ADR_001_DATA_LAYER.md` (from `/tmp/ADR_001_DATA_LAYER.md`)
- `docs/EXECUTION_PLAN.md` (this document)
- `docs/DATA_ACCESS_LAYER.md` (new — DAL contract)
- `AGENTS.md` at repo root
- Extended `scripts/lint-design-tokens.js`
- 5 new ESLint rules in `.eslintrc`
- Lighthouse CI wired into `.github/workflows/CI.yml`
- Sentry `tracesSampleRate: 0.1`

**Commit 2 — ILIKE → EQ patch:**
- 52 call sites rewritten
- Smoke test passing
- Measured TTFB improvement documented

**Commit 3 — DAL scaffold:**
- Full `lib/data/` directory
- All type files
- All function signatures (stubbed)
- Contract tests scaffold
- `lib/data/client.ts`, `cache/*.ts`

After Commit 3, every subsequent commit replaces a stub with a real implementation, replaces a page's raw query with a DAL import, or adds a component. Every commit is gated.

---

**This is the full plan. Ready to execute end-to-end.**

When you say "go" I start with Commit 1.
