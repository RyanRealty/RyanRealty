#!/usr/bin/env node
// Pull verified YTD 2026 + YTD 2025 SFR stats for 6 Central Oregon cities.
// Source of truth: Supabase market_pulse_live (pre-computed, used by ryanrealty.com).
// Augmented with direct YTD-2026 + YTD-2025 closed-listing queries for YoY comparison.
// Uses curl --resolve to bypass a broken getaddrinfo path.
//
// Run: node --env-file=/Users/matthewryan/RyanRealty/.env.local scripts/pull-data.mjs

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { promises as dnsP } from 'node:dns'

const exec = promisify(execFile)
const __dirname = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = resolve(__dirname, '..', 'data')

const URL_BASE = process.env.NEXT_PUBLIC_SUPABASE_URL
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!URL_BASE || !KEY) { console.error('Missing env'); process.exit(1) }
const HOST = new URL(URL_BASE).hostname
const HOST_IPS = await dnsP.resolve4(HOST)
console.log(`Resolved ${HOST} → ${HOST_IPS.join(', ')}`)
let ipIdx = 0
const nextIP = () => HOST_IPS[ipIdx++ % HOST_IPS.length]

async function pgrest(qs) {
  const url = `${URL_BASE}/rest/v1/${qs}`
  for (let attempt = 1; attempt <= 5; attempt++) {
    const ip = nextIP()
    try {
      const { stdout } = await exec('curl', [
        '-sS', '-m', '90', '--connect-timeout', '10',
        '--resolve', `${HOST}:443:${ip}`,
        '-H', `apikey: ${KEY}`,
        '-H', `Authorization: Bearer ${KEY}`,
        '-H', 'Accept: application/json',
        url,
      ], { maxBuffer: 64 * 1024 * 1024 })
      if (!stdout || !stdout.trim()) throw new Error('empty')
      const parsed = JSON.parse(stdout)
      if (parsed && parsed.message) throw new Error(`postgrest: ${parsed.message}`)
      return parsed
    } catch (e) {
      if (attempt === 5) throw new Error(`pgrest fail (${qs.slice(0, 200)}): ${e.message}`)
      await new Promise(r => setTimeout(r, 600 * attempt))
    }
  }
}

// MLS PropertyType codes: A=Residential (SFR), B=Manufactured, C=Multi-Family,
// D=Land, E=Commercial, F=Farm/Ranch, G=Business, H=Industrial.
// SFR for market-report = 'A' (residential). Treat null as 'A' per existing
// convention in lib/market-stats.ts (market_pulse_live keyed on property_type='A').
const isSFR = (row) => {
  const t = (row.PropertyType || '').trim()
  return t === 'A' || t === ''
}

const median = (arr) => { if (!arr.length) return null; const s = [...arr].sort((a,b)=>a-b); const m = Math.floor(s.length/2); return s.length % 2 ? s[m] : (s[m-1]+s[m])/2 }
const mean = (arr) => arr.length ? arr.reduce((s,x)=>s+x,0) / arr.length : null

function summarizeClosed(rows) {
  const sale = rows.map(r => Number(r.ClosePrice)).filter(p => Number.isFinite(p) && p >= 50000)
  const original = rows.map(r => Number(r.OriginalListPrice)).filter(p => Number.isFinite(p) && p >= 50000)
  const dom = rows.map(r => Number(r.DaysOnMarket)).filter(d => Number.isFinite(d) && d >= 0 && d < 3650)
  const ppsf = rows
    .filter(r => Number(r.ClosePrice) >= 50000 && Number(r.TotalLivingAreaSqFt) > 200)
    .map(r => Number(r.ClosePrice) / Number(r.TotalLivingAreaSqFt))
    .filter(p => p >= 50 && p <= 2000)
  // Sale-to-list ratio: per-row (Close / Original) but ONLY where both are
  // realistic prices, then take MEDIAN (robust to junk rows). Aligns with
  // pulse.median_sale_to_list which is the website's published number.
  const ratios = rows
    .filter(r => Number(r.ClosePrice) >= 50000 && Number(r.OriginalListPrice) >= 50000)
    .map(r => Number(r.ClosePrice) / Number(r.OriginalListPrice))
    .filter(x => x >= 0.5 && x <= 1.5)
  return {
    count: rows.length,
    medianSalePrice: median(sale),
    avgSalePrice: mean(sale) ? Math.round(mean(sale)) : null,
    medianOriginalListPrice: median(original),
    medianDOM: median(dom),
    medianPPSF: median(ppsf) ? Math.round(median(ppsf)) : null,
    medianSaleToOriginalListRatio: median(ratios),
    saleToListSampleSize: ratios.length,
    totalVolume: Math.round(sale.reduce((s,x)=>s+x,0)),
  }
}

