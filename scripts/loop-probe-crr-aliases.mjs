/**
 * Live MLS SubdivisionName values for Crooked River Ranch inventory.
 * Per docs/DATABASE_FOR_AI_AGENTS.md §0: active community listings via listing_tile_mv.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) {
  console.error('UNREADABLE')
  process.exit(2)
}
const sb = createClient(url, key)

const { data, error } = await sb
  .from('listing_tile_mv')
  .select('listing_key,subdivision_name,subdivision_lower,city_lower,standard_status,property_type,property_sub_type,list_price')
  .eq('property_type', 'A')
  .in('standard_status', ['Active', 'Active Under Contract'])
  .or(
    [
      'subdivision_lower.eq.crooked river ranch',
      'subdivision_lower.like.crr%',
      'subdivision_lower.like.crooked river%',
    ].join(','),
  )
  .limit(2000)

if (error) {
  console.error(error)
  process.exit(1)
}

const bySub = new Map()
for (const row of data ?? []) {
  const key = `${row.subdivision_name ?? ''} | ${row.city_lower ?? ''}`
  const cur = bySub.get(key) ?? { n: 0, sfr: 0, prices: [] }
  cur.n += 1
  if ((row.property_sub_type ?? '') === 'Single Family Residence') cur.sfr += 1
  if (row.list_price != null) cur.prices.push(Number(row.list_price))
  bySub.set(key, cur)
}

const rows = [...bySub.entries()]
  .map(([k, v]) => ({
    key: k,
    n: v.n,
    sfr: v.sfr,
    min: v.prices.length ? Math.min(...v.prices) : null,
    max: v.prices.length ? Math.max(...v.prices) : null,
  }))
  .sort((a, b) => b.n - a.n)

console.log(JSON.stringify({ total: data?.length ?? 0, groups: rows }, null, 2))
