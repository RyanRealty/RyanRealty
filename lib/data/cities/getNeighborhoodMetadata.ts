/**
 * Neighborhood metadata (boundary, hero image, SEO fields).
 *
 * Reads from the `neighborhoods` table. Lives behind the DAL boundary.
 */

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
