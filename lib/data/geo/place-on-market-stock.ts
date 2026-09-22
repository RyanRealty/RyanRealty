/**
 * Every publicly active listing inside a recorded boundary, and the
 * property-type mix of each child plat.
 *
 * The map RPC `listings_in_boundary` stops at a few hundred rows and keeps
 * only Active residential types. These reads page `listing_boundary_xref_mv`
 * for Active and Active Under Contract, every property type. Coming Soon
 * stays out (PUBLIC_ACTIVE_STATUSES).
 */
import { supabaseAnon } from '@/lib/data/client'
import { PUBLIC_ACTIVE_STATUSES } from '@/lib/listing-status-public'
import { fetchPagedRows } from '@/lib/supabase/paginate'

export type PlaceBoundaryGeoType = 'city' | 'subdivision' | 'neighborhood'

export type SubdivisionOnMarketRow = {
  listing_key: string
  geo_slug: string
  property_type: string | null
  property_sub_type: string | null
}

const MAX_KEYS = 8000
const MAX_CHILD_ROWS = 8000

export async function getBoundaryOnMarketKeys(
  geoType: PlaceBoundaryGeoType,
  geoSlug: string,
): Promise<string[]> {
  const slug = geoSlug.trim()
  if (!slug) return []
  const sb = supabaseAnon()
  if (!sb) return []

  const { rows, error } = await fetchPagedRows<{ listing_key: string | null }>(
    (from, to) =>
      sb
        .from('listing_boundary_xref_mv')
        .select('listing_key')
        .eq('geo_type', geoType)
        .eq('geo_slug', slug)
        .in('standard_status', PUBLIC_ACTIVE_STATUSES)
        .order('listing_key', { ascending: true })
        .range(from, to),
    MAX_KEYS,
  )
  if (error) {
    throw new Error(
      `[getBoundaryOnMarketKeys] ${geoType}/${slug}: ${error.message}`,
    )
  }

  const seen = new Set<string>()
  const keys: string[] = []
  for (const row of rows) {
    const key = row.listing_key?.trim()
    if (!key || seen.has(key)) continue
    seen.add(key)
    keys.push(key)
  }
  return keys
}

export async function getBoundaryChildRows(
  geoType: 'subdivision' | 'neighborhood',
  geoSlugs: readonly string[],
): Promise<SubdivisionOnMarketRow[]> {
  const slugs = [...new Set(geoSlugs.map((slug) => slug.trim()).filter(Boolean))]
  if (slugs.length === 0) return []
  const sb = supabaseAnon()
  if (!sb) return []

  const { rows, error } = await fetchPagedRows<SubdivisionOnMarketRow>(
    (from, to) =>
      sb
        .from('listing_boundary_xref_mv')
        .select('listing_key, geo_slug, property_type, property_sub_type')
        .eq('geo_type', geoType)
        .in('geo_slug', slugs)
        .in('standard_status', PUBLIC_ACTIVE_STATUSES)
        .order('listing_key', { ascending: true })
        .range(from, to),
    MAX_CHILD_ROWS,
  )
  if (error) {
    throw new Error(`[getBoundaryChildRows] ${geoType}: ${error.message}`)
  }
  return rows.filter((row) => row.listing_key?.trim() && row.geo_slug?.trim())
}

export async function getSubdivisionOnMarketRows(
  geoSlugs: readonly string[],
): Promise<SubdivisionOnMarketRow[]> {
  return getBoundaryChildRows('subdivision', geoSlugs)
}
