/**
 * Neighborhood metadata (boundary, hero image, SEO fields).
 *
 * Reads from the `neighborhoods` table. Lives behind the DAL boundary.
 */

import { unstable_cache } from 'next/cache'
import { supabaseAnon } from '@/lib/data/client'

export type NeighborhoodLite = { id: string; name: string; slug: string }

export type NeighborhoodFull = NeighborhoodLite & {
  description?: string | null
  hero_image_url?: string | null
  boundary_geojson?: unknown
  seo_title?: string | null
  seo_description?: string | null
}

/** All neighborhoods in a city. */
export async function getNeighborhoodsByCityId(cityId: string): Promise<NeighborhoodLite[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb.from('neighborhoods').select('id, name, slug').eq('city_id', cityId)
  return (data ?? []) as NeighborhoodLite[]
}

/** A neighborhood row by (city_id, slug). */
export async function getNeighborhoodBySlugInCity(
  cityId: string,
  neighborhoodSlug: string
): Promise<NeighborhoodFull | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('neighborhoods')
    .select('id, name, slug, description, hero_image_url, boundary_geojson, seo_title, seo_description')
    .eq('city_id', cityId)
    .ilike('slug', neighborhoodSlug)
    .maybeSingle()
  return (data ?? null) as NeighborhoodFull | null
}

export type NeighborhoodDirectoryRow = {
  neighborhoodName: string
  neighborhoodSlug: string
  cityName: string
  citySlug: string
}

/**
 * Every neighborhood flattened with its city, cached for an hour.
 *
 * Replaces the per-keystroke `name ILIKE '%<q>%'` search the autocomplete used
 * to run (searchNeighborhoodsByName). That query could only match the exact
 * spacing a buyer happened to type — "RiverWest" found nothing. The table is
 * tiny (13 rows) and rarely changes, so one cached read serves every keystroke
 * and the match itself runs in memory via lib/search/neighborhood-match.
 *
 * Rows missing a name, slug, or city join are dropped: a suggestion without
 * both slugs cannot build a working /cities/<city>/<neighborhood> href.
 */
export const getNeighborhoodDirectory = unstable_cache(
  async (): Promise<NeighborhoodDirectoryRow[]> => {
    const rows = await getAllNeighborhoodsWithCity()
    const out: NeighborhoodDirectoryRow[] = []
    for (const r of rows) {
      const city = Array.isArray(r.cities) ? r.cities[0] : r.cities
      const neighborhoodName = (r.name ?? '').trim()
      const neighborhoodSlug = (r.slug ?? '').trim()
      const cityName = (city?.name ?? '').trim()
      const citySlug = (city?.slug ?? '').trim()
      if (!neighborhoodName || !neighborhoodSlug || !cityName || !citySlug) continue
      out.push({ neighborhoodName, neighborhoodSlug, cityName, citySlug })
    }
    return out
  },
  ['neighborhood-directory-v1'],
  // Matches the sibling city-neighborhood slug map in app/actions/listings.ts:
  // same table, same 1h window, same 'neighborhoods' invalidation tag.
  { revalidate: 3600, tags: ['neighborhoods'] }
)

/** All neighborhoods with embedded city (name + slug) join — used by content refresh. */
export async function getAllNeighborhoodsWithCity(): Promise<
  Array<{
    id: string
    name: string
    slug: string
    city_id: string
    cities?: { name: string; slug: string } | { name: string; slug: string }[] | null
  }>
> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('neighborhoods')
    .select('id, name, slug, city_id, cities(name, slug)')
    .order('name')
  return (data ?? []) as Array<{
    id: string
    name: string
    slug: string
    city_id: string
    cities?: { name: string; slug: string } | { name: string; slug: string }[] | null
  }>
}

/** Patch a neighborhood row by id (admin content refresh). */
export async function updateNeighborhoodById(
  id: string,
  updates: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseAnon()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('neighborhoods').update(updates).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** A single neighborhood's name by id (used by adjacency mappers). */
export async function getNeighborhoodNameById(id: string): Promise<string | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb.from('neighborhoods').select('name').eq('id', id).maybeSingle()
  return (data as { name?: string } | null)?.name ?? null
}
