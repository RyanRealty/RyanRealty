/**
 * getListingsByBuilder — active SFR homes sharing the same MLS BuilderName.
 * Reads listings.details->>'BuilderName' (exact match after trim).
 * For the listing-detail “More by this builder” explore rail.
 */

import { z } from 'zod'
import { supabaseAnon } from '@/lib/data/client'
import { getListingTiles } from '@/lib/data/listings/getListingTiles'
import type { ListingTile } from '@/lib/data/types/listing'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'

const InputSchema = z.object({
  builderName: z.string().min(1).max(120),
  city: z.string().min(1).max(80).optional(),
  excludeKey: z.string().min(1).max(100).optional(),
  limit: z.number().int().min(1).max(24).default(12),
})

async function fetchByBuilder(
  builderName: string,
  city: string | undefined,
  excludeKey: string | undefined,
  limit: number,
): Promise<ListingTile[]> {
  const sb = supabaseAnon()
  if (!sb) return []

  // Cap key fetch then hydrate via tile MV for photos/coords.
  // toast-ok: explore rail only — Active SFR + exact BuilderName + hard limit 40 keys (not a browse surface; chain starts on next line)
  let q = sb
    .from('listings')
    .select('ListingKey')
    .eq('StandardStatus', 'Active')
    .eq('PropertyType', 'A')
    .filter('details->>BuilderName', 'eq', builderName)
    .limit(Math.min(limit + 4, 40))

  if (city) q = q.ilike('City', city)

  const { data, error } = await q
  if (error) throw new Error(`[getListingsByBuilder] ${error.message}`)
  const keys = (data ?? [])
    .map((r) => (r as { ListingKey: string }).ListingKey)
    .filter((k) => k && k !== excludeKey)
    .slice(0, limit)
  if (keys.length === 0) return []
  return getListingTiles({ listingKeys: keys, status: 'active', propertyType: 'A', limit: keys.length })
}

const cached = makeResilientCached(
  fetchByBuilder,
  ['listings-by-builder-v1'],
  { revalidate: CACHE_WINDOWS.listingTile, tags: [cacheTag.listings] },
  [],
)

export function getListingsByBuilder(input: {
  builderName: string
  city?: string | null
  excludeKey?: string | null
  limit?: number
}): Promise<ListingTile[]> {
  const parsed = InputSchema.parse({
    builderName: input.builderName.trim(),
    city: input.city?.trim() || undefined,
    excludeKey: input.excludeKey || undefined,
    limit: input.limit ?? 12,
  })
  return cached(parsed.builderName, parsed.city, parsed.excludeKey, parsed.limit)
}
