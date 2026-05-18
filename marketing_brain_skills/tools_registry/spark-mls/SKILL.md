---
name: tools_registry-spark-mls
description: Use this skill when a task involves "Spark API", "MLS listing data", "live inventory", "active listings from MLS", "recent sales", "closed listings", "days on market", "Spark reconciliation", "ORMLS", "FlexMLS", "SparkAPI replication endpoint", or any task requiring what the MLS is reporting right now.  as opposed to the eventual-consistency Supabase mirror. Covers authentication, endpoint patterns, RETS filter syntax, the mandatory Spark x Supabase reconciliation gate, failure modes, and which producers call this tool.
---

# Spark API (FlexMLS / ORMLS Replication) Tool Skill

## Canonical references

This is a capability skill used by market-data producers and the listing sync pipeline. Every task that invokes this skill also loads:

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks all other instructions; governs every number produced from this API)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `video_production_skills/market-data-video/SKILL.md`.  primary consumer for market-report deliverables

---

## Scope

**Use Spark API for:**

| Use case | Why Spark |
|---|---|
| Current active inventory count | Spark is the live MLS feed; Supabase mirror may lag by hours |
| Current days-on-market (DOM) for active listings | Supabase doesn't back-fill DOM in real time |
| Recent closed sales for MoS and YoY calculations | Spark's `/recent-sales` returns closes faster than the nightly sync |
| Pre-render reconciliation gate (see below) | Required hard gate per CLAUDE.md §0 before any market deliverable renders |
| Listing detail for a single MLS number | `/listings/{ListingKey}` is the authoritative source |
| Agent roster | `/agents`.  fresher than any local cache |

**Do NOT use Spark API for:**

| Data source | Use instead |
|---|---|
| Historical closed-sale analytics (6+ months ago) | Supabase `listings` table.  reconciled, indexed, queryable with SQL |
| Full-text search across listing remarks | Supabase full-text index |
| Aggregated market stats (median price, absorption) already in cache | `market_stats_cache` or `market_pulse_live` in Supabase |
| Social publishing, email, or CRM data | Meta Graph API, Resend, FUB REST API |
| Competitor listing data | Apify (no cross-MLS read access through Spark) |

The rule: Spark answers "what is the MLS reporting right now." Supabase answers "what have we recorded and reconciled over time." They are complementary, not interchangeable.

---

## Authentication

| Variable | Source | Status |
|---|---|---|
| `SPARK_API_KEY` | sparkapi.com → Account → API Keys | Provisioned |
| `SPARK_API_BASE_URL` | Locked at `https://replication.sparkapi.com/v1` | Provisioned |
| `SPARK_TOKEN` | OAuth bearer flow (not API-key flow) | NOT provisioned |
| `BRIDGE_API_KEY` | Bridge Interactive / RESO alternate feed | NOT provisioned |
| `RESO_API_KEY` | RESO Web API alternate feed | NOT provisioned |

If a feature requires `SPARK_TOKEN`, `BRIDGE_API_KEY`, or `RESO_API_KEY`, surface that requirement to Matt before building.  do not assume these credentials exist.

```ts
// lib/spark-odata.ts.  canonical getter
function getApiKey(): string {
  const key = process.env.SPARK_API_KEY?.trim()
  if (!key) throw new Error('SPARK_API_KEY is not set')
  return key
}

// Request pattern
const res = await fetch(`${process.env.SPARK_API_BASE_URL}/listings/search?${params}`, {
  headers: {
    Authorization: `Bearer ${getApiKey()}`,
    Accept: 'application/json',
  },
})
```

`SPARK_API_BASE_URL` must never be hard-coded. Always read from env. The replication endpoint (`replication.sparkapi.com`) is distinct from the general Spark platform endpoint (`sparkapi.com`).  they serve different data sets. Ryan Realty's account is provisioned against the replication endpoint.

---

## Endpoint patterns

### Search active or pending listings

```
GET /v1/listings/search?_filter=<filter>&_limit=<N>&_skip=<N>
```

Returns live listing records from the ORMLS feed. Field names follow RETS/RESO conventions (mixed-case, same as the Supabase `listings` table columns).

### Single listing detail

```
GET /v1/listings/{ListingKey}
```

Returns the full listing object including Photos, Videos, VirtualTours, OpenHouses, Documents when expanded. Canonical for pre-render photo arrays.

### Recent closed sales

```
GET /v1/listings/recent-sales?_filter=<filter>&_limit=<N>&_skip=<N>
```

Returns closes within the filter window. Use for YoY calculations, absorption, and the months-of-supply denominator.

### Agent roster

```
GET /v1/agents
```

Returns the ORMLS agent directory. Useful for resolving `ListAgentEmail` → broker headshot lookups when building per-listing deliverables.

---

## RETS / OData filter syntax

