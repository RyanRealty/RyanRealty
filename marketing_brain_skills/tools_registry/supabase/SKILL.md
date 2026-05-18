---
name: tools_registry-supabase
description: Use this skill when a task involves reading or writing to the Ryan Realty Supabase database.  including listings queries, marketing_brain_actions dispatch, marketing_channel_daily ingest, competitor_intel reads, audit_runs lifecycle, content_classification writes, or any migration. Supabase is the system of record for every marketing brain action, all platform metrics, all competitor scrape data, all listing data, and the full audit trail. Covers authentication patterns, table inventory, column-name gotchas, migration conventions, MCP tooling, upsert patterns, and failure modes.
---

# Supabase Tool Skill

## Canonical references

This is the infrastructure skill used by every marketing brain skill, every producer, every audit, and every cron. Every task that touches Supabase also loads:

- `CLAUDE.md` §0.  Data Accuracy mandate (outranks all other instructions)
- `CLAUDE.md` §0.5.  Draft-First, Commit-Last
- `CLAUDE.md` "Supabase `listings` Schema.  MANDATORY READ".  column quoting rules and query discipline

---

## Scope

**Use Supabase for:**

| Use case | Table |
|---|---|
| Listing data.  active inventory, sold comparables, market stats | `listings`, `market_pulse_live`, `market_stats_cache` |
| Marketing brain action dispatch and status tracking | `marketing_brain_actions` |
| Daily platform metrics (Meta, GA4, GSC, FUB, YouTube, etc.) | `marketing_channel_daily` |
| Competitor scrape results from Apify | `competitor_intel` |
| LLM content classifications from the classifier | `content_classification` |
| Audit run lifecycle and cost tracking | `audit_runs` |
| Brain memory.  every decision made and why | `marketing_decisions` |
| Legacy briefing code (backward-compat view) | `content_briefs` (view over `marketing_brain_actions`) |
| Top-quartile competitor content by topic + format | `audit_winners` (view) |

**Do NOT use Supabase for:**

| Data source | Use instead |
|---|---|
| Live MLS active inventory cross-check | Spark API (`SPARK_API_KEY`).  Supabase `listings` is a RETS replica with a sync lag |
| Real-time Meta ad performance | Meta Graph API (`NEXT_PUBLIC_META_PAGE_ACCESS_TOKEN`) |
| GA4 sessions / conversions | GA4 Data API (service-account JSON in Vercel env) |
| GSC impressions / clicks | Google Search Console API |
| Follow Up Boss leads | FUB REST API (`FOLLOW_UP_BOSS_API_KEY`) |
| Transaction coordination records | Vault.  never SkySlope |

The rule: Supabase is the aggregated system of record and the audit trail. Live or real-time data comes from the upstream platform API first, then lands in Supabase via an ingestor cron.

---

## Project

| Field | Value |
|---|---|
| Project name | `ryan-realty-platform` |
| Project ID | `dwvlophlbvvygjfxcrhm` |
| Database URL | `dwvlophlbvvygjfxcrhm.supabase.co` |
| Region | us-west-1 |

---

## Authentication

Two client patterns exist. Use the right one for the context.

### Service-role client (server-side only.  brain, producers, crons, API routes)

```ts
import { createClient, SupabaseClient } from '@supabase/supabase-js'

function getSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase service-role credentials not configured')
  return createClient(url, key)
}
```

Source: `lib/marketing-brain/snapshot.ts`.  canonical getter used by every brain module. Copy this pattern verbatim; do not re-implement.

| Variable | Where to get it | Scope |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase dashboard → Project Settings → API | Public.  safe in client code |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase dashboard → Project Settings → API → service_role | Server only.  bypasses RLS |

The service-role key bypasses Row Level Security. It is only for server actions, API routes, and cron handlers. Never expose it in client code or commit it to the repo.

### Browser / SSR client (client components and server components with auth context)

```ts
// lib/supabase.ts.  use these factories, do not re-implement
import { createBrowserClient, createServerClient } from '@/lib/supabase'

// In 'use client' code:
const supabase = createBrowserClient()   // uses NEXT_PUBLIC_SUPABASE_ANON_KEY

// In server components / API routes that need user session:
const supabase = await createServerClient()  // reads cookies
```

Source: `lib/supabase.ts`. The browser client uses `NEXT_PUBLIC_SUPABASE_ANON_KEY` and respects RLS policies. The server client reads the user's cookie for session-scoped queries.

