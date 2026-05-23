/**
 * City metadata (description, hero image, boundary GeoJSON).
 *
 * Reads from the `cities` table. Lives behind the DAL boundary; callers
 * (cities.ts server actions, city detail pages) consume via @/lib/data.
 */

import { supabaseAnon } from '@/lib/data/client'

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

/** Lookup the city id by display name (case-insensitive). Used for legacy neighborhood joins. */
export async function getCityIdByName(name: string): Promise<string | null> {
  const sb = supabaseAnon()
  if (!sb) return null
  const { data } = await sb.from('cities').select('id').ilike('name', name).maybeSingle()
  return (data as { id?: string } | null)?.id ?? null
}