const enc = (s) => encodeURIComponent(s)
const cityFilter = (city) => `City=ilike.${enc(city)}`

// Use simple ilike for closed (single filter — index-friendly)
async function fetchClosedYTD(city, startISO, endISO) {
  const out = []
  const PAGE = 1000
  let from = 0
  for (;;) {
    const cols = 'ListingKey,StandardStatus,ClosePrice,OriginalListPrice,CloseDate,DaysOnMarket,TotalLivingAreaSqFt,PropertyType'
    const url = `listings?select=${cols}&${cityFilter(city)}&StandardStatus=ilike.${enc('%Closed%')}&CloseDate=gte.${startISO}&CloseDate=lte.${endISO}&order=CloseDate.asc&offset=${from}&limit=${PAGE}`
    const data = await pgrest(url)
    out.push(...data)
    if (data.length < PAGE) break
    from += PAGE
    if (from > 60000) throw new Error('runaway')
  }
  return out
}

// Pull market_pulse_live (one row per city for property_type=A residential).
async function fetchPulseAll() {
  // Slugs use spaces in this DB (geo_slug='la pine', not 'la-pine')
  const url = `market_pulse_live?geo_type=eq.city&property_type=eq.A&select=*`
  const rows = await pgrest(url)
  const map = {}
  for (const r of rows) map[r.geo_slug] = r
  return map
}

const TODAY = '2026-04-27'
const YTD_START = '2026-01-01'
const YTD_END = TODAY
const PRIOR_START = '2025-01-01'
const PRIOR_END = '2025-04-27'
const verifiedAt = new Date().toISOString()

const CITIES = [
  { name: 'Bend', slug: 'bend' },
  { name: 'Redmond', slug: 'redmond' },
  { name: 'Sisters', slug: 'sisters' },
  { name: 'La Pine', slug: 'la pine' },
  { name: 'Prineville', slug: 'prineville' },
  { name: 'Sunriver', slug: 'sunriver' },
]