Spark uses an OData-style `_filter` parameter. Predicates are separated by `And` / `Or`. String values use single quotes; numeric values are unquoted.

### Common predicates

| Goal | Filter string |
|---|---|
| Active SFR listings in Bend | `StandardStatus Eq 'Active' And PropertyType Eq 'A' And City Eq 'Bend'` |
| Price band | `ListPrice Ge 500000 And ListPrice Le 1000000` |
| Closed in a date range | `CloseDate Ge 2026-01-01 And CloseDate Le 2026-03-31` |
| Pending listings | `StandardStatus Eq 'Pending'` |
| Subdivision filter | `SubdivisionName Eq 'Tetherow'` |

### Property type codes (RETS standard)

| Code | Type |
|---|---|
| `A` | Residential SFR.  the default for all market-data deliverables |
| `B` | Condo / Townhouse |
| `C` | Land / Lot |
| `D` | Multi-Family |
| `E` | Commercial |

Always pass `PropertyType Eq 'A'` for SFR market reports unless the brief explicitly calls for a different property type. Mixing types corrupts median price and MoS calculations.

### Listing status values

`Active` · `Pending` · `Closed` · `Expired` · `Withdrawn` · `Coming Soon`

### Pagination

Spark returns at most 200 results per request by default. For queries that may exceed 200 rows, paginate:

```
_pagination=1&_limit=200&_skip=0    → first page
_pagination=1&_limit=200&_skip=200  → second page
```

The response envelope includes `D.Pagination.Total` (total matching count) and `D.Pagination.TotalPages`. Loop until `_skip >= D.Pagination.Total`.

### Full example.  active SFR in Bend with pagination

```ts
const baseUrl = process.env.SPARK_API_BASE_URL  // https://replication.sparkapi.com/v1
const filter = encodeURIComponent(
  "StandardStatus Eq 'Active' And PropertyType Eq 'A' And City Eq 'Bend'"
)
let skip = 0
const limit = 200
const allListings: SparkListing[] = []

while (true) {
  const url = `${baseUrl}/listings/search?_filter=${filter}&_limit=${limit}&_skip=${skip}&_pagination=1`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${process.env.SPARK_API_KEY}` },
  })
  if (!res.ok) throw new Error(`Spark search failed: ${res.status}`)
  const body = await res.json()
  const results: SparkListing[] = body.D?.Results ?? []
  allListings.push(..results)
  const total: number = body.D?.Pagination?.Total ?? 0
  skip += limit
  if (skip >= total) break
}
```

---

## Months of supply formula (locked per CLAUDE.md §0)

```
MoS = active_listings / (closed_last_6_months / 6)
```

| MoS | Market verdict |
|---|---|
| <= 4 months | Seller's market |
| 4 - 6 months | Balanced market |
| >= 6 months | Buyer's market |

The verdict pill in any deliverable must match the computed MoS against these thresholds exactly. A "seller's market" verdict next to 4.3 months is a ship-blocker.

**Compute this live from Spark data every time.** Never inherit MoS from a prior brief, chat turn, or cached value without re-querying.

---

## Spark x Supabase reconciliation gate (MANDATORY.  hard pre-render blocker)

Per CLAUDE.md §0, before any market-data deliverable renders, the agent must run this gate:

1. Query Spark for every figure that also appears in Supabase (`market_stats_cache`, `market_pulse_live`, or `listings`).
2. Print both values side by side with delta %.
3. **If any `|delta| > 1%`, stop the render immediately.** Surface the conflict to Matt: which figure, Supabase value + query, Spark value + query, delta, suspected cause. Wait for resolution. Re-render only after Matt confirms which value to use.

```
Reconciliation trace example (required in citations.json):
  active_listings_bend_sfr
    Supabase (market_stats_cache, city='Bend', type='A', fetched 2026-05-14): 312
    Spark (live query, StandardStatus Eq 'Active' And PropertyType Eq 'A' And City Eq 'Bend'): 314
    delta: 0.6%.  within 1% threshold, Spark value used
