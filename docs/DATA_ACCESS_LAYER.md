# Data Access Layer — Canonical Contract

**Status:** Active — every page on the site MUST get data through this layer.
**Enforced by:** ESLint rule + `scripts/check-dal-boundary.mjs` (runs in CI).
**Source of truth:** `lib/data/*` is the ONLY place that may call `supabase.from('<table>')` for the tables listed below.

---

## The rule

Every page in `app/`, every component in `components/`, every script outside `lib/data/` MUST import data access from `@/lib/data/`. No exceptions.

```ts
// ✅ ALLOWED
import { getListingDetail } from '@/lib/data/listings/getListingDetail'

const listing = await getListingDetail(listingKey)
```

```ts
// ❌ BANNED outside lib/data/ — ESLint blocks this
import { supabase } from '@/lib/supabase/client'

const { data } = await supabase
  .from('listings')
  .select('*')
  .eq('"ListingKey"', listingKey)
  .single()
```

**Why:** Every page that touches data gets the same caching, the same retry logic, the same schema contract, the same observability. No more page-by-page snowflake queries that drift apart over time. One way to get every piece of data. ESLint blocks every other way.

---

## Banned tables (must go through `lib/data/`)

Every `supabase.from()` call with these table names outside `lib/data/` is a CI failure:

```
listings
listing_videos
video_tours_cache
listing_history
market_stats_cache
market_pulse_live
engagement_metrics
properties
neighborhoods
communities
cities
listing_photos
listing_agents
open_houses
boundaries
neighborhood_subdivisions
subdivision_flags
app_config
activity_events
expired_listings
cmas
cma_comps
```

Add a table to this list when a new domain object lands. Update `eslint.config.mjs` AND `scripts/check-dal-boundary.mjs` together.

---

## Directory structure

```
lib/data/
├── index.ts                          Re-exports every public function
├── client.ts                         Supabase server + browser clients
├── types/                            TypeScript contracts (the schema)
│   ├── listing.ts                    Listing, ListingDetail, ListingTile, ListingStatus
│   ├── geo.ts                        City, Neighborhood, Community, Zip, GeoSlug, GeoType
│   ├── market.ts                     MarketStats, MarketPulse, MoSVerdict, PriceHistoryPoint
│   ├── video.ts                      ListingVideo, VideoEmbed, VideoSource
│   ├── broker.ts                     Broker, BrokerSlug
│   ├── activity.ts                   ActivityEvent
│   ├── lead.ts                       BuyerLead, SellerLead, ExpiredLead, LeadResult
│   └── shared.ts                     Currency, Slug, IsoDate, common scalars
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
│   ├── getListingVideos.ts           (key) → VideoEmbed[]   ← 3-tier MLS fallback
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
│   └── subscribeActivity.ts          (cb) → Unsubscribe  (client-only)
├── leads/
│   ├── createBuyerLead.ts            (input) → LeadResult
│   ├── createSellerLead.ts           (input) → LeadResult
│   └── createExpiredLead.ts          (input) → LeadResult
└── cache/
    ├── unstable-cache.ts             Wrapper with sane defaults
    └── redis.ts                      Upstash Redis wrapper
```

---

## Function signature pattern (every function follows)

```ts
import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { supabaseServer } from '@/lib/data/client'
import type { ListingDetail } from '@/lib/data/types/listing'

// Input validation
const InputSchema = z.object({
  listingKey: z.string().min(1).max(100),
})

// Output contract
export type GetListingDetailResult = ListingDetail | null

// The function — typed, validated, cached, observable
export const getListingDetail = unstable_cache(
  async (listingKey: string): Promise<GetListingDetailResult> => {
    InputSchema.parse({ listingKey })

    const { data, error } = await supabaseServer
      .from('listing_detail_mv')              // ← MV only, never raw listings
      .select('*')
      .eq('listing_key', listingKey)
      .maybeSingle()

    if (error) {
      console.error('[getListingDetail]', { listingKey, error })
      return null
    }

    return data
  },
  ['listing-detail'],                          // cache key prefix
  { revalidate: 60, tags: ['listings'] }       // cache TTL + invalidation tags
)
```

