#!/usr/bin/env node
/**
 * backfill-customfields.mjs — ONE-TIME backfill of the Flexmls CustomFields
 * dictionary into on-market listings (search plan Phase 1.2, 2026-07-29).
 *
 * The delta sync now requests `_expand=CustomFields` going forward; this script
 * clears the historical gap for every on-market listing (Active, Active Under
 * Contract, Pending, Coming Soon) by re-pulling each record from Spark with the
 * CF expansion, running the canonical mapper's flatten + redact
 * (lib/listing-mapper.ts, esbuild-bundled here so there is ONE redaction
 * implementation), then:
 *   - merging the PUBLIC CF fields into listings.details (merge, not replace)
 *   - upserting the CONFIDENTIAL CF fields (Owner Name, Phone to Show, escrow)
 *     into the service-role-only listing_private table (merged over existing)
 *
 * Confidential values are NEVER printed by this script.
 *
 * DEFAULT IS DRY RUN (no writes). Real writes require --execute.
 *
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SPARK_API_KEY
 *           (loaded from .env.local automatically when not already in env)
 * Usage:
 *   node scripts/backfill-customfields.mjs --dry-run --limit 3     # smoke test
 *   node scripts/backfill-customfields.mjs                          # full dry run
 *   node scripts/backfill-customfields.mjs --execute --limit 25     # small real run
 *   node scripts/backfill-customfields.mjs --execute                # full backfill
 */
import { readFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { execFileSync } from 'node:child_process'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))

