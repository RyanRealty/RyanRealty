/**
 * Slim listings lookup for /listing/by-key → pretty-URL redirect.
 *
 * Selects ONLY the columns listingDetailPath needs. Do not use
 * getListingRawRowByKey / getListingDetail here — those pull photos,
 * agents, remarks, and the rest of the wide row for a hop that never
 * renders them.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { resolveCanonicalListingKey } from './resolveCanonicalListingKey'

const PATH_SELECT = [
  'ListingKey',
  'ListNumber',
  'StreetNumber',
  'StreetName',
  'City',
  'State',
  'PostalCode',
  'SubdivisionName',
  'boundary_city',
  'boundary_neighborhood',
  'boundary_subdivision',
].join(', ')

export type ListingCanonicalPathFields = {
  ListingKey: string
  ListNumber: string | null
  StreetNumber: string | null
  StreetName: string | null
  City: string | null
  State: string | null
  PostalCode: string | null
  SubdivisionName: string | null
  boundary_city: string | null
  boundary_neighborhood: string | null
  boundary_subdivision: string | null
}

function asNullableString(value: unknown): string | null {
  if (value == null) return null
  const s = String(value).trim()
  return s ? s : null
}

function mapRow(row: Record<string, unknown>): ListingCanonicalPathFields | null {
  const listingKey = asNullableString(row.ListingKey)
  if (!listingKey) return null
  return {
    ListingKey: listingKey,
    ListNumber: asNullableString(row.ListNumber),
    StreetNumber: asNullableString(row.StreetNumber),
    StreetName: asNullableString(row.StreetName),
    City: asNullableString(row.City),
    State: asNullableString(row.State),
    PostalCode: asNullableString(row.PostalCode),
    SubdivisionName: asNullableString(row.SubdivisionName),
    boundary_city: asNullableString(row.boundary_city),
    boundary_neighborhood: asNullableString(row.boundary_neighborhood),
    boundary_subdivision: asNullableString(row.boundary_subdivision),
  }
}

async function fetchPathFields(listingKey: string): Promise<ListingCanonicalPathFields | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  // @canonical-key — listingKey is already resolveCanonicalListingKey output.
  const { data, error } = await sb.from('listings').select(PATH_SELECT).eq('ListingKey', listingKey).maybeSingle()
  if (error) throw error
  if (!data || typeof data !== 'object') return null // poison-null-ok — genuine miss
  return mapRow(data as Record<string, unknown>)
}

/** Resolve ListNumber or ListingKey, then return path fields only. */
export async function getListingCanonicalPathFields(
  key: string
): Promise<ListingCanonicalPathFields | null> {
  const trimmed = String(key ?? '').trim()
  if (!trimmed) return null
  const listingKey = await resolveCanonicalListingKey(trimmed)
  if (!listingKey) return null
  return unstable_cache(
    () => fetchPathFields(listingKey),
    ['listing-canonical-path-fields-v1', listingKey],
    { revalidate: CACHE_WINDOWS.listingDetail, tags: [cacheTag.listings] }
  )()
}