Every function:

1. **Validates input** with Zod
2. **Returns typed output** (always `T | null` for "not found")
3. **Logs errors with structured context** (Sentry breadcrumbs auto)
4. **Reads from materialized views**, never raw `listings` for aggregation
5. **Wraps in `unstable_cache`** with appropriate TTL + tags
6. **Has a contract test** at `lib/data/<domain>/__tests__/<function>.test.ts`

---

## Listing videos — the 3-tier MLS fallback (the canonical example)

Most listing videos are NOT ours. Agents pay professional videographers (Aryeo, Riley Visuals, Walker & Homes, Vimeo creators, Cloudflare Stream operators). The videographer delivers the file. The agent uploads to MLS. MLS feeds us via the Spark sync. We embed.

`getListingVideos(key)` falls through three tiers:

```ts
// lib/data/videos/getListingVideos.ts
export async function getListingVideos(listingKey: string): Promise<VideoEmbed[]> {
  // Tier 1: our own publishes (rare — only the 3 listings we list, if uploaded)
  const our = await getOurPublishedVideos(listingKey)
  if (our.length) return our

  // Tier 2: video_tours_cache — MLS-supplied, professionally produced,
  // nightly refreshed from Spark. 48 luxury listings as of 2026-05-22.
  // Aryeo, Riley Visuals, Vimeo, YouTube, Cloudflare Stream.
  const cached = await getFromVideoToursCache(listingKey)
  if (cached.length) return cached

  // Tier 3: raw listings.details.Videos JSONB from MLS feed.
  // Catches any video URL not yet aggregated into video_tours_cache.
  const raw = await getFromListingsDetailsVideos(listingKey)
  return raw
}

type VideoEmbed = {
  source:
    | 'our-render'
    | 'mls-aryeo'
    | 'mls-vimeo'
    | 'mls-youtube'
    | 'mls-cloudflare-stream'
    | 'mls-direct-mp4'
    | 'mls-other'
  embedType: 'iframe' | 'video-tag'
  url: string
  posterUrl?: string
  durationSeconds?: number
  orientation?: 'portrait' | 'landscape' | 'square'
  professional: boolean    // true for any MLS-supplied
}
```

The listing detail page embeds whatever `getListingVideos()` returns. We do not render videos for other agents' listings.

---

## Caching strategy per function

| Function | Layer | Revalidate | Tags |
|---|---|---|---|
| getListingDetail | unstable_cache + ISR | 60s | listings, listing:{key} |
| getListingTile | unstable_cache | 60s | listings |
| getSimilarListings | unstable_cache | 300s | listings |
| searchListings | none (user-parameterized) | — | — |
| getListingsByCity | unstable_cache | 120s | listings, city:{slug} |
| getListingsByNeighborhood | unstable_cache | 120s | listings, neighborhood:{slug} |
| getListingsByCommunity | unstable_cache | 120s | listings, community:{slug} |
| getListingVideos | unstable_cache | 600s | listings, videos |
| getCityLP | unstable_cache | 120s | city:{slug} |
| getNeighborhoodLP | unstable_cache | 300s | neighborhood:{slug} |
| getCommunityLP | unstable_cache | 120s | community:{slug} |
| getZipLP | unstable_cache | 300s | zip:{zip} |
| getMarketStats | unstable_cache | 21600s (6h) | market |
| getMarketPulse | unstable_cache | 900s (15min) | market |
| getRecentActivity | unstable_cache | 60s | activity |
| getBrokers | unstable_cache | 86400s (1d) | brokers |
| getMarketReport | unstable_cache | 3600s | market |

### Redis (Upstash — already wired in middleware for rate limiting)

| Key | TTL | Purpose |
|---|---|---|
| `slug:{citySlug}:{addressSlug}` | 600s | Address-slug → listing_key resolution (replaces 1,000-row JS fetch) |

### Cache invalidation

