#!/usr/bin/env node
/**
 * eda-co-closed.mjs — reusable Central Oregon closed-sales EDA
 *
 * Methodology (must match analytics marts + EDA_FINDINGS):
 *   closed: StandardStatus ILIKE %Closed%, ClosePrice >= 1000, CloseDate set
 *   geo: City in CENTRAL_OREGON proper-case (lib/central-oregon slugs)
 *
 * Usage:
 *   node scripts/analytics/eda-co-closed.mjs
 *   node scripts/analytics/eda-co-closed.mjs --year 2024
 *   node scripts/analytics/eda-co-closed.mjs --year 2024 --out docs/plans/seo-voice/EDA_out.json
 */
import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
config({ path: join(ROOT, '.env.local') })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('Need NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const SLUGS = [
  'bend', 'redmond', 'sisters', 'sunriver', 'la-pine', 'tumalo', 'terrebonne',
  'black-butte-ranch', 'camp-sherman', 'brothers', 'alfalfa',
  'madras', 'culver', 'metolius', 'warm-springs', 'gateway', 'ashwood',
  'crooked-river', 'crooked-river-ranch',
  'prineville', 'powell-butte', 'paulina', 'post', 'mitchell',
]
function proper(slug) {
  return slug.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}
const CITIES = SLUGS.map(proper)

const args = process.argv.slice(2)
const yearArg = args.includes('--year') ? args[args.indexOf('--year') + 1] : '2024'
const outArg = args.includes('--out')
  ? args[args.indexOf('--out') + 1]
  : join(ROOT, `docs/plans/seo-voice/EDA_CO_${yearArg}_latest.json`)

const h = { apikey: key, Authorization: `Bearer ${key}` }
const cityIn = `City=in.(${CITIES.map((c) => `"${c}"`).join(',')})`
const baseClosed = `StandardStatus=ilike.*Closed*&ClosePrice=gte.1000&CloseDate=not.is.null`

async function count(params) {
  const r = await fetch(`${url}/rest/v1/listings?select=ListingKey&${params}&limit=1`, {
    headers: { ...h, Prefer: 'count=exact' },
  })
  const cr = r.headers.get('content-range') || ''
  const m = cr.match(/\/(\d+)/)
  return m ? Number(m[1]) : 0
}

async function fetchYear(year) {
  const rows = []
  let from = 0
  const page = 1000
  const dateF = `CloseDate=gte.${year}-01-01&CloseDate=lte.${year}-12-31`
  for (;;) {
    const to = from + page - 1
    const r = await fetch(
      `${url}/rest/v1/listings?select=ClosePrice,City,PropertyType,ListOfficeName,ListAgentName,buyer_office_name,buyer_agent_name,list_agent_mls_id,buyer_agent_mls_id,fireplace_yn&${baseClosed}&${cityIn}&${dateF}&order=ListingKey`,
      { headers: { ...h, Range: `${from}-${to}`, Prefer: 'count=exact' } },
    )
    const batch = await r.json()
    if (!Array.isArray(batch) || batch.length === 0) break
    rows.push(...batch)
    if (batch.length < page) break
    from += page
    if (from > 100000) break
  }
  return rows
}

function summarize(rows) {
  let vol = 0
  const types = {}
  const cities = {}
  const officesList = {}
  const officesBuy = {}
  let dualO = 0
  let dualA = 0
  const prices = []
  for (const row of rows) {
    const p = Number(row.ClosePrice) || 0
    vol += p
    prices.push(p)
    const t = row.PropertyType || 'null'
    types[t] = (types[t] || 0) + 1
    const c = row.City || '(null)'
    if (!cities[c]) cities[c] = { n: 0, vol: 0 }
    cities[c].n++
    cities[c].vol += p
    const lo = (row.ListOfficeName || '(null)').trim()
    if (!officesList[lo]) officesList[lo] = { n: 0, vol: 0 }
    officesList[lo].n++
    officesList[lo].vol += p
    const bo = (row.buyer_office_name || '(null)').trim()
    if (!officesBuy[bo]) officesBuy[bo] = { n: 0, vol: 0 }
    officesBuy[bo].n++
    officesBuy[bo].vol += p
    if (lo.toLowerCase() === bo.toLowerCase()) dualO++
    if (
      (row.ListAgentName || '').trim().toLowerCase() ===
      (row.buyer_agent_name || '').trim().toLowerCase()
    ) {
      dualA++
    }
  }
  prices.sort((a, b) => a - b)
  const pct = (p) => {
    if (!prices.length) return null
    const i = (prices.length - 1) * p
    const lo = Math.floor(i)
    const hi = Math.ceil(i)
    return lo === hi ? prices[lo] : prices[lo] + (prices[hi] - prices[lo]) * (i - lo)
  }
  const rank = (obj) =>
    Object.entries(obj)
      .map(([office, v]) => ({
        office,
        ...v,
        share_vol_pct: vol ? +(100 * v.vol / vol).toFixed(2) : 0,
        share_n_pct: rows.length ? +(100 * v.n / rows.length).toFixed(2) : 0,
      }))
      .sort((a, b) => b.vol - a.vol)

  return {
    n: rows.length,
    volume: vol,
    types,
    top_cities: Object.entries(cities)
      .map(([city, v]) => ({ city, ...v }))
      .sort((a, b) => b.vol - a.vol),
    top_list_offices: rank(officesList).slice(0, 50),
    top_buy_offices: rank(officesBuy).slice(0, 50),
    dual_office_pct: rows.length ? +(100 * dualO / rows.length).toFixed(2) : 0,
    dual_agent_pct: rows.length ? +(100 * dualA / rows.length).toFixed(2) : 0,
    price: {
      p10: pct(0.1),
      p25: pct(0.25),
      p50: pct(0.5),
      p75: pct(0.75),
      p90: pct(0.9),
      p99: pct(0.99),
      min: prices[0] ?? null,
      max: prices[prices.length - 1] ?? null,
    },
    ryan_list: rank(officesList).filter((o) => /ryan/i.test(o.office)),
  }
}

const year = yearArg
const report = {
  generated_at: new Date().toISOString(),
  methodology: {
    closed: 'Closed + ClosePrice>=1000 + CloseDate set',
    geo: 'CENTRAL_OREGON_CITY_SLUGS proper-case',
    cities: CITIES,
    year,
  },
  probes: {
    closed_priced_all_feed: await count(baseClosed),
    closed_priced_service_area: await count(`${baseClosed}&${cityIn}`),
    closed_year_co: await count(
      `${baseClosed}&${cityIn}&CloseDate=gte.${year}-01-01&CloseDate=lte.${year}-12-31`,
    ),
  },
}

console.log('Fetching rows…')
const rows = await fetchYear(year)
report.probes.rows_fetched = rows.length
report.summary = summarize(rows)

writeFileSync(outArg, JSON.stringify(report, null, 2))
console.log(JSON.stringify({
  out: outArg,
  n: report.summary.n,
  volume: report.summary.volume,
  p50: report.summary.price.p50,
  top3_list: report.summary.top_list_offices.slice(0, 3),
  top3_buy: report.summary.top_buy_offices.slice(0, 3),
  dual: { o: report.summary.dual_office_pct, a: report.summary.dual_agent_pct },
  ryan: report.summary.ryan_list,
}, null, 2))
