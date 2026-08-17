#!/usr/bin/env node
/**
 * Local accept: alias-aware Tetherow count from the same tile set the
 * community page uses. Homepage / index overlay must print this number.
 *
 *   node scripts/accept-resort-index-figures.mjs
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import resortRegistry from '../data/resort-communities.json' with { type: 'json' }

config({ path: '.env.local' })

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
if (!url || !key) {
  console.error('UNREADABLE: Supabase env missing')
  process.exit(2)
}

const sb = createClient(url, key)
const PAGE = 1000

async function fetchCitySfr(city) {
  const byKey = new Map()
  for (let offset = 0; offset < 6000; offset += PAGE) {
    const { data, error } = await sb
      .from('listing_tile_mv')
      .select('listing_key,subdivision_name,property_type,list_price')
      .eq('city_lower', String(city).toLowerCase().trim())
      .in('standard_status', ['Active', 'Active Under Contract'])
      .eq('property_type', 'A')
      .range(offset, offset + PAGE - 1)
    if (error) throw new Error(error.message)
    const rows = data ?? []
    for (const row of rows) byKey.set(row.listing_key, row)
    if (rows.length < PAGE) break
  }
  return [...byKey.values()]
}

function aliasMatches(sub, prefix) {
  return sub === prefix || sub.startsWith(`${prefix} `)
}

const tetherow = resortRegistry.communities.find((c) => c.slug === 'tetherow')
const cities = new Set([tetherow.city, ...(tetherow.mls_cities ?? [])])
const tiles = (await Promise.all([...cities].map((c) => fetchCitySfr(c)))).flat()
const aliases = (tetherow.subdivision_aliases ?? [tetherow.label])
  .map((a) => a.toLowerCase().trim())
  .filter(Boolean)
  .sort((a, b) => b.length - a.length)

const matched = tiles.filter((t) => {
  const sub = String(t.subdivision_name ?? '').toLowerCase().trim()
  return aliases.some((a) => aliasMatches(sub, a))
})
const prices = matched.map((t) => Number(t.list_price)).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b)
const mid = Math.floor(prices.length / 2)
const median =
  prices.length === 0
    ? null
    : prices.length % 2
      ? prices[mid]
      : Math.round((prices[mid - 1] + prices[mid]) / 2)

const literal = tiles.filter((t) => String(t.subdivision_name ?? '').toLowerCase().trim() === 'tetherow')

const out = {
  fetchedAt: new Date().toISOString(),
  cities: [...cities],
  tileCount: tiles.length,
  aliasAwareCount: matched.length,
  aliasAwareMedian: median,
  literalNameCount: literal.length,
  classHolds: matched.length > literal.length,
}
console.log(JSON.stringify(out, null, 2))
if (matched.length <= literal.length) process.exit(1)
