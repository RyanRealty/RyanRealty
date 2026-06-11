#!/usr/bin/env node
/**
 * Find any historical listing for 228 SE Soft Tail Dr, Bend OR.
 * Off-market currently — check /listings/historical for old listings,
 * paginate ALL Soft Tail records in Bend.
 */
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
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

const baseHeaders = { Authorization: `${SPARK_AUTH} ${TOKEN}`, Accept: 'application/json' }

function parseResults(data) {
  const d = data?.D
  return Array.isArray(d?.Results) ? d.Results : []
}

async function sparkGet(path, params) {
  const url = new URL(`${SPARK_BASE}${path}`)
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), { headers: baseHeaders })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const OUT_DIR = resolve(REPO_ROOT, 'out/cma-228-soft-tail/raw')
mkdirSync(OUT_DIR, { recursive: true })

function fmt(r) {
  const sf = r.StandardFields || r
  return `${sf.StreetNumber ?? '?'} ${sf.StreetDirPrefix ?? ''} ${sf.StreetName} ${sf.StreetSuffix ?? ''}`.trim()
}

console.log('=== Pass 1: /listings  paginate Soft Tail in Bend ===')
let allActive = []
{
  let token = null
  let page = 0
  while (true) {
    page++
    const params = {
      _filter: `City Eq 'Bend' And StreetName Eq 'Soft Tail'`,
      _limit: 100,
    }
    if (token) params._skiptoken = token
    const { status, data } = await sparkGet('/listings', params)
    const rows = parseResults(data)
    allActive.push(...rows)
    console.log(`  page ${page}: HTTP ${status}, +${rows.length} (total ${allActive.length})`)
    const next = data?.D?.Pagination?.NextPageSkipToken || data?.D?.Pagination?.SkipToken
    if (!next || rows.length === 0 || page > 5) break
    token = next
  }
  console.log(`  total /listings rows: ${allActive.length}`)
  for (const r of allActive) {
    const sf = r.StandardFields || r
    if (String(sf.StreetNumber) === '228') {
      console.log(`  ✓ FOUND 228: ${fmt(r)} | ${sf.StandardStatus}/${sf.MlsStatus} | ${sf.CloseDate ?? ''} | List $${sf.ListPrice} | Close $${sf.ClosePrice} | Key=${r.Id}`)
    }
  }
}

console.log('\n=== Pass 2: /listings/historical  paginate Soft Tail in Bend ===')
let allHistorical = []
{
  let token = null
  let page = 0
  while (true) {
    page++
    const params = {
      _filter: `City Eq 'Bend' And StreetName Eq 'Soft Tail'`,
      _limit: 100,
    }
    if (token) params._skiptoken = token
    const { status, data } = await sparkGet('/listings/historical', params)
    const rows = parseResults(data)
    allHistorical.push(...rows)
    console.log(`  page ${page}: HTTP ${status}, +${rows.length} (total ${allHistorical.length})`)
    const next = data?.D?.Pagination?.NextPageSkipToken || data?.D?.Pagination?.SkipToken
    if (!next || rows.length === 0 || page > 5) break
    token = next
  }
  console.log(`  total /listings/historical rows: ${allHistorical.length}`)
  const hits = []
  for (const r of allHistorical) {
    const sf = r.StandardFields || r
    if (String(sf.StreetNumber) === '228') {
      hits.push(r)
      console.log(`  ✓ FOUND 228: ${fmt(r)} | ${sf.StandardStatus}/${sf.MlsStatus} | OnMarket ${sf.OnMarketDate} → Close ${sf.CloseDate} | List $${sf.ListPrice} | Close $${sf.ClosePrice} | ${sf.BedsTotal}bd/${sf.BathsTotal}ba/${sf.BuildingAreaTotal}sf | ${sf.LotSizeAcres ?? '?'}ac | YR ${sf.YearBuilt} | Key=${r.Id}`)
    }
  }
  writeFileSync(resolve(OUT_DIR, 'all_softtail_historical.json'), JSON.stringify(allHistorical, null, 2))
  writeFileSync(resolve(OUT_DIR, 'subject_history_hits.json'), JSON.stringify(hits, null, 2))
}

console.log('\nDONE.')
