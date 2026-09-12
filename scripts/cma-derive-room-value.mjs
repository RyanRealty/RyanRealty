/**
 * WHAT IS ONE EXTRA BATHROOM WORTH IN THIS MARKET? Paired sales, not a rule of
 * thumb. This is the derivation behind lib/pricing/room-counts.ts — the reason
 * the room rule discloses a difference instead of pricing it (Matt 2026-09-10).
 *
 * Pairs two closed sales that are the same product, within 3% on size, closed
 * within six months of each other, and exactly one whole bath apart. Reports
 * the distribution of the $/sqft difference for the home with the extra bath.
 * Re-run it before citing the numbers anywhere (CLAUDE.md §0 rule 2).
 *
 *   node scripts/cma-derive-room-value.mjs             # pairs inside a city
 *   node scripts/cma-derive-room-value.mjs --subdivision  # inside one plat
 */
import 'dotenv/config'
import { createClient } from '@supabase/supabase-js'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const SAME_SUB = process.argv.includes('--subdivision')
const SIZE_BAND = 0.03
const MONTHS = 6
const SINCE = '2024-01-01'

function pct(a, p) {
  const s = [...a].sort((x, y) => x - y)
  const i = (s.length - 1) * p
  const lo = Math.floor(i)
  const hi = Math.ceil(i)
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (i - lo)
}

const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await sb
    .from('sale_pricing_facts')
    .select('listing_key, city_slug, subdivision_norm, sqft, beds, baths, close_price, close_date, close_ppsf')
    .gte('close_date', SINCE)
    .gt('close_price', 0)
    .gte('sqft', 600)
    .eq('product_class', 'detached')
    .order('close_date', { ascending: false })
    .order('listing_key', { ascending: false })
    .range(from, from + 999)
  if (error) {
    console.error(error.message)
    process.exit(1)
  }
  rows.push(...(data ?? []))
  if ((data ?? []).length < 1000 || rows.length >= 40000) break
}
console.log(`sale_pricing_facts, product_class='detached', close_date >= ${SINCE}: ${rows.length.toLocaleString()} rows`)

const buckets = new Map()
for (const r of rows) {
  if (SAME_SUB && !r.subdivision_norm) continue
  const key = SAME_SUB ? `${r.city_slug}|${r.subdivision_norm}` : String(r.city_slug)
  if (!buckets.has(key)) buckets.set(key, [])
  buckets.get(key).push(r)
}
const deltas = []
for (const [, list] of buckets) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i]
      const b = list[j]
      const sa = Number(a.sqft)
      const sbz = Number(b.sqft)
      if (!sa || !sbz) continue
      if (Math.abs(sa - sbz) / Math.max(sa, sbz) > SIZE_BAND) continue
      const months = Math.abs(new Date(a.close_date) - new Date(b.close_date)) / (1000 * 60 * 60 * 24 * 30.44)
      if (months > MONTHS) continue
      const fa = Math.floor(Number(a.baths) || 0)
      const fb = Math.floor(Number(b.baths) || 0)
      if (Math.abs(fa - fb) !== 1) continue
      const more = fa > fb ? a : b
      const fewer = fa > fb ? b : a
      const pa = Number(more.close_ppsf) || Number(more.close_price) / Number(more.sqft)
      const pb = Number(fewer.close_ppsf) || Number(fewer.close_price) / Number(fewer.sqft)
      if (!(pa > 0) || !(pb > 0)) continue
      deltas.push((pa - pb) / pb)
    }
  }
}
console.log(
  `pairing: ${SAME_SUB ? 'same subdivision' : 'same city'}, sqft within ${SIZE_BAND * 100}%, closed within ${MONTHS} months, bath floors exactly one apart`,
)
console.log(`pairs: ${deltas.length.toLocaleString()}`)
if (deltas.length === 0) process.exit(0)
console.log(`  median $/sqft difference for the EXTRA bath: ${(pct(deltas, 0.5) * 100).toFixed(1)}%`)
console.log(`  25th percentile: ${(pct(deltas, 0.25) * 100).toFixed(1)}%   75th percentile: ${(pct(deltas, 0.75) * 100).toFixed(1)}%`)
console.log(`  share of pairs where the extra bath sold for MORE per sqft: ${((deltas.filter((d) => d > 0).length / deltas.length) * 100).toFixed(1)}%`)
