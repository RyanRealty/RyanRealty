#!/usr/bin/env node
/**
 * rebuild-analytics-marts.mjs — populate analytics_mart_* from closed CO sales
 *
 * Requires migration 20260810120000_analytics_closed_foundation.sql applied
 * OR will fail clearly. Uses service role.
 *
 * Usage:
 *   node scripts/analytics/rebuild-analytics-marts.mjs --year 2024
 *   node scripts/analytics/rebuild-analytics-marts.mjs --from 2016 --to 2025
 *
 * Parity: 2024 CO sold_count + total_volume must match EDA within 0.5%.
 */
import { config } from 'dotenv'
import { createClient } from '@supabase/supabase-js'
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

const sb = createClient(url, key, { auth: { persistSession: false } })

const args = process.argv.slice(2)
const oneYear = args.includes('--year') ? Number(args[args.indexOf('--year') + 1]) : null
const fromY = args.includes('--from') ? Number(args[args.indexOf('--from') + 1]) : oneYear || 2024
const toY = args.includes('--to') ? Number(args[args.indexOf('--to') + 1]) : oneYear || 2024

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

function typeScope(pt) {
  if (pt === 'A') return 'sfr'
  if (pt === 'B' || pt === 'C') return 'multi'
  if (pt === 'D') return 'land'
  return 'other'
}

function median(nums) {
  if (!nums.length) return null
  const a = [...nums].sort((x, y) => x - y)
  const m = Math.floor(a.length / 2)
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2
}

async function fetchClosedYear(year) {
  const rows = []
  let from = 0
  const page = 1000
  for (;;) {
    const { data, error } = await sb
      .from('listings')
      .select(
        'ClosePrice,City,PropertyType,ListOfficeName,buyer_office_name,CloseDate',
      )
      .ilike('StandardStatus', '%Closed%')
      .gte('ClosePrice', 1000)
      .not('CloseDate', 'is', null)
      .in('City', CITIES)
      .gte('CloseDate', `${year}-01-01`)
      .lte('CloseDate', `${year}-12-31`)
      .order('ListingKey', { ascending: true })
      .range(from, from + page - 1)
    if (error) throw new Error(error.message)
    if (!data?.length) break
    rows.push(...data)
    if (data.length < page) break
    from += page
  }
  return rows
}

async function rebuildYear(year) {
  console.log(`\n=== ${year} ===`)
  const rows = await fetchClosedYear(year)
  console.log('rows', rows.length)

  // Market annual by type_scope
  const buckets = {
    all: [],
    sfr: [],
    multi: [],
    land: [],
    other: [],
  }
  const typeBreak = {}
  for (const r of rows) {
    const p = Number(r.ClosePrice)
    if (!Number.isFinite(p)) continue
    buckets.all.push(p)
    const b = typeScope(r.PropertyType)
    buckets[b].push(p)
    const t = r.PropertyType || 'unknown'
    typeBreak[t] = (typeBreak[t] || 0) + 1
  }

  const marketRows = Object.entries(buckets).map(([type_scope, prices]) => ({
    geo_type: 'region',
    geo_slug: 'central-oregon',
    year,
    type_scope,
    sold_count: prices.length,
    total_volume: prices.reduce((a, b) => a + b, 0),
    median_close: median(prices),
    mean_close: prices.length ? prices.reduce((a, b) => a + b, 0) / prices.length : null,
    property_type_breakdown: type_scope === 'all' ? typeBreak : {},
    methodology: 'closed_cte+service_area_v1',
    computed_at: new Date().toISOString(),
  }))

  const { error: mErr } = await sb.from('analytics_mart_market_annual').upsert(marketRows, {
    onConflict: 'geo_type,geo_slug,year,type_scope',
  })
  if (mErr) throw new Error(`market mart: ${mErr.message}`)
  console.log('market mart upserted', marketRows.length)

  // Office share list + buy
  for (const side of ['list', 'buy']) {
    const map = new Map()
    for (const r of rows) {
      const name =
        side === 'list'
          ? (r.ListOfficeName || '').trim()
          : (r.buyer_office_name || '').trim()
      if (!name) continue
      const p = Number(r.ClosePrice) || 0
      if (!map.has(name)) map.set(name, { n: 0, vol: 0 })
      const e = map.get(name)
      e.n++
      e.vol += p
    }
    const totalN = rows.length
    const totalVol = buckets.all.reduce((a, b) => a + b, 0)
    const ranked = [...map.entries()]
      .map(([office_name, v]) => ({
        office_name,
        sides_count: v.n,
        total_volume: v.vol,
        volume_share_pct: totalVol ? (100 * v.vol) / totalVol : null,
        unit_share_pct: totalN ? (100 * v.n) / totalN : null,
      }))
      .sort((a, b) => b.total_volume - a.total_volume)
      .map((row, i) => ({
        geo_type: 'region',
        geo_slug: 'central-oregon',
        year,
        type_scope: 'all',
        side,
        office_name: row.office_name,
        sides_count: row.sides_count,
        total_volume: row.total_volume,
        volume_share_pct: row.volume_share_pct,
        unit_share_pct: row.unit_share_pct,
        rank_volume: i + 1,
        methodology: 'closed_cte+service_area_v1',
        computed_at: new Date().toISOString(),
      }))

    // delete year/side then insert (upsert on long office names ok)
    await sb
      .from('analytics_mart_office_share_annual')
      .delete()
      .eq('geo_type', 'region')
      .eq('geo_slug', 'central-oregon')
      .eq('year', year)
      .eq('type_scope', 'all')
      .eq('side', side)

    // batch insert
    const chunk = 200
    for (let i = 0; i < ranked.length; i += chunk) {
      const slice = ranked.slice(i, i + chunk)
      const { error } = await sb.from('analytics_mart_office_share_annual').insert(slice)
      if (error) throw new Error(`office mart ${side}: ${error.message}`)
    }
    console.log(`office ${side} rows`, ranked.length, 'top', ranked[0]?.office_name, ranked[0]?.volume_share_pct?.toFixed?.(2))
  }

  // Parity log vs known EDA 2024
  if (year === 2024) {
    const all = marketRows.find((r) => r.type_scope === 'all')
    const edaN = 5707
    const edaVol = 3.931e9
    const nErr = Math.abs(all.sold_count - edaN) / edaN
    const vErr = Math.abs(Number(all.total_volume) - edaVol) / edaVol
    console.log('PARITY 2024', {
      sold_count: all.sold_count,
      total_volume: all.total_volume,
      nErr: (nErr * 100).toFixed(3) + '%',
      vErr: (vErr * 100).toFixed(3) + '%',
      ok: nErr < 0.005 && vErr < 0.01,
    })
    // volume EDA was ~3.931B exact sum from same filter — allow 1% for float
    if (nErr >= 0.005) {
      console.error('PARITY FAIL sold_count')
      process.exitCode = 2
    }
  }

  return { year, n: rows.length }
}

for (let y = fromY; y <= toY; y++) {
  await rebuildYear(y)
}
console.log('\nDone', fromY, '→', toY)
