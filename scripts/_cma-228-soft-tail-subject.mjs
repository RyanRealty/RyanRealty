#!/usr/bin/env node
/**
 * Pull full subject record + photos for 228 SE Soft Tail Dr, Bend OR
 * (last MLS listing 2022-12-01 close, ListingKey 20220901211339310776000000).
 * Also fetch listing history (price + status) to flag any prior listings.
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

async function sparkGet(path, params) {
  const url = new URL(`${SPARK_BASE}${path}`)
  for (const [k, v] of Object.entries(params || {})) url.searchParams.set(k, String(v))
  const res = await fetch(url.toString(), { headers: baseHeaders })
  const data = await res.json().catch(() => ({}))
  return { status: res.status, data }
}

const OUT_DIR = resolve(REPO_ROOT, 'out/cma-228-soft-tail/raw')
mkdirSync(OUT_DIR, { recursive: true })

const SUBJECT_KEY = '20220901211339310776000000'

console.log('=== Subject record ===')
{
  const { status, data } = await sparkGet(`/listings/${SUBJECT_KEY}`, { _expand: 'PrimaryPhoto' })
  console.log(`  HTTP ${status}`)
  if (data?.D?.Message) console.log(`  Message: ${data.D.Message}`)
  if (!data?.D?.Results?.length) {
    console.log('  Body sample:', JSON.stringify(data).slice(0, 500))
  }
  const r = data?.D?.Results?.[0]
  if (!r) {
    console.error('No subject returned')
    process.exit(2)
  }
  writeFileSync(resolve(OUT_DIR, 'subject_full.json'), JSON.stringify(r, null, 2))
  const sf = r.StandardFields || r
  console.log(`  Address: ${sf.StreetNumber} ${sf.StreetDirPrefix ?? ''} ${sf.StreetName} ${sf.StreetSuffix ?? ''}, ${sf.City} ${sf.PostalCode}`)
  console.log(`  Status: ${sf.StandardStatus} / ${sf.MlsStatus}`)
  console.log(`  Subdivision: ${sf.SubdivisionName}`)
  console.log(`  Beds/Baths/Sqft: ${sf.BedsTotal}bd / ${sf.BathsTotal}ba / ${sf.BuildingAreaTotal}sf`)
  console.log(`  Lot: ${sf.LotSizeAcres} ac`)
  console.log(`  Year Built: ${sf.YearBuilt}`)
  console.log(`  Garage: ${sf.GarageSpaces}`)
  console.log(`  List $${sf.ListPrice} → Close $${sf.ClosePrice} (${sf.CloseDate})`)
  console.log(`  OnMarket: ${sf.OnMarketDate}, DOM: ${sf.DaysOnMarket}`)
  console.log(`  Lat/Lng: ${sf.Latitude}, ${sf.Longitude}`)
  console.log(`  Public Remarks (excerpt): ${(sf.PublicRemarks || '').slice(0, 500)}`)
}

console.log('\n=== Subject photos ===')
{
  const { status, data } = await sparkGet(`/listings/${SUBJECT_KEY}/photos`, { _limit: 50 })
  console.log(`  HTTP ${status}`)
  const photos = data?.D?.Results || []
  writeFileSync(resolve(OUT_DIR, 'subject_full_photos.json'), JSON.stringify(photos, null, 2))
  console.log(`  ${photos.length} photos`)
  for (const p of photos.slice(0, 6)) {
    console.log(`    Order ${p.Order}: ${p.Uri800} (${p.Caption ?? ''})`)
  }
}

console.log('\n=== Subject history (price + status) ===')
{
  const { status, data } = await sparkGet(`/listings/${SUBJECT_KEY}/history`, {})
  console.log(`  HTTP ${status}`)
  const hist = data?.D?.Results || []
  writeFileSync(resolve(OUT_DIR, 'subject_history.json'), JSON.stringify(hist, null, 2))
  console.log(`  ${hist.length} history events`)
  for (const h of hist.slice(0, 20)) {
    console.log(`    ${h.EventTimestamp ?? h.Date} | ${h.EventType ?? h.Type} | ${JSON.stringify(h).slice(0, 200)}`)
  }
}

console.log('\n=== Look for ANY prior listings at the same address ===')
{
  const { status, data } = await sparkGet('/listings', {
    _filter: `City Eq 'Bend' And StreetNumber Eq '228' And StreetName Eq 'Soft Tail'`,
    _limit: 50,
  })
  console.log(`  HTTP ${status}`)
  const rows = data?.D?.Results || []
  for (const r of rows) {
    const sf = r.StandardFields || r
    console.log(
      `    • Key=${r.Id} | ${sf.StandardStatus}/${sf.MlsStatus} | OnMarket ${sf.OnMarketDate} → Close ${sf.CloseDate} | List $${sf.ListPrice} | Close $${sf.ClosePrice}`
    )
  }
  writeFileSync(resolve(OUT_DIR, 'subject_all_listings.json'), JSON.stringify(rows, null, 2))
}

console.log('\nDONE.')