async function processCity(city, pulse) {
  console.log(`\n=== ${city.name} ===`)
  if (!pulse) throw new Error(`No market_pulse_live row for ${city.slug}`)
  const ytd2026Raw = await fetchClosedYTD(city.name, YTD_START, YTD_END)
  console.log(`  closed YTD 2026 raw: ${ytd2026Raw.length}`)
  const ytd2025Raw = await fetchClosedYTD(city.name, PRIOR_START, PRIOR_END)
  console.log(`  closed YTD 2025 raw: ${ytd2025Raw.length}`)
  const ytd2026 = ytd2026Raw.filter(isSFR)
  const ytd2025 = ytd2025Raw.filter(isSFR)
  console.log(`  closed YTD 2026 SFR: ${ytd2026.length}  YTD 2025 SFR: ${ytd2025.length}`)

  const c2026 = summarizeClosed(ytd2026)
  const c2025 = summarizeClosed(ytd2025)

  const yoy = (now, prior) => (now != null && prior != null && prior !== 0) ? (now - prior) / prior : null
  const derived = {
    yoy_median_sale_price: yoy(c2026.medianSalePrice, c2025.medianSalePrice),
    yoy_median_dom: yoy(c2026.medianDOM, c2025.medianDOM),
    yoy_median_ppsf: yoy(c2026.medianPPSF, c2025.medianPPSF),
    yoy_closed_count: yoy(c2026.count, c2025.count),
    yoy_sale_to_list: yoy(c2026.medianSaleToOriginalListRatio, c2025.medianSaleToOriginalListRatio),
  }

  // Market classification per CLAUDE.md (≤4 seller, 4-6 balanced, ≥6 buyer)
  const mos = pulse.months_of_supply
  const classification = mos == null ? 'unknown' : mos < 4 ? 'seller' : mos < 6 ? 'balanced' : 'buyer'

  const snapshot = {
    city: city.name,
    period: { ytd_start: YTD_START, ytd_end: YTD_END, prior_start: PRIOR_START, prior_end: PRIOR_END },
    verified_at: verifiedAt,
    sources: {
      live: 'Supabase market_pulse_live (geo_type=city, property_type=A, residential SFR aggregate)',
      ytd_closed: 'Supabase listings (StandardStatus ilike %Closed%, CloseDate window, SFR filter applied client-side)',
    },
    sfr_filter: 'PropertyType IS NULL OR not matching /(condo|townhouse|manufactured|mobile|acreage|land|farm|ranch|commercial|multi-family|business|industrial)/i',
    pulse: {
      active_count: pulse.active_count,
      pending_count: pulse.pending_count,
      new_count_7d: pulse.new_count_7d,
      new_count_30d: pulse.new_count_30d,
      median_list_price: pulse.median_list_price,
      avg_list_price: pulse.avg_list_price,
      months_of_supply: pulse.months_of_supply,
      absorption_rate_pct: pulse.absorption_rate_pct,
      pending_to_active_ratio: pulse.pending_to_active_ratio,
      median_sale_to_list: pulse.median_sale_to_list,
      pct_sold_over_asking: pulse.pct_sold_over_asking,
      pct_sold_under_asking: pulse.pct_sold_under_asking,
      pct_sold_at_asking: pulse.pct_sold_at_asking,
      median_days_to_pending: pulse.median_days_to_pending,
      median_active_dom: pulse.median_active_dom,
      sold_count_30d: pulse.sold_count_30d,
      sold_count_90d: pulse.sold_count_90d,
      median_close_price_90d: pulse.median_close_price_90d,
      price_reduction_share: pulse.price_reduction_share,
      net_inventory_change_30d: pulse.net_inventory_change_30d,
      pulse_updated_at: pulse.updated_at,
    },
    ytd_2026: { ...c2026, raw_count_pre_sfr: ytd2026Raw.length },
    ytd_2025: { ...c2025, raw_count_pre_sfr: ytd2025Raw.length },
    derived: { ...derived, market_classification: classification, market_classification_basis: 'months_of_supply (≤4 seller / 4-6 balanced / ≥6 buyer)' },
  }
  const path = resolve(DATA_DIR, `${city.slug}.json`)
  await writeFile(path, JSON.stringify(snapshot, null, 2))
  console.log(`  Active: ${pulse.active_count}  Pending: ${pulse.pending_count}  MoS: ${pulse.months_of_supply} (${classification})`)
  console.log(`  Median list (active): $${pulse.median_list_price?.toLocaleString()}  Median sale (90d): $${pulse.median_close_price_90d?.toLocaleString()}`)
  console.log(`  YTD 2026 median sale: $${c2026.medianSalePrice?.toLocaleString()}  DOM: ${c2026.medianDOM}  PPSF: $${c2026.medianPPSF}  S/L (orig median, n=${c2026.saleToListSampleSize}): ${(c2026.medianSaleToOriginalListRatio*100)?.toFixed(2)}%`)
  console.log(`  YoY median sale: ${derived.yoy_median_sale_price != null ? (derived.yoy_median_sale_price*100).toFixed(2)+'%' : 'n/a'}`)
  return snapshot
}

await mkdir(DATA_DIR, { recursive: true })
const pulseMap = await fetchPulseAll()
console.log('Pulse rows:', Object.keys(pulseMap).length)
const results = []
for (const c of CITIES) results.push(await processCity(c, pulseMap[c.slug]))
await writeFile(resolve(DATA_DIR, '_index.json'), JSON.stringify({ verified_at: verifiedAt, today: TODAY, cities: results.map(r => ({ city: r.city, file: `${r.city.toLowerCase().replace(/\s+/g,'-')}.json` })) }, null, 2))
console.log('\nAll 6 city snapshots written to', DATA_DIR)