- `revalidateTag('listings')` — called from `/api/cron/sync-delta` after Spark sync
- `revalidateTag('listing:{key}')` — called from per-listing webhooks
- `revalidateTag('market')` — called after `market_stats_cache` refresh
- `revalidateTag('city:{slug}')` — called when city data changes

---

## Error handling

- Every function returns `T | null` for "not found"
- Errors logged via `console.error` with structured context: `{ functionName, input, error }`
- Sentry breadcrumbs auto-attach via the Next.js instrumentation
- No throws to page render code — pages get `null` and render a graceful empty state

---

## Enforcement

### ESLint rule (in `eslint.config.mjs`)

```js
{
  rules: {
    'no-restricted-syntax': ['error', {
      selector: "CallExpression[callee.property.name='from'][arguments.0.value=/^(listings|listing_videos|video_tours_cache|listing_history|market_stats_cache|market_pulse_live|engagement_metrics|properties|neighborhoods|communities|cities|listing_photos|listing_agents|open_houses|boundaries|neighborhood_subdivisions|subdivision_flags|app_config|activity_events|expired_listings|cmas|cma_comps)$/]",
      message: "Direct supabase.from('<table>') is banned outside lib/data/. Use the canonical function from @/lib/data/ instead. See docs/DATA_ACCESS_LAYER.md."
    }]
  }
},
// Allow inside lib/data/:
{
  files: ['lib/data/**/*.ts'],
  rules: { 'no-restricted-syntax': 'off' }
}
```

### CI script (`scripts/check-dal-boundary.mjs`)

Run on every PR. Greps every file outside `lib/data/` for `.from('<bannedTable>')` and fails the build on any match.

```bash
npm run ci:dal-boundary
```

Both run on every PR. Neither can be skipped.

---

## Contract tests

Every function has a test file at `lib/data/<domain>/__tests__/<function>.test.ts`. Tests verify:

1. Input validation (Zod schema rejects bad input)
2. Happy path (mocked Supabase returns expected shape)
3. Not-found path (returns `null`)
4. Error path (Supabase error logged, returns `null`)
5. Cache key + TTL match the documented strategy

Run via:
```bash
npm run test
```

---

## Migration plan (from current state)

Today, pages call `supabase.from('listings')` directly throughout `app/`, `app/actions/`, `lib/queries/`, etc. The migration:

1. **Wave 0:** Scaffold `lib/data/` with all function signatures stubbed. ESLint rule lands but is initially scoped to NEW code only.
2. **Wave 1:** Implement each function as we build the materialized views (per `docs/architecture/ADR_001_DATA_LAYER.md`).
3. **Wave 2-3:** Migrate every page's data access to import from `@/lib/data/`. Replace raw `.from()` calls one by one.
4. **Wave 2-3 end:** ESLint rule scope expanded to all files. Last raw `.from()` call deleted. CI passes.

After migration, no file outside `lib/data/` may add a raw query. If you find yourself wanting to write `supabase.from('listings')` in a page or component, you're doing it wrong — write the function in `lib/data/` first, then call it from the page.

---

## Adding a new function

1. Define types in `lib/data/types/<domain>.ts`
2. Write the function in `lib/data/<domain>/<functionName>.ts` following the pattern above
3. Add input validation (Zod)
4. Wrap in `unstable_cache` with documented TTL + tags
5. Write contract tests in `__tests__/`
6. Export from `lib/data/index.ts`
7. Update the caching table above
8. Update this doc if the function reads a new table

---

## Related

- `docs/EXECUTION_PLAN.md` — the wave-by-wave build plan
- `docs/SITE_SPEC.md` — the per-route checklist with acceptance criteria
- `docs/architecture/ADR_001_DATA_LAYER.md` — the materialized view + index decisions
- `docs/DATABASE_FOR_AI_AGENTS.md` — the canonical DB reference
- `eslint.config.mjs` — the ESLint rule that enforces the boundary
- `scripts/check-dal-boundary.mjs` — the CI script that double-checks
