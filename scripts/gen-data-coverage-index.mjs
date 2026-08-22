#!/usr/bin/env node
/**
 * Generate docs/DATA_COVERAGE_INDEX.md — the entity-adjacency + coverage map.
 *
 * WHY THIS EXISTS (2026-08-22). An agent concluded that the pre-relist market
 * period was "unrecoverable" because `listings."OnMarketDate"` is overwritten on
 * relist. It was wrong: `listing_history` holds 3.9M events covering 99.6% of
 * relisted listings, and 74.5% of them carry events predating the current
 * OnMarketDate. The claim shipped into a spec and was caught only because Matt
 * challenged it.
 *
 * CLAUDE.md §0 already forbids reporting absence from one query shape. Prose did
 * not stop it. This file is the mechanism: before anyone can say "we do not have
 * X", they can see every OTHER table that carries the same entity and how much of
 * it each one covers — plus which tables are empty or stale, so nothing gets built
 * on a dead table again.
 *
 * Regenerate: node scripts/gen-data-coverage-index.mjs
 * Verified by: scripts/check-data-coverage-index.mjs (G-new)
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import { writeFileSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
config({ path: join(HERE, '../.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('missing supabase env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}
const sb = createClient(url, key, { auth: { persistSession: false } })

/** Entities we care about, and the column names that mean "this entity". */
const ENTITIES = [
  { name: 'listing', parent: 'listings', parentKey: 'ListingKey',
    keys: ['listing_key', 'listingkey'] },
  { name: 'parcel / property', parent: 'properties', parentKey: 'parcel_number',
    keys: ['parcel_number'] },
  { name: 'person / contact', parent: 'crm_people', parentKey: 'id',
    keys: ['person_id', 'crm_person_id', 'contact_id'] },
]

/** Row count via PostgREST HEAD — no RPC needed, works on every table. */
async function rowCount(table) {
  const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true })
  if (error) return null
  return count ?? 0
}
/** Newest value of a timestamp column, or null. */
async function freshness(table, col) {
  const { data, error } = await sb.from(table).select(col).order(col, { ascending: false }).limit(1)
  if (error || !data?.length) return null
  const v = data[0][col]
  return v ? String(v).slice(0, 10) : null
}

async function main() {
  // Column map comes from the checked-in schema snapshot — never information_schema
  // at runtime (CLAUDE.md §7: schema discovery is forbidden, the answer is on disk).
  const snap = readFileSync(join(HERE, '../docs/DATABASE_SCHEMA_SNAPSHOT.md'), 'utf8')
  const byTable = new Map()
  {
    let cur = null
    for (const line of snap.split('\n')) {
      const h = line.match(/^###\s+`([A-Za-z0-9_]+)`/)
      if (h) { cur = h[1]; byTable.set(cur, new Set()); continue }
      if (!cur) continue
      const c = line.match(/^\|\s*`"?([A-Za-z0-9_]+)"?`\s*\|/)
      if (c) byTable.get(cur).add(c[1].toLowerCase())
    }
  }

  const out = []
  out.push('# Data coverage index')
  out.push('')
  out.push('**Auto-generated — do not hand-edit.** `node scripts/gen-data-coverage-index.mjs`')
  out.push('')
  out.push('Answers the question that a schema dump cannot: **what else holds this same entity,')
  out.push('and how much of it does it cover?** Read this BEFORE concluding that anything is')
  out.push('missing, unrecoverable, or not tracked. CLAUDE.md §0 forbids reporting absence from a')
  out.push('single query shape; this index is where the second, differently-shaped check starts.')
  out.push('')
  out.push('`DEAD` = zero rows. `THIN` = under 1% coverage of the parent. Never build on either')
  out.push('without saying so out loud.')
  out.push('')

  for (const ent of ENTITIES) {
    const parentCols = byTable.get(ent.parent)
    if (!parentCols) continue
    const parentRows = (await rowCount(ent.parent)) ?? 0

    out.push(`## Entity: ${ent.name}`)
    out.push('')
    out.push(`Parent table \`${ent.parent}\` — **${parentRows.toLocaleString('en-US')} rows**, keyed \`${ent.parentKey}\`.`)
    out.push('')
    out.push('| Table | Key column | Rows | Rows per parent row | Freshness | Flag |')
    out.push('|---|---|---:|---:|---|---|')

    const rows = []
    for (const [table, colset] of byTable) {
      if (table === ent.parent) continue
      const hit = ent.keys.find((k) => colset.has(k))
      if (!hit) continue
      const n = await rowCount(table)
      if (n === null) continue
      const tsCol = ['event_at', 'viewed_at', 'computed_at', 'updated_at', 'created_at']
        .find((c) => colset.has(c))
      const fresh = (tsCol && n > 0 ? await freshness(table, tsCol) : null) ?? '—'
      const ratio = parentRows ? n / parentRows : 0
      const flag = n === 0 ? '**DEAD**' : ratio < 0.01 ? '**THIN**' : ''
      rows.push({ table, hit, n, ratio, fresh, flag })
    }

    rows.sort((a, b) => b.n - a.n)
    for (const r of rows) {
      out.push(`| \`${r.table}\` | \`${r.hit}\` | ${r.n.toLocaleString('en-US')} | ${r.ratio.toFixed(2)} | ${r.fresh} | ${r.flag} |`)
    }
    out.push('')
    const dead = rows.filter((r) => r.flag.includes('DEAD')).map((r) => r.table)
    if (dead.length) {
      out.push(`**Dead tables for this entity (zero rows):** ${dead.map((t) => `\`${t}\``).join(', ')}.`)
      out.push('A dead table is not evidence that the data does not exist — check the covered tables above first.')
      out.push('')
    }
  }

  out.push('---')
  out.push('')
  out.push(`Generated ${new Date().toISOString().slice(0, 10)}.`)
  writeFileSync(join(HERE, '../docs/DATA_COVERAGE_INDEX.md'), out.join('\n') + '\n')
  console.log('wrote docs/DATA_COVERAGE_INDEX.md')
}

main().catch((e) => { console.error(e.message); process.exit(1) })