For all marketing brain work, use the service-role getter from `snapshot.ts`. The browser client is for UI components only.

---

## Table inventory

### `listings`.  MLS data (~589K+ rows, RETS replica)

The central MLS dataset. **589K+ rows.** Never `SELECT *` without a tight filter. Always project specific columns.

**Critical column-name rule (RETS standard):** Mixed-case column names are preserved by Postgres and require quoting in raw SQL. The Supabase JS client accepts them in `.select()` and `.eq()` without explicit quoting.  use the JS client for listing queries.

**Quoted columns (raw SQL must use double-quotes; JS client `.select()` / `.eq()` accepts as-is):**

| Column | Type | Notes |
|---|---|---|
| `"ListingKey"` | text | Primary key |
| `"StreetNumber"` | text | |
| `"StreetName"` | text | |
| `"ListPrice"` | numeric | |
| `"ClosePrice"` | numeric | |
| `"CloseDate"` | date | |
| `"StandardStatus"` | text | `'Active'`, `'Closed'`, `'Pending'`, `'Withdrawn'` |
| `"PhotoURL"` | text | Lead photo |
| `"SubdivisionName"` | text | |
| `"TotalLivingAreaSqFt"` | numeric | |
| `"BedroomsTotal"` | integer | |
| `"BathroomsTotal"` | numeric | |
| `"CumulativeDaysOnMarket"` | integer | |
| `"Latitude"` | numeric | |
| `"Longitude"` | numeric | |

**Lower-case columns (no quoting required in either raw SQL or JS client):**

| Column | Type |
|---|---|
| `year_built` | integer |
| `pending_timestamp` | timestamptz |
| `price_per_sqft` | numeric |

**Correct JS client pattern (verified in `lib/marketing-brain/generate-briefs.ts`):**

```ts
const { data, error } = await supabase.from('listings').select('ListingKey, StreetNumber, StreetName, City, ListPrice, PhotoURL').eq('StandardStatus', 'Active').order('ListPrice', { ascending: false }).limit(20)
```

**Correct raw SQL pattern:**

```sql
SELECT "StreetNumber", "StreetName", "ListPrice", "StandardStatus", year_built
FROM listings
WHERE "StandardStatus" = 'Active'
  AND "ListPrice" BETWEEN 500000 AND 1000000
LIMIT 50;
```

**Wrong (silently fails.  column not found):**

```sql
SELECT StreetNumber, ListPrice FROM listings WHERE StandardStatus = 'Active';
```

When in doubt, query `information_schema.columns` first.  do not infer column names from memory or prior runs.

Market report filters: `PropertyType = 'A'` for SFR. MoS formula = `active_listings / (closed_last_6_months / 6)`. Thresholds: ≤ 4 seller's, 4-6 balanced, ≥ 6 buyer's. See `CLAUDE.md` §"Data Accuracy" for the full gate.

---

### `marketing_brain_actions`.  brain dispatch table

One row per marketing action. The central coordination table for every brain skill and producer.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `action_type` | text | `content:listing_reel`, `site:copy_update`, `ops:meta_ads_pause`, etc. |
| `target` | text | `mls:220189422`, `/listings`, `campaign_id:abc123` |
| `assigned_producer` | text | Path to producer SKILL.md |
| `payload` | jsonb | Action-type-specific data for the producer |
| `data_evidence` | jsonb | Raw signal that triggered this action |
| `status` | text | `pending` → `in_production` → `ready` → `approved` → `executed` → `measured` \| `killed` |
| `executor_response` | jsonb | What the producer returned (nullable until `in_production`) |
| `executed_at` | timestamptz | Set when producer transitions to `in_production` |

Backward-compat: `public.content_briefs` is a view over this table. Code using `.from('content_briefs')` continues to work.

Indexes: `action_type`, `assigned_producer`, `(status, scheduled_for)`.

---

### `marketing_channel_daily`.  platform metrics

Pre-aggregated daily metrics per channel. One row per `(date, channel, scope, scope_id, metric)`.  composite PK enforces idempotency.

