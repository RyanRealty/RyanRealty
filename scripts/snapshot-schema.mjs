#!/usr/bin/env node
// scripts/snapshot-schema.mjs
//
// Generate docs/DATABASE_SCHEMA_SNAPSHOT.md from the live Supabase
// project. The snapshot is the agent's authoritative reference for
// column names + types so it never needs to run ad-hoc
// `execute_sql` against information_schema during normal work.
//
// Runs against the service role (read-only purpose; only SELECT on
// information_schema + cheap COUNT(*) on a handful of canonical
// tables).
//
// Output: a single markdown file at docs/DATABASE_SCHEMA_SNAPSHOT.md
// grouped by purpose. The check-data-access.mjs gate diffs the
// committed file against a fresh snapshot to detect drift.

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const envText = readFileSync('.env.local', 'utf8')
const env = Object.fromEntries(
  envText
    .split('\n')
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()]
    }),
)
const URL = env.NEXT_PUBLIC_SUPABASE_URL
const KEY = env.SUPABASE_SERVICE_ROLE_KEY
if (!URL || !KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

// Hosted REST helper. We avoid pulling @supabase/supabase-js here so
// the script can run from a clean checkout without `npm install`.
async function rpcSql(sql) {
  const res = await fetch(`${URL}/rest/v1/rpc/execute_sql`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  })
  if (!res.ok) {
    throw new Error(`SQL ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

// Some projects have no `execute_sql` RPC. Fall back to PostgREST's
// rpc surface for one query, then bulk via /rest/v1/.
async function tryRest(path) {
  const res = await fetch(`${URL}/rest/v1/${path}`, {
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`REST ${path} ${res.status}: ${await res.text()}`)
  }
  return res.json()
}

/** Call the migration-installed `_agent_schema_dump()` SECURITY DEFINER
 * function that returns every column in the public schema. The
 * migration that installs it is
 * supabase/migrations/20260528020000_agent_schema_dump_function.sql.
 *
 * PostgREST caps RPC responses at 1000 rows by default. Paginate via
 * the Range header until we get a short page. The `listings` table
 * alone has ~140 columns; total across all public tables is ~5K rows. */
async function querySchema() {
  const all = []
  const PAGE = 1000
  let offset = 0
  while (true) {
    const url = `${URL}/rest/v1/rpc/_agent_schema_dump?offset=${offset}&limit=${PAGE}`
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: '{}',
    })
    if (!res.ok) {
      throw new Error(`_agent_schema_dump RPC ${res.status}: ${await res.text()}`)
    }
    const page = await res.json()
    all.push(...page)
    if (page.length < PAGE) break
    offset += PAGE
    if (offset > 50_000) throw new Error('snapshot-schema: pagination runaway')
  }
  return all
}

/** Best-effort row count for a list of tables. Stops counting after
 * threshold per-table so we don't blow time on 500M-row tables. */
async function rowCount(table) {
  try {
    const res = await fetch(
      `${URL}/rest/v1/${encodeURIComponent(table)}?select=*&limit=0`,
      {
        method: 'GET',
        headers: {
          apikey: KEY,
          Authorization: `Bearer ${KEY}`,
          Prefer: 'count=estimated',
        },
      },
    )
    if (!res.ok) return null
    const cr = res.headers.get('content-range')
    if (!cr) return null
    const total = cr.split('/')[1]
    if (!total || total === '*') return null
    const n = Number(total)
    return Number.isFinite(n) ? n : null
  } catch {
    return null
  }
}

/** Curated grouping. Anything not in a named group lands in "Other". */
const GROUPS = [
  {
    name: 'Listings — core',
    match: (t) => ['listings', 'listing_history', 'listing_photos', 'listing_videos', 'open_houses'].includes(t),
    notes: {
      listings:
        'Source-of-truth RETS-style listings table (~589K rows). **Quotable mixed-case columns** — `"ListingKey"`, `"StreetNumber"`, `"StreetName"`, `"ListPrice"`, `"StandardStatus"`, `"Latitude"`, `"Longitude"`, etc. The `details` jsonb column carries the raw RETS payload. **Never aggregate from this table at request time** — use `listing_tile_mv` / `market_pulse_live` / `market_stats_cache`.',
      listing_history:
        'One row per MLS-history event for a listing. snake_case columns; `listing_key` references `listings.ListingKey`. UI-facing PropertyHistory filters out `event=Photo` and empty `FieldChange` noise.',
    },
  },
  {
    name: 'Listings — derived (materialized views)',
    match: (t) => ['listing_tile_mv', 'similar_listings_mv', 'listing_detail_mv'].includes(t),
    notes: {
      listing_tile_mv:
        'Pre-projected single-row-per-listing view for tile + map rendering. snake_case columns. Refreshed hourly via `/api/cron/refresh-mvs`. The canonical read path for any "list of listings" surface — homepage Featured, search results, similar-listings hydration.',
      similar_listings_mv:
        '(anchor_key, similar_key, rank, similarity_score) — precomputed nearest 12 active comparables per anchor. Refreshed nightly via `/api/cron/refresh-similar-listings`. Active-set only (closed anchors return empty).',
      listing_detail_mv:
        'Pre-projected detail row per listing. Currently unused in code (Wave 1.5 was reverted) but the MV stays in the DB until Wave 3 re-adopts it. Harmless.',
    },
  },
  {
    name: 'Market — live caches',
    match: (t) => ['market_pulse_live', 'market_stats_cache', 'cache_methodology_definitions'].includes(t),
    notes: {
      market_pulse_live:
        '10–15 minute freshness. Per-geo current snapshot. Keyed by (geo_type, geo_slug). Columns include `active_count`, `median_list_price`, `new_count_7d`, `price_reduction_share`, `sold_count_30d`, `months_of_supply`, `median_days_to_pending`, `updated_at`. **DAL:** `getMarketPulse({geoType, geoSlug})` (cache key `market-pulse-v3`).',
      market_stats_cache:
        '6-hour freshness. Per-geo + per-window aggregated stats. **DAL:** `getMarketStats(...)`. **Known issue 2026-05-28:** column list in the current DAL does not match the cache schema — fix deferred.',
      cache_methodology_definitions:
        'Row per methodology version describing the formula behind each market stat. Methodology current is `v4-2026-05-15`.',
    },
  },
  {
    name: 'Geographies',
    match: (t) => ['boundaries', 'neighborhood_subdivisions', 'resort_communities', 'cities', 'app_config'].includes(t),
    notes: {
      boundaries:
        'Authoritative polygon geometries from City of Bend GIS, Deschutes County DIAL, Oregon GEO, or Census TIGER. Every row carries `boundary_source` + `source_url` + `fetched_at`. **Never approximate or LLM-generate polygons** — query this table.',
    },
  },
  {
    name: 'Brokers + people',
    match: (t) => ['brokers', 'broker_inventories', 'persons', 'fub_people_cache'].includes(t),
  },
  {
    name: 'App + analytics',
    match: (t) =>
      ['saved_listings', 'recent_searches', 'lead_events', 'page_views', 'content_performance', 'marketing_brain_actions', 'marketing_cost_ledger', 'marketing_decisions', 'cmas', 'cma_comps', 'expired_listings'].includes(t),
  },
]

function pickGroup(table) {
  for (const g of GROUPS) {
    if (g.match(table)) return g
  }
  return null
}

function fmt(s) {
  if (s === null || s === undefined) return ''
  return String(s)
}

async function main() {
  console.error('snapshot-schema: querying information_schema.columns via PostgREST...')
  let cols
  try {
    cols = await querySchema()
  } catch (e) {
    console.error('Failed to read information_schema.columns through PostgREST:', e.message)
    console.error(
      'Tip: ensure the service role has SELECT on information_schema. Most Supabase projects do by default.',
    )
    process.exit(1)
  }
  console.error(`snapshot-schema: ${cols.length} column rows fetched.`)

  // Group rows by table.
  const byTable = new Map()
  for (const c of cols) {
    if (!byTable.has(c.table_name)) byTable.set(c.table_name, [])
    byTable.get(c.table_name).push(c)
  }

  const tables = [...byTable.keys()].sort()
  console.error(`snapshot-schema: ${tables.length} tables / views in public schema.`)

  // Row counts for the canonical hot tables (cheap, capped to ~15).
  const HOT = [
    'listings',
    'listing_history',
    'listing_tile_mv',
    'similar_listings_mv',
    'market_pulse_live',
    'market_stats_cache',
    'boundaries',
    'brokers',
    'cmas',
    'marketing_brain_actions',
    'open_houses',
    'expired_listings',
    'content_performance',
    'fub_people_cache',
    'saved_listings',
  ]
  console.error('snapshot-schema: counting hot tables...')
  const counts = {}
  for (const t of HOT) {
    if (tables.includes(t)) counts[t] = await rowCount(t)
  }

  const grouped = new Map()
  for (const g of GROUPS) grouped.set(g.name, [])
  grouped.set('Other', [])
  for (const t of tables) {
    const g = pickGroup(t)
    grouped.get(g ? g.name : 'Other').push(t)
  }

  const out = []
  out.push('# Database schema snapshot')
  out.push('')
  out.push(`**Generated:** ${new Date().toISOString()}`)
  out.push('')
  out.push('**Source of truth:** auto-generated from `information_schema.columns` against the production Supabase project `dwvlophlbvvygjfxcrhm` (`ryan-realty-platform`).')
  out.push('')
  out.push('**Do NOT hand-edit.** Re-run `npm run ci:data-access -- --refresh` to regenerate.')
  out.push('')
  out.push('Read this file BEFORE running any `execute_sql` against the project. It carries every column name and type — there is no need to ad-hoc query `information_schema.columns` during normal work. See `feedback_no_adhoc_sql.md` and the "Data Access Discipline" section of CLAUDE.md.')
  out.push('')
  out.push('Companion files:')
  out.push('- `docs/DATABASE_FOR_AI_AGENTS.md` — prose narrative reference (cache freshness windows, registry, slug formats, mixed-case quoting rules).')
  out.push('- `docs/DAL_INDEX.md` — every `lib/data/` function and the tables it touches.')
  out.push('')
  out.push('---')
  out.push('')

  for (const [groupName, gtables] of grouped) {
    if (gtables.length === 0) continue
    out.push(`## ${groupName}`)
    out.push('')
    const groupSpec = GROUPS.find((g) => g.name === groupName)
    for (const t of gtables) {
      const rows = byTable.get(t)
      if (!rows) continue
      const count = counts[t]
      const countNote = count != null ? ` · **rows ≈ ${count.toLocaleString()}**` : ''
      out.push(`### \`${t}\`${countNote}`)
      out.push('')
      const note = groupSpec?.notes?.[t]
      if (note) {
        out.push(note)
        out.push('')
      }
      out.push('| Column | Type | Nullable | Default |')
      out.push('|---|---|---|---|')
      for (const r of rows) {
        const name = r.column_name
        // Mixed-case columns get backticks-with-quote-marks to remind
        // the reader they must be double-quoted in raw SQL.
        const safeName = /[A-Z]/.test(name) ? `\`"${name}"\`` : `\`${name}\``
        out.push(
          `| ${safeName} | ${fmt(r.data_type)} | ${r.is_nullable === 'YES' ? 'yes' : 'no'} | ${fmt(r.column_default)} |`,
        )
      }
      out.push('')
    }
  }

  const target = resolve('docs/DATABASE_SCHEMA_SNAPSHOT.md')
  writeFileSync(target, out.join('\n'))
  console.error(`snapshot-schema: wrote ${target} (${out.length} lines).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