// ── env (.env.local, without clobbering an already-set env) ─────────────────
const envPath = join(ROOT, '.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    let v = m[2]
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (process.env[m[1]] == null) process.env[m[1]] = v
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const SPARK_KEY = (process.env.SPARK_API_KEY || '').trim()
const SPARK_BASE = (process.env.SPARK_API_BASE_URL || 'https://replication.sparkapi.com/v1').replace(/\/$/, '')
if (!SUPABASE_URL || !SERVICE_KEY || !SPARK_KEY) {
  console.error('Missing env (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SPARK_API_KEY)')
  process.exit(1)
}

// ── args ────────────────────────────────────────────────────────────────────
const argv = process.argv.slice(2)
const EXECUTE = argv.includes('--execute')
const flagVal = (name) => {
  const eq = argv.find((a) => a.startsWith(`${name}=`))
  if (eq) return eq.split('=')[1]
  const i = argv.indexOf(name)
  if (i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--')) return argv[i + 1]
  return null
}
const LIMIT = Number(flagVal('--limit') ?? 0) || 0 // 0 = all
const PAGE_SIZE = Math.max(1, Math.min(200, Number(flagVal('--page-size') ?? 100) || 100))
const WRITE_CONCURRENCY = 5

// ── canonical mapper (esbuild-bundled from lib/listing-mapper.ts) ───────────
async function loadMapper() {
  const dir = mkdtempSync(join(tmpdir(), 'rr-cf-mapper-'))
  const out = join(dir, 'listing-mapper.mjs')
  try {
    execFileSync(
      join(ROOT, 'node_modules/.bin/esbuild'),
      [join(ROOT, 'lib/listing-mapper.ts'), '--bundle', '--format=esm', '--platform=node', `--outfile=${out}`, '--log-level=error'],
      { stdio: 'pipe' },
    )
    return await import(pathToFileURL(out).href)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const sb = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// Spark v1 filter — on-market statuses only (~10K rows per the plan audit).
const ON_MARKET_FILTER =
  "StandardStatus Eq 'Active' Or StandardStatus Eq 'Active Under Contract' Or StandardStatus Eq 'Pending' Or StandardStatus Eq 'Coming Soon'"

async function fetchSparkPage(page) {
  const params = new URLSearchParams()
  params.set('_pagination', '1')
  params.set('_limit', String(PAGE_SIZE))
  params.set('_page', String(page))
  params.set('_expand', 'CustomFields')
  params.set('_orderby', '+ListingKey')
  const url = `${SPARK_BASE}/listings?${params.toString()}&_filter=${encodeURIComponent(ON_MARKET_FILTER)}`
  const doFetch = () => fetch(url, { headers: { Authorization: `Bearer ${SPARK_KEY}`, Accept: 'application/json' } })
  let res = await doFetch()
  if (res.status === 429) {
    console.warn('  [spark] 429 rate limited, waiting 60s then retrying once')
    await sleep(60_000)
    res = await doFetch()
  }
  if (!res.ok) throw new Error(`Spark API error ${res.status}: ${(await res.text()).slice(0, 300)}`)
  const data = await res.json()
  if (data.D?.Errors?.length) throw new Error(`Spark API errors: ${JSON.stringify(data.D.Errors)}`)
  return data.D
}

/** Worker-pool over items with fixed concurrency. */
async function pooled(items, concurrency, fn) {
  let cursor = 0
  const worker = async () => {
    for (;;) {
      const i = cursor++
      if (i >= items.length) break
      await fn(items[i], i)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker))
}

async function main() {
  const mapper = await loadMapper()
  const { flattenCustomFields, mergeCustomFieldsIntoDetails, redactPublicDetails, extractPrivateDetails } = mapper

  console.log(`backfill-customfields — ${EXECUTE ? 'EXECUTE (real writes)' : 'DRY RUN (no writes)'}${LIMIT ? `, limit ${LIMIT}` : ''}, page size ${PAGE_SIZE}`)

  const totals = {
    fetched: 0, withCf: 0, detailsUpdated: 0, privateUpserted: 0,
    missingInDb: 0, unchanged: 0, errors: 0,
  }
  let printedSample = false
  let page = 1
  let totalPages = 1

  while (page <= totalPages) {
    const D = await fetchSparkPage(page)
    totalPages = D?.Pagination?.TotalPages ?? page
    let results = D?.Results ?? []
    if (LIMIT && totals.fetched + results.length > LIMIT) results = results.slice(0, LIMIT - totals.fetched)
    if (results.length === 0) break
    totals.fetched += results.length

    // one DB read for the whole page: existing details + existing private rows
    const keys = results
      .map((r) => String(r?.StandardFields?.ListingKey ?? r?.Id ?? '').trim())
      .filter(Boolean)
    const { data: dbRows, error: dbErr } = await sb
      .from('listings').select('ListingKey,details').in('ListingKey', keys)
    if (dbErr) throw new Error(`listings read failed: ${dbErr.message}`)
    const detailsByKey = new Map((dbRows ?? []).map((r) => [r.ListingKey, r.details ?? {}]))
    const { data: privRows, error: privErr } = await sb
      .from('listing_private').select('listing_key,private_data').in('listing_key', keys)
    if (privErr) throw new Error(`listing_private read failed: ${privErr.message}`)
    const privByKey = new Map((privRows ?? []).map((r) => [r.listing_key, r.private_data ?? {}]))

    const detailUpdates = []
    const privateUpserts = []

    for (const result of results) {
      const sf = result?.StandardFields ?? {}
      const key = String(sf.ListingKey ?? result?.Id ?? '').trim()
      if (!key) continue
      const cfFlat = flattenCustomFields(result?.CustomFields)
      const cfKeyCount = Object.keys(cfFlat).length
      if (cfKeyCount > 0) totals.withCf++

      const privOnly = extractPrivateDetails({}, result?.CustomFields)

      // sample printout for the first CF-bearing listing (confidential values masked)
      if (!printedSample && cfKeyCount > 0) {
        printedSample = true
        const publicFlat = redactPublicDetails(cfFlat)
        const privNames = privOnly ? Object.keys(privOnly) : []
        console.log(`\n  sample listing ${key} (${sf.City ?? '?'}) — ${cfKeyCount} CF fields flattened`)
        console.log(`    public CF fields (${Object.keys(publicFlat).length}): ${Object.keys(publicFlat).join(' | ')}`)
        console.log(`    confidential CF fields diverted (${privNames.length}): ${privNames.map((n) => `${n}=«redacted»`).join(' | ') || '(none)'}\n`)
      }

      if (cfKeyCount === 0) continue

      if (!detailsByKey.has(key)) { totals.missingInDb++; continue }

      const existingDetails = detailsByKey.get(key)
      const merged = redactPublicDetails(
        mergeCustomFieldsIntoDetails(existingDetails, redactPublicDetails(cfFlat)),
      )
      if (JSON.stringify(merged) !== JSON.stringify(existingDetails)) {
        detailUpdates.push({ key, details: merged })
      } else {
        totals.unchanged++
      }

      if (privOnly) {
        const mergedPriv = { ...(privByKey.get(key) ?? {}), ...privOnly }
        privateUpserts.push({ listing_key: key, private_data: mergedPriv, updated_at: new Date().toISOString() })
      }
    }

    if (EXECUTE) {
      await pooled(detailUpdates, WRITE_CONCURRENCY, async (u) => {
        const { error } = await sb.from('listings').update({ details: u.details }).eq('ListingKey', u.key)
        if (error) { totals.errors++; console.error(`  details update failed for ${u.key}: ${error.message}`) }
        else totals.detailsUpdated++
      })
      for (let i = 0; i < privateUpserts.length; i += 25) {
        const chunk = privateUpserts.slice(i, i + 25)
        const { error } = await sb.from('listing_private').upsert(chunk, { onConflict: 'listing_key' })
        if (error) { totals.errors++; console.error(`  listing_private upsert failed: ${error.message}`) }
        else totals.privateUpserted += chunk.length
      }
    } else {
      totals.detailsUpdated += detailUpdates.length
      totals.privateUpserted += privateUpserts.length
    }

    console.log(
      `  page ${page}/${totalPages} — fetched ${results.length}, with CF ${totals.withCf}, ` +
      `details ${EXECUTE ? 'updated' : 'would update'} ${totals.detailsUpdated}, ` +
      `private ${EXECUTE ? 'upserted' : 'would upsert'} ${totals.privateUpserted}, ` +
      `unchanged ${totals.unchanged}, not-in-db ${totals.missingInDb}, errors ${totals.errors}`,
    )

    if (LIMIT && totals.fetched >= LIMIT) break
    page++
  }

  console.log(`\nDONE (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}).`)
  console.log(JSON.stringify(totals, null, 2))
  if (!EXECUTE) console.log('No writes were made. Re-run with --execute to apply.')
  if (totals.errors > 0) process.exit(1)
}

main().catch((err) => {
  console.error('backfill-customfields failed:', err?.message ?? err)
  process.exit(1)
})
