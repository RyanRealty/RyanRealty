/**
 * Local accept: featured strip zeros drop when inventory is ranked.
 *
 *   npx tsx scripts/loop-accept-featured-plats-v13.ts
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import registry from '../data/resort-communities.json'
import { PUBLIC_ACTIVE_STATUSES } from '../lib/listing-status-public'
import { slugify } from '../lib/slug'
import {
  featuredPlatCount,
  publishFeaturedPlats,
  type FeaturedPlatSeed,
} from '../lib/market/publish-featured-plat-inventory'

config({ path: '.env.local' })

function isDisplayablePlatName(alias: string): boolean {
  const t = alias.trim()
  if (t.length < 6) return false
  if (/^[A-Za-z]{2,5}$/.test(t)) return false
  if (/^(drrh|oww|bbr|stoneth)/i.test(t)) return false
  return true
}

function childPlats(): FeaturedPlatSeed[] {
  const out: FeaturedPlatSeed[] = []
  const seen = new Set<string>()
  for (const r of registry.communities) {
    for (const alias of r.subdivision_aliases) {
      if (!isDisplayablePlatName(alias)) continue
      const slug = slugify(alias)
      const key = `${r.city_slug}:${slug}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({
        slug,
        name: alias,
        parent: r.label,
        parentSlug: r.slug,
        city: r.city,
        citySlug: r.city_slug,
      })
    }
  }
  return out
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) {
    console.error('UNREADABLE: Supabase env missing')
    process.exit(2)
  }
  const plats = childPlats()
  const sb = createClient(url, key)
  const names = [...new Set(plats.map((p) => p.name.toLowerCase().trim()))]
  const countByName = new Map<string, number>()
  for (let i = 0; i < names.length; i += 40) {
    const chunk = names.slice(i, i + 40)
    const { data, error } = await sb
      .from('listing_tile_mv')
      .select('listing_key, subdivision_lower')
      .in('subdivision_lower', chunk)
      .in('standard_status', PUBLIC_ACTIVE_STATUSES)
      .eq('property_type', 'A')
      .eq('property_sub_type', 'Single Family Residence')
      .limit(5000)
    if (error) {
      console.error('query failed', error.message)
      process.exit(1)
    }
    for (const row of data ?? []) {
      const name = String(row.subdivision_lower ?? '')
      countByName.set(name, (countByName.get(name) ?? 0) + 1)
    }
  }
  const countByKey = new Map(
    plats.map((p) => [ `${p.citySlug}:${p.slug}`, countByName.get(p.name.toLowerCase().trim()) ?? 0 ]),
  )
  const oldFirst: FeaturedPlatSeed[] = []
  const seenParent = new Set<string>()
  for (const p of plats) {
    if (seenParent.has(p.parentSlug)) continue
    seenParent.add(p.parentSlug)
    oldFirst.push(p)
    if (oldFirst.length >= 12) break
  }
  const featured = publishFeaturedPlats(plats, countByKey, { inventoryOk: true, cap: 12 })
  const oldZeros = oldFirst.filter((p) => featuredPlatCount(p, countByKey) === 0).length
  const newZeros = featured.filter((p) => featuredPlatCount(p, countByKey) === 0).length
  console.log(
    JSON.stringify(
      {
        oldFeatured: oldFirst.map((p) => ({ slug: p.slug, n: featuredPlatCount(p, countByKey) })),
        newFeatured: featured.map((p) => ({ slug: p.slug, n: featuredPlatCount(p, countByKey) })),
        oldZeros,
        newZeros,
      },
      null,
      2,
    ),
  )
  if (newZeros !== 0) {
    console.error('accept failed: featured strip still has zeros')
    process.exit(1)
  }
  if (oldZeros === 0) {
    console.error('accept failed: founding zeros did not reproduce on live inventory')
    process.exit(1)
  }
  console.log('accept ok')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
