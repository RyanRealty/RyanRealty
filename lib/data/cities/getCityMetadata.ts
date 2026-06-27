/**
 * City metadata (description, hero image, boundary GeoJSON).
 *
 * Reads from the `cities` table. Lives behind the DAL boundary; callers
 * (cities.ts server actions, city detail pages) consume via @/lib/data.
 */

import { supabaseAnon } from '@/lib/data/client'
import { createServiceClient } from '@/lib/supabase/service'

export type CityMetadata = {
  name: string
  slug?: string | null
  description: string | null
  hero_image_url: string | null
}

/** Batch lookup by city display names (case-sensitive `in` against `name`). */
export async function getCityMetadataByNames(names: string[]): Promise<Map<string, CityMetadata>> {
  const sb = supabaseAnon()
  if (!sb || names.length === 0) return new Map()
  const { data } = await sb
    .from('cities')
    .select('name, description, hero_image_url')
    .in('name', names)
  const out = new Map<string, CityMetadata>()
  for (const row of (data ?? []) as CityMetadata[]) {
    if (row.name) out.set(row.name.toLowerCase(), row)
  }
  return out
}

/** Single city metadata lookup (case-insensitive by name). */
export async function getCityMetadataByName(name: string): Promise<CityMetadata | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('cities')
    .select('name, slug, description, hero_image_url')
    .ilike('name', name)
    .maybeSingle()
  return (data ?? null) as CityMetadata | null
}

/** Boundary GeoJSON for a city (map overlay). */
export async function getCityBoundaryGeoJSON(name: string): Promise<unknown | null> {
  const sb = supabaseAnon()
  if (!sb || !name?.trim()) return null
  const { data } = await sb
    .from('cities')
    .select('boundary_geojson')
    .ilike('name', name.trim())
    .maybeSingle()
  return (data as { boundary_geojson?: unknown } | null)?.boundary_geojson ?? null
}

/** All cities with hero media for admin-upload UI. */
export async function getAllCitiesForAdminUpload(): Promise<Array<{
  id: string
  name: string
  slug: string
  hero_image_url: string | null
  hero_video_url: string | null
}>> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb.from('cities').select('id, name, slug, hero_image_url, hero_video_url')
  return (data ?? []) as Array<{
    id: string
    name: string
    slug: string
    hero_image_url: string | null
    hero_video_url: string | null
  }>
}

/** All neighborhoods with hero media for admin-upload UI. */
export async function getAllNeighborhoodsForAdminUpload(): Promise<Array<{
  id: string
  name: string
  slug: string
  hero_image_url: string | null
  city_id: string | null
}>> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb.from('neighborhoods').select('id, name, slug, hero_image_url, city_id')
  return (data ?? []) as Array<{
    id: string
    name: string
    slug: string
    hero_image_url: string | null
    city_id: string | null
  }>
}

/** All communities with hero media for admin-upload UI. */
export async function getAllCommunitiesForAdminUpload(): Promise<Array<{
  id: string
  name: string
  slug: string
  hero_image_url: string | null
  hero_video_url: string | null
}>> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb.from('communities').select('id, name, slug, hero_image_url, hero_video_url')
  return (data ?? []) as Array<{
    id: string
    name: string
    slug: string
    hero_image_url: string | null
    hero_video_url: string | null
  }>
}

/** Generic update of a hero-bearing entity row by id (cities | neighborhoods | communities).
 * P0-2 fix: uses service-role client so is_super_admin() RLS policies pass for admin writes.
 */
export async function updateHeroEntityById(
  table: 'cities' | 'neighborhoods' | 'communities',
  id: string,
  updates: Record<string, string>
): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient()
  const { error } = await sb.from(table).update(updates).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert a new city / neighborhood / community row from area-guide upload.
 * P0-2 fix: uses service-role client so is_super_admin() RLS policies pass for admin writes.
 */
export async function insertHeroEntityRow(
  table: 'cities' | 'neighborhoods' | 'communities',
  row: Record<string, unknown>
): Promise<{ id: string; name: string; slug: string } | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from(table)
    .insert(row)
    .select('id, name, slug')
    .single()
  if (error || !data) return null
  return data as { id: string; name: string; slug: string }
}

/** page_images CRUD helpers used by area-guide upload. */
export async function getPageImageUrlsForPage(
  pageType: string,
  pageId: string
): Promise<string[]> {
  // Read-only; anon client is fine here (page_images readable without admin role).
  const sb = supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('page_images')
    .select('image_url')
    .eq('page_type', pageType)
    .eq('page_id', pageId)
  return ((data ?? []) as Array<{ image_url?: string }>)
    .map((r) => r.image_url ?? '')
    .filter(Boolean)
}

/** P0-2 fix: uses service-role client so is_super_admin() RLS policies pass for admin writes. */
export async function insertPageImageRow(row: {
  page_type: string
  page_id: string
  image_url: string
  source: string
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient()
  const { error } = await sb.from('page_images').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Patch a city row by id (admin content refresh). */
export async function updateCityById(
  id: string,
  updates: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = supabaseAnon()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('cities').update(updates).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Lookup the city id by display name (case-insensitive). Used for legacy neighborhood joins. */
export async function getCityIdByName(name: string): Promise<string | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb.from('cities').select('id').ilike('name', name).maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}
