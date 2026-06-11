#!/usr/bin/env node
/**
 * Pull all YTD 2026 expired/canceled/withdrawn SFR listings $500K+ in our
 * service area direct from the Spark API. Bypasses the Supabase listings
 * cache (which is currently flaky / pool-pinched). Uses the EXACT criteria
 * the live cron uses (lib/expired-listing-processor.ts):
 *
 *   - StandardStatus in (Expired, Canceled, Withdrawn)
 *   - PropertyType = 'A' (SFR)
 *   - ListPrice >= $500,000
 *   - City in (Bend, Redmond, Sisters, Sunriver, Tumalo, La Pine)
 *   - StatusChangeTimestamp >= 2026-01-01
 *
 * Output: out/westside-bend-merge/expired-spark-raw.jsonl
 * One Spark "StandardFields" object per line. Idempotent — overwrites the
 * file on each run. Pages through Spark in 200-row batches.
 *
 * Usage:
 *   node --env-file=.env.local scripts/_expired-backfill-spark-extract.mjs
 *   node --env-file=.env.local scripts/_expired-backfill-spark-extract.mjs --since 2025-01-01
 *   node --env-file=.env.local scripts/_expired-backfill-spark-extract.mjs --limit 50
 */
import fs from 'node:fs/promises'
import path from 'node:path'

const ROOT = process.cwd()
const OUT_PATH = path.join(ROOT, 'out/westside-bend-merge/expired-spark-raw.jsonl')

const SERVICE_AREA_CITIES = ['Bend', 'Redmond', 'Sisters', 'Sunriver', 'Tumalo', 'La Pine']
const MIN_LIST_PRICE = 500000
const STATUSES = ['Expired', 'Canceled', 'Withdrawn']

// Fields we want per listing — these feed the merge + brief generators
const SELECT_FIELDS = [
  'ListingKey', 'MlsNumber', 'StandardStatus', 'StatusChangeTimestamp',
  'ListingContractDate', 'ExpirationDate', 'CancellationDate', 'WithdrawnDate',
  'StreetNumber', 'StreetName', 'City', 'StateOrProvince', 'PostalCode',
  'Latitude', 'Longitude', 'SubdivisionName', 'CountyOrParish',
  'ListPrice', 'OriginalListPrice',
  'BedroomsTotal', 'BathroomsTotalInteger', 'LivingArea', 'YearBuilt',
  'LotSizeAcres', 'LotSizeSquareFeet', 'PropertySubType',
  'CumulativeDaysOnMarket', 'DaysOnMarket',
  'ListAgentFullName', 'ListAgentEmail', 'ListAgentMlsId', 'ListAgentOfficePhone',
  'ListOfficeName', 'ListOfficeMlsId',
  'PublicRemarks',
]

function parseArgs(argv) {
  const out = { since: '2026-01-01', limit: Infinity }
  for (let i = 0; i < argv.length; i += 1) {
    const t = argv[i]
    if (t === '--since') out.since = argv[++i]
    else if (t === '--limit') out.limit = parseInt(argv[++i], 10)
  }
  return out
}

function buildFilter(sinceISO) {
  const statusFilter = '(' + STATUSES.map((s) => `StandardStatus Eq '${s}'`).join(' Or ') + ')'
  const cityFilter = '(' + SERVICE_AREA_CITIES.map((c) => `City Eq '${c}'`).join(' Or ') + ')'
  return [
    statusFilter,
    "PropertyType Eq 'A'",
    cityFilter,
    `ListPrice Ge ${MIN_LIST_PRICE}`,
    `StatusChangeTimestamp Ge ${sinceISO}`,
  ].join(' And ')
}

async function fetchPage(baseUrl, apiKey, filter, select, limit, skip) {
  const url = `${baseUrl}/listings?_filter=${encodeURIComponent(filter)}&_select=${encodeURIComponent(select.join(','))}&_limit=${limit}&_skip=${skip}&_orderby=StatusChangeTimestamp%20desc`
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const r = await fetch(url, {
        headers: { Authorization: 'Bearer ' + apiKey, Accept: 'application/json' },
        signal: AbortSignal.timeout(60000),
      })
      if (!r.ok) {
        const txt = await r.text().catch(() => '')
        throw new Error(`Spark ${r.status} — ${txt.slice(0, 200)}`)
      }
      const j = await r.json()
      return j.D?.Results || []
    } catch (e) {
      console.error(`[spark] attempt ${attempt} failed: ${e.message}`)
      if (attempt < 3) await new Promise((r) => setTimeout(r, 2000 * attempt))
      else throw e
    }
  }
  return []
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const apiKey = process.env.SPARK_API_KEY
  const baseUrl = process.env.SPARK_API_BASE_URL || 'https://replication.sparkapi.com/v1'
  if (!apiKey) {
    console.error('SPARK_API_KEY missing from env')
    process.exit(1)
  }

  const filter = buildFilter(args.since)
  console.log(`[spark] Filter:`)
  console.log(`        ${filter}`)
  console.log(`[spark] Fields: ${SELECT_FIELDS.length}`)
  console.log(`[spark] Limit: ${args.limit === Infinity ? 'no limit' : args.limit}`)

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true })
  await fs.writeFile(OUT_PATH, '')

  const PAGE_SIZE = 200
  let skip = 0
  let total = 0
  const byStatus = { Expired: 0, Canceled: 0, Withdrawn: 0 }
  const byCity = {}
  while (total < args.limit) {
    const pageLimit = Math.min(PAGE_SIZE, args.limit - total)
    const results = await fetchPage(baseUrl, apiKey, filter, SELECT_FIELDS, pageLimit, skip)
    if (!results.length) break
    const lines = []
    for (const row of results) {
      const sf = row.StandardFields || {}
      sf._spark_id = row.Id
      lines.push(JSON.stringify(sf))
      total += 1
      const st = sf.StandardStatus || 'unknown'
      byStatus[st] = (byStatus[st] || 0) + 1
      const ci = sf.City || 'unknown'
      byCity[ci] = (byCity[ci] || 0) + 1
    }
    await fs.appendFile(OUT_PATH, lines.join('\n') + '\n')
    skip += results.length
    console.log(`[spark] page skip=${skip - results.length}..${skip} (+${results.length}, total=${total})`)
    if (results.length < pageLimit) break
    await new Promise((r) => setTimeout(r, 250))
  }

  console.log(`\n[spark] === Done ===`)
  console.log(`Total: ${total}`)
  console.log('By status:', byStatus)
  console.log('By city:', byCity)
  console.log(`Output: ${OUT_PATH}`)
}

main().catch((e) => {
  console.error('FATAL:', e.message)
  process.exit(1)
})