```

**Which source wins:**
- Spark wins for active inventory counts and current DOM.  it is the live feed.
- Supabase wins for reconciled historical close data once the nightly sync has run past the Spark cutover date.
- When in conflict beyond the 1% threshold, surface to Matt. Never silently pick one.

Document every cross-check in `citations.json` alongside the render. One entry per figure: source, table or endpoint, filter, row count or result count, `fetched_at_iso`, query text.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| `SPARK_API_KEY` not set | `Error: SPARK_API_KEY is not set` on startup | Add key to `.env.local` and Vercel env vars; redeploy |
| Wrong base URL | 401 or 404 on every request | Verify `SPARK_API_BASE_URL=https://replication.sparkapi.com/v1` in env; do not use `sparkapi.com` (general endpoint) |
| OData filter apostrophe escaping | 400 Bad Request with "filter parse error" | Single-quoted string values must not contain unescaped apostrophes. For values with apostrophes (e.g., city names), double the apostrophe: `City Eq 'O''Brien'`. URL-encode the entire `_filter` value before sending. |
| Rate limit | 429 Too Many Requests | Spark allows approximately 10 requests per second. Serialize requests; do not use `Promise.all` across concurrent Spark calls in the same cron execution. Add 100ms delay between pages if 429 appears. |
| Pagination truncation | Result count less than expected; `D.Pagination.Total` > returned rows | Not an error.  pagination is required. Loop using `_skip` until `skip >= Total`. |
| `SPARK_TOKEN` / `BRIDGE_API_KEY` required | Feature fails; endpoint requires OAuth flow | These credentials are not provisioned. Surface to Matt before building any feature that needs them. |
| Empty result on valid filter | `D.Results` is `[]` | Check filter syntax. Test the filter string in isolation on a simpler query (e.g., no date range) to isolate which predicate is wrong. Confirm the date format is `YYYY-MM-DD` (not ISO 8601 with time). |
| Stale data vs Supabase | Spark shows fewer actives than expected | The replication feed has a lag window. For time-sensitive deliverables, note the `fetched_at_iso` in citations.json and disclose the lag if material. |

---

## Existing implementation

`lib/spark.ts` and `lib/spark-odata.ts` are the canonical Spark clients in this repo. Read both before writing any new Spark call.

- `lib/spark.ts`.  lower-level fetch helpers: `fetchSparkListingsPage`, `fetchSparkListingHistory`, `fetchSparkPriceHistory`, `fetchSparkHistoricalListings`. Used by the sync pipeline.
- `lib/spark-odata.ts`.  OData client with the `SparkListing` interface and `fetchListings` function. Canonical for query-by-filter patterns.
- `app/actions/sync-spark.ts`.  server action that drives the full sync (all pages, upsert to Supabase). Read this for the pagination loop pattern before re-implementing it.
- `app/api/cron/sync-delta/route.ts`.  delta-sync cron entry point (runs on a schedule; fetches only recently modified listings).

Do not re-implement `fetchListings` or the pagination loop. Call the existing helpers.

---

## Pre-flight checklist (before any Spark query in a market deliverable)

```
[ ] SPARK_API_KEY confirmed present in.env.local (not empty, not a placeholder)
[ ] SPARK_API_BASE_URL confirmed as https://replication.sparkapi.com/v1
[ ] PropertyType filter is set ('A' for SFR unless brief says otherwise)
[ ] Date range filter uses YYYY-MM-DD format (not ISO 8601 with time component)
[ ] _filter value is URL-encoded before inclusion in the request URL
[ ] Pagination loop implemented if query window could return >200 rows
[ ] Spark x Supabase reconciliation gate run; delta printed; all |delta| <= 1%
[ ] Every figure entered into citations.json with fetched_at_iso timestamp
[ ] MoS computed live from this session's data; verdict matches computed threshold
```

---

## Used by (producer registry)

| Producer | Why it uses Spark |
|---|---|
| `video_production_skills/market-data-video/SKILL.md` | Live active count + DOM + MoS for market report beats |
| `video_production_skills/monthly-market-report-orchestrator/SKILL.md` | Orchestrates the reconciliation gate before fanning out to sub-producers |
| `video_production_skills/youtube-long-form-market-report/SKILL.md` | Deep-arc data pull; YoY tables require verified close history |
| `video_production_skills/listing-tour-video/SKILL.md` | Single-listing detail (`/listings/{ListingKey}`) for address, price, photos |
| `social_media_skills/blog-post/SKILL.md` | Data freshness check before publishing SEO market posts |
| `marketing_brain_skills/run/SKILL.md` (generate-briefs step) | Active-listing count signals when to trigger a market content action |

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/spark-odata.ts` | Canonical OData client.  `SparkListing` type, `fetchListings` function |
| `lib/spark.ts` | Lower-level helpers for sync pipeline |
| `app/actions/sync-spark.ts` | Full-sync server action.  pagination loop reference implementation |
| `app/api/cron/sync-delta/route.ts` | Delta-sync cron.  recently-modified listing fetch pattern |
| `CLAUDE.md` §0 "Data Accuracy" | Reconciliation gate requirements; MoS formula; thresholds |
| `video_production_skills/market-data-video/SKILL.md` §22 | Full data dictionary for all market tables Spark feeds into |
| `video_production_skills/VIDEO_PRODUCTION_SKILL.md` §0 | Pre-render Spark x Supabase reconciliation gate (full spec) |
| https://sparkapi.com/docs | Official Spark API documentation |
| https://reso.org/data-dictionary | RESO data dictionary.  field name canonical reference |