| Column | Type | Notes |
|---|---|---|
| `date` | date | YYYY-MM-DD |
| `channel` | text | `meta_ads`, `instagram`, `ga4`, `gsc`, `fub`, `youtube`, `linkedin`, `x`, `tiktok`, `gbp`, `threads`, `nextdoor`, `pinterest`, `email` |
| `scope` | text | `account`, `campaign`, `post`, `page`, `ad`, `adset`, `video`, `sequence` |
| `scope_id` | text | campaign_id, post_id, etc. Empty string for `account` scope |
| `metric` | text | `impressions`, `reach`, `clicks`, `spend`, `leads`, `sessions`, `bounce_rate`, etc. |
| `value` | numeric | |
| `metadata` | jsonb | Channel-specific extras (campaign_name, post_type, country_breakdown) |
| `source` | text | `meta_ads_insights_api`, `ga4_data_api`, `gsc_api`, etc. |
| `fetched_at` | timestamptz | |

**Upsert pattern** (from `lib/marketing-brain/snapshot.ts`.  use `upsertMetricRows()`, do not re-implement):

```ts
import { upsertMetricRows, MetricRow } from '@/lib/marketing-brain/snapshot'

const rows: MetricRow[] = [
  { date: '2026-05-13', channel: 'instagram', scope: 'account',
    scope_id: '', metric: 'impressions', value: 14200, source: 'meta_page_insights_api' }
]
const count = await upsertMetricRows(rows)
```

The helper dedupes by composite PK before the batch insert, preventing the "ON CONFLICT DO UPDATE cannot affect row a second time" Postgres error when the upstream API returns duplicate rows.

Batch size: 500 rows per chunk. All errors throw.

---

### `competitor_intel`.  Apify scrape results

Raw competitor social and ad data. One row per scraped item. Written by `lib/marketing-brain/competitor-recon.ts`; read by the brain's opportunity-generation pass.

| Column | Type | Notes |
|---|---|---|
| `id` | uuid | PK |
| `scraped_at` | timestamptz | |
| `observation_date` | date | |
| `competitor` | text | Canonical slugs: `cascade_hasson_sothebys`, `compass_bend`, `windermere_central_oregon`, `cascade_sothebys`, `coldwell_banker_bain_bend`, `berkshire_hathaway_nw_bend`, `john_l_scott_bend`, `remax_key_properties_bend`, `opendoor`, `offerpad` |
| `source` | text | `fb_ad_library`, `google_serp`, `instagram_profile`, `tiktok_profile`, `google_maps_reviews`, `zillow_agent`, `website_diff` |
| `data_type` | text | `ad`, `serp_position`, `post`, `review`, `listing`, `profile_metric`, `page_change` |
| `data` | jsonb | Full item payload from the Apify actor |
| `url` | text | Source URL (nullable) |
| `apify_run_id` | text | Apify run ID for audit.  link to raw dataset at `apify.com/storage/datasets/<datasetId>` |

---

### `content_classification`.  LLM classifier output

Per-post tags generated by the classifier pass over `competitor_intel` rows. One row per `(post_id, audit_id)`.  unique constraint enforces idempotency.

Generated columns (stored, indexed, no parsing required at query time): `topic`, `confidence`, `format`, `engagement_rate`.

Low-confidence escalation index: `WHERE confidence < 0.6`.

---

### `audit_runs`.  audit lifecycle

One row per audit cycle. Lifecycle: `running` → `scraping` → `classifying` → `aggregating` → `publishing` → `published` (or `killed`). Tracks scope, cost, and the resulting `analyze:audit_findings` action row.

---

### `marketing_decisions`.  brain memory

Audit log for every decision the brain or a human makes. Never truncate or delete. This is the long-term record of why actions were taken.

---

### `audit_winners`.  top-quartile view

Aggregated view over `content_classification` surfacing the top-quartile engagement rate by `(audit_id, topic, format)`. Used by the audit-findings builder to populate `missing_producers` payload. Re-creatable; defined as `CREATE OR REPLACE VIEW`.

---

## Migration convention

```
supabase/migrations/YYYYMMDDHHMMSS_descriptive_name.sql
```

- Idempotent DDL only: `CREATE TABLE IF NOT EXISTS`, `CREATE INDEX IF NOT EXISTS`, `CREATE OR REPLACE VIEW`.
- Apply via the Supabase MCP `apply_migration` tool during authoring sessions (server_id `5adfee1a-82b2-4661-a931-e7bf6763a9c9`).
- All tables: `ALTER TABLE.. ENABLE ROW LEVEL SECURITY` + explicit `GRANT.. TO service_role`. Anonymous and authenticated roles get no access to brain tables.
- Ship the migration in the same commit as the code that depends on it (see `CLAUDE.md` "Same pipeline as Cursor").

