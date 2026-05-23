/**
 * Read wide listing rows (PascalCase + media fields) for the video-tile
 * pipeline. Reads from `listings` directly inside the DAL boundary because
 * the materialized view doesn't carry the `details` JSON used to extract
 * video URLs.
 *
 * Three modes:
 *  1. `withVirtualTour: true` — only rows with `has_virtual_tour = true`
 *  2. `cityFilter` — broad query (newest or price-desc) for one+ cities
 *  3. `byKeys` — bulk fetch by ListingKey IN [...]
 */

import { supabaseAnon } from '@/lib/data/client'
import { LISTING_VIDEO_SELECT_MAIN } from '@/lib/video-tours-listing-videos-join'

const ACTIVE_STATUS_OR =
  'StandardStatus.is.null,StandardStatus.ilike.%Active%,StandardStatus.ilike.%For Sale%,StandardStatus.ilike.%Coming Soon%'

export type ListingVideoCandidateRow = Record<string, unknown>

export type GetListingVideoCandidatesOptions = {
  withVirtualTour?: boolean
  cities?: string[] | null
  statusAll?: boolean
  sort?: 'newest' | 'price_desc'
  limit?: number
  byKeys?: string[]
}

export async function getListingVideoCandidates(
  options: GetListingVideoCandidatesOptions
): Promise<ListingVideoCandidateRow[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const limit = Math.min(Math.max(options.limit ?? 200, 1), 5000)
  let query = sb.from('listings').select(LISTING_VIDEO_SELECT_MAIN)

  if (options.withVirtualTour === true) {
    query = query.eq('has_virtual_tour', true)
  }
  if (options.byKeys && options.byKeys.length > 0) {
    query = query.in('ListingKey', options.byKeys.slice(0, 5000))
  } else {
    if (options.cities && options.cities.length > 0) {
      query = query.in('City', options.cities)
    }
    if (!options.statusAll) {
      query = query.or(ACTIVE_STATUS_OR)
    }
    if (options.sort === 'price_desc') {
      query = query.order('ListPrice', { ascending: false, nullsFirst: false })
    } else {
      query = query.order('ModificationTimestamp', { ascending: false, nullsFirst: false })
    }
  }
  query = query.limit(limit)
  const { data, error } = await query
  if (error) return []
  return (data ?? []) as ListingVideoCandidateRow[]
}
