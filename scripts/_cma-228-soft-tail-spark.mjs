#!/usr/bin/env node
/**
 * CMA data pull via Spark API for 228 SE Soft Tail Dr, Bend OR.
 *
 * Subject is OFF-MARKET (confirmed by Matt). Subdivision = Hollow Pine Estate, zip 97702.
 *
 * Pulls:
 *   1. All Active + Coming Soon listings in Hollow Pine Estate (current pricing context)
 *   2. All Closed listings in Hollow Pine Estate, last 24 months (primary comp set)
 *   3. All Closed listings in Hollow Pine Estate, last 36 months (fallback if comp set thin)
 *   4. Photos for each comp (PrimaryPhoto plus first 6 supplementary)
 *
 * Writes raw JSON to out/cma-228-soft-tail/raw/ for downstream HTML build.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(__dirname, '..')

function loadEnvLocal() {
  const path = resolve(REPO_ROOT, '.env.local')
  const raw = readFileSync(path, 'utf8')
  for (const line of raw.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'")))
      val = val.slice(1, -1)
    if (!process.env[key]) process.env[key] = val
  }
}
loadEnvLocal()

const SPARK_BASE = (process.env.SPARK_API_BASE_URL || 'https://sparkapi.com/v1').replace(/\/+$/, '')
const SPARK_AUTH = (process.env.SPARK_AUTH_SCHEME || 'Bearer').trim()
const TOKEN = (process.env.SPARK_API_KEY || '').trim()

if (!TOKEN) {
  console.error('SPARK_API_KEY missing')
  process.exit(1)
}

const OUT_DIR = resolve(REPO_ROOT, 'out/cma-228-soft-tail/raw')
mkdirSync(OUT_DIR, { recursive: true })

const baseHeaders = {
  Authorization: `${SPARK_AUTH} ${TOKEN}`,
  Accept: 'application/json',
}

function parseResults(data) {
  const d = data?.D
  const raw = d?.Results ?? data?.Results
  if (!Array.isArray(raw)) return []
  return raw
}

function buildUrl(path, params) {
  const url = new URL(`${SPARK_BASE}${path}`)
  for (const [k, v] of Object.entries(params || {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v))
  }
  return url.toString()
}

async function sparkGet(path, params, label) {
  const url = buildUrl(path, params)
  const res = await fetch(url, { headers: baseHeaders })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    console.error(`  ${label}: HTTP ${res.status}`)
    if (data?.D?.Message) console.error(`    ${data.D.Message}`)
  }
  return { status: res.status, data }
}

function dump(name, obj) {
  writeFileSync(resolve(OUT_DIR, `${name}.json`), JSON.stringify(obj, null, 2))
}

function fmtAddress(r) {
  const fields = r.StandardFields || r
  return `${fields.StreetNumber ?? ''} ${fields.StreetDirPrefix ?? ''} ${fields.StreetName ?? ''} ${fields.StreetSuffix ?? ''}, ${fields.City ?? ''} ${fields.PostalCode ?? ''}`.replace(/\s+/g, ' ').trim()
}

const SUBDIVISION = 'Hollow Pine Estate'
const today = new Date()
const min24 = new Date(today.getFullYear(), today.getMonth() - 24, today.getDate()).toISOString().slice(0, 10)
const min36 = new Date(today.getFullYear(), today.getMonth() - 36, today.getDate()).toISOString().slice(0, 10)

// ---------- Active / Coming Soon in Hollow Pine ----------
console.log('=== Active + Coming Soon in Hollow Pine Estate ===')
{
  const f = `City Eq 'Bend' And SubdivisionName Eq '${SUBDIVISION}' And PropertyType Eq 'A' And (StandardStatus Eq 'Active' Or StandardStatus Eq 'Active Under Contract' Or StandardStatus Eq 'Pending' Or MlsStatus Eq 'Coming Soon')`
  const { data } = await sparkGet(
    '/listings',
    { _filter: f, _limit: 50, _expand: 'PrimaryPhoto', _orderby: '-OnMarketDate' },
    'active-search',
  )
  const rows = parseResults(data)
  console.log(`  ${rows.length} active/coming-soon rows`)
  for (const r of rows) {
    const sf = r.StandardFields || r
    console.log(
      `    • ${fmtAddress(r)} | ${sf.StandardStatus}/${sf.MlsStatus} | List $${sf.ListPrice} | ${sf.BedsTotal}bd/${sf.BathsTotal}ba/${sf.BuildingAreaTotal}sf | ${sf.LotSizeAcres ?? '?'}ac | ${sf.YearBuilt} | Key=${r.Id}`,
    )
  }
  dump('active', rows)
}

// ---------- Closed in Hollow Pine, 24 months ----------
console.log(`\n=== Closed in Hollow Pine Estate, since ${min24} ===`)
let closedRecent = []
{
  const f = `City Eq 'Bend' And SubdivisionName Eq '${SUBDIVISION}' And PropertyType Eq 'A' And StandardStatus Eq 'Closed' And CloseDate Ge ${min24}`
  const { data } = await sparkGet(
    '/listings',
    { _filter: f, _limit: 50, _expand: 'PrimaryPhoto', _orderby: '-CloseDate' },
    'closed-24mo',
  )
  closedRecent = parseResults(data)
  console.log(`  ${closedRecent.length} closed rows in last 24 months`)
  for (const r of closedRecent) {
    const sf = r.StandardFields || r
    console.log(
      `    • ${fmtAddress(r)} | Close $${sf.ClosePrice} (${sf.CloseDate}) | List $${sf.ListPrice} | ${sf.BedsTotal}bd/${sf.BathsTotal}ba/${sf.BuildingAreaTotal}sf | ${sf.LotSizeAcres ?? '?'}ac | ${sf.YearBuilt} | DOM ${sf.DaysOnMarket} | Key=${r.Id}`,
    )
  }
  dump('closed_24mo', closedRecent)
}

// ---------- Closed in Hollow Pine, 36 months (fallback if thin) ----------
if (closedRecent.length < 6) {
  console.log(`\n=== Closed in Hollow Pine Estate, since ${min36} (fallback) ===`)
  const f = `City Eq 'Bend' And SubdivisionName Eq '${SUBDIVISION}' And PropertyType Eq 'A' And StandardStatus Eq 'Closed' And CloseDate Ge ${min36}`
  const { data } = await sparkGet(
    '/listings',
    { _filter: f, _limit: 50, _expand: 'PrimaryPhoto', _orderby: '-CloseDate' },
    'closed-36mo',
  )
  const rows = parseResults(data)
  console.log(`  ${rows.length} closed rows in last 36 months`)
  for (const r of rows) {
    const sf = r.StandardFields || r
    console.log(
      `    • ${fmtAddress(r)} | Close $${sf.ClosePrice} (${sf.CloseDate}) | List $${sf.ListPrice} | ${sf.BedsTotal}bd/${sf.BathsTotal}ba/${sf.BuildingAreaTotal}sf | ${sf.LotSizeAcres ?? '?'}ac | ${sf.YearBuilt} | DOM ${sf.DaysOnMarket} | Key=${r.Id}`,
    )
  }
  dump('closed_36mo', rows)
}

console.log(`\nDONE. Raw JSON in ${OUT_DIR}`)
console.log(`  active.json, closed_24mo.json, closed_36mo.json (if needed)`)