---

## MCP tooling

The Supabase MCP (server_id `5adfee1a-82b2-4661-a931-e7bf6763a9c9`) is available in authoring sessions.

| Tool | Use for |
|---|---|
| `execute_sql` | Ad-hoc queries, verification traces, data audits |
| `apply_migration` | Ship migration files during authoring |
| `list_tables` | Enumerate available tables |
| `generate_typescript_types` | Regenerate TypeScript types after schema changes |

Use `execute_sql` for any verification trace required by `CLAUDE.md` §0 before a market-data deliverable ships.

---

## Failure modes

| Failure | Symptom | Resolution |
|---|---|---|
| Service-role key not set | `Error: Supabase service-role credentials not configured` on cold start | Add `SUPABASE_SERVICE_ROLE_KEY` to `.env.local` and Vercel env; redeploy |
| Mixed-case column in raw SQL without quotes | `ERROR: column "streetname" does not exist` | Wrap the column name in double-quotes in the SQL string, or switch to the JS client |
| Mixed-case column in JS client.  silent wrong value | Query returns no rows or null for a column that exists | Verify the exact casing against `information_schema.columns`; the JS client is case-sensitive on field names in `.select()` |
| `SELECT *` on `listings` | Query times out or returns 589K rows | Always project specific columns and add a `WHERE` clause with at least one indexed filter (`StandardStatus`, `CloseDate`, `City`) |
| Upsert batch rejected: "ON CONFLICT DO UPDATE cannot affect row a second time" | Upstream API returned duplicate rows in one response | Use `upsertMetricRows()` from `snapshot.ts`.  it dedupes by composite PK before the insert |
| RLS blocks service-role query | Unexpected | Verify `SUPABASE_SERVICE_ROLE_KEY` is set (not the anon key). Service role bypasses RLS.  if RLS is blocking, the key is wrong |
| Missing column after schema change | `error.message` contains "column X does not exist" | Run the pending migration via MCP `apply_migration`. Check `list_migrations` to confirm it shipped |
| View `content_briefs` missing | Code using `.from('content_briefs')` errors | Re-run migration `20260513170000_marketing_brain_actions.sql`.  the view is `CREATE OR REPLACE` so it is safe to re-apply |

---

## Pre-flight checklist (before any new table or query)

```
[ ] NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY confirmed in.env.local
[ ] Column names verified against information_schema.columns.  never inferred from memory
[ ] Query projects only needed columns.  no SELECT * on listings or any large table
[ ] Filter indexed columns (StandardStatus, CloseDate, channel, date).  not full-table scans
[ ] Upsert uses upsertMetricRows() from snapshot.ts or equivalent dedup logic
[ ] New table has RLS enabled + explicit service_role GRANT
[ ] Migration file named YYYYMMDDHHMMSS_descriptive_name.sql, applied via MCP apply_migration
[ ] Verification trace written before any market-stat deliverable ships (CLAUDE.md §0)
```

---

## Related skills and references

| Resource | Purpose |
|---|---|
| `lib/marketing-brain/snapshot.ts` | `getSupabase()`, `upsertMetricRows()`, `parseDateRange()`, `isAuthorizedCron()`.  canonical shared helpers |
| `lib/marketing-brain/generate-briefs.ts` | Brain opportunity generation.  reads `listings`, `marketing_channel_daily`, `competitor_intel`, writes `marketing_brain_actions` |
| `lib/marketing-brain/competitor-recon.ts` | Apify → `competitor_intel` ingestor |
| `lib/supabase.ts` | Browser + server SSR client factories for UI code |
| `supabase/migrations/` | Full migration history.  read before adding tables |
| `CLAUDE.md` §"Supabase `listings` Schema"  | Column-quoting rules, MoS formula, Spark reconciliation gate |
| `marketing_brain_skills/tools_registry/apify/SKILL.md` | Apify tool skill.  writes to `competitor_intel` |
| `video_production_skills/market-data-video/SKILL.md` §22 | Full data dictionary for `market_stats_cache`, `market_pulse_live`, `listings`, `boundaries`, `neighborhood_subdivisions` |
| `CLAUDE.md` "Marketing Brain Architecture" | Status flow, action-type categories, approval gates, producer registry |
