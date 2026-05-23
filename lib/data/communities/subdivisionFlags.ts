/**
 * Subdivision flag + community-row CRUD.
 *
 * Owns every read + write against `subdivision_flags` and `communities`.
 * Lives inside lib/data/ so the DAL boundary allows it.
 *
 * Public LP routes consume `getResortEntityKeysFromFlags` to render resort
 * pills; the admin resort-communities page consumes `setSubdivisionResort`
 * and `seedResortCommunitiesFromDefaultList`.
 */

import { supabaseAnon } from '@/lib/data/client'
import { createServiceClient } from '@/lib/supabase/service'

function adminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

/** Set of entity_key values flagged as resort communities. */
export async function getResortEntityKeysFromFlags(): Promise<Set<string>> {
  // Service role preferred (admin contexts); fall back to anon.
  const admin = adminClient()
  const sb = admin ?? supabaseAnon()
  if (!sb) return new Set()
  const { data } = await sb.from('subdivision_flags').select('entity_key').eq('is_resort', true)
  return new Set((data ?? []).map((r: { entity_key: string }) => r.entity_key))
}

export type CommunityRowForBackfill = {
  id: string
  hero_image_url?: string | null
  resort_content?: unknown
}

/** Look up the existing communities row by slug. */
export async function findCommunityBySlug(slug: string): Promise<CommunityRowForBackfill | null> {
  const sb = adminClient()
  if (!sb) return null
  const { data } = await sb
    .from('communities')
    .select('id, hero_image_url, resort_content')
    .eq('slug', slug)
    .maybeSingle()
  return (data ?? null) as CommunityRowForBackfill | null
}

/** Upsert / update a community row. */
export async function updateCommunityRowById(
  id: string,
  updates: Record<string, unknown>
): Promise<{ ok: boolean; error?: string }> {
  const sb = adminClient()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('communities').update(updates).eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Insert a new community row. */
export async function insertCommunityRow(row: {
  name: string
  slug: string
  is_resort: boolean
  hero_image_url: string | null
  resort_content: unknown
  updated_at: string
}): Promise<{ ok: boolean; error?: string }> {
  const sb = adminClient()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('communities').insert(row)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Set is_resort flag on subdivision_flags (upsert). */
export async function upsertSubdivisionResortFlag(
  entityKey: string,
  isResort: boolean
): Promise<{ ok: boolean; error?: string }> {
  const sb = adminClient()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  if (isResort) {
    const { error } = await sb
      .from('subdivision_flags')
      .upsert(
        { entity_key: entityKey, is_resort: true, updated_at: new Date().toISOString() },
        { onConflict: 'entity_key' }
      )
    return error ? { ok: false, error: error.message } : { ok: true }
  }
  const { error } = await sb
    .from('subdivision_flags')
    .update({ is_resort: false, updated_at: new Date().toISOString() })
    .eq('entity_key', entityKey)
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Bulk seed: upsert many entity_keys as is_resort = true. */
export async function bulkUpsertResortFlags(
  entityKeys: string[]
): Promise<{ ok: boolean; count: number; error?: string }> {
  const sb = adminClient()
  if (!sb) return { ok: false, count: 0, error: 'Supabase not configured' }
  const now = new Date().toISOString()
  const rows = entityKeys.map((entity_key) => ({ entity_key, is_resort: true, updated_at: now }))
  const { error } = await sb.from('subdivision_flags').upsert(rows, { onConflict: 'entity_key' })
  if (error) return { ok: false, count: 0, error: error.message }
  return { ok: true, count: rows.length }
}

/** Find communities by name set with embedded city + neighborhood joins. */
export async function getCommunitiesWithCityNeighborhoodByNames(
  names: string[]
): Promise<Array<{
  name?: string | null
  cities?: { name?: string | null } | { name?: string | null }[] | null
  neighborhoods?: { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null
}>> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb || names.length === 0) return []
  const { data } = await sb
    .from('communities')
    .select('name, cities(name), neighborhoods(name, slug)')
    .in('name', names)
    .not('neighborhood_id', 'is', null)
    .limit(5000)
  return (data ?? []) as Array<{
    name?: string | null
    cities?: { name?: string | null } | { name?: string | null }[] | null
    neighborhoods?: { name?: string | null; slug?: string | null } | { name?: string | null; slug?: string | null }[] | null
  }>
}

/** Count communities matching a HEAD count + arbitrary not-null filter. */
export async function countCommunitiesNotNull(
  notNullColumn: string
): Promise<number> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return 0
  const { count } = await sb
    .from('communities')
    .select('id', { count: 'exact', head: true })
    .not(notNullColumn, 'is', null)
  return count ?? 0
}

/** Community → city.name + neighborhoods.slug embedded for sitemap lookup. */
export async function getCommunitiesForSitemapJoin(
  limit = 5000
): Promise<Array<{
  name?: string | null
  cities?: { name?: string | null; slug?: string | null } | null
  neighborhoods?: { slug?: string | null } | null
}>> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('communities')
    .select('name, cities(name, slug), neighborhoods(slug)')
    .limit(limit)
  return (data ?? []) as Array<{
    name?: string | null
    cities?: { name?: string | null; slug?: string | null } | null
    neighborhoods?: { slug?: string | null } | null
  }>
}

/** Lite community list for sitemap (slug only). */
export async function getCommunitiesForSitemap(
  limit = 5000
): Promise<Array<{ slug: string }>> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return []
  const { data } = await sb.from('communities').select('slug').limit(limit)
  return ((data ?? []) as Array<{ slug?: string | null }>).filter((r): r is { slug: string } => typeof r.slug === 'string' && r.slug.trim().length > 0)
}

/** All communities in a neighborhood (lite projection for community-index aggregation). */
export async function getCommunitiesInNeighborhoodLite(
  neighborhoodId: string
): Promise<Array<{ name: string; slug: string; hero_image_url?: string | null; is_resort?: boolean }>> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return []
  const { data } = await sb
    .from('communities')
    .select('name, slug, hero_image_url, is_resort')
    .eq('neighborhood_id', neighborhoodId)
  return (data ?? []) as Array<{ name: string; slug: string; hero_image_url?: string | null; is_resort?: boolean }>
}

/** Find one community row by slug ilike (for OG image / SEO surfaces). */
export async function getCommunityNameBySlugIlike(slug: string): Promise<{ name: string; slug: string } | null> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('communities')
    .select('name, slug')
    .ilike('slug', slug)
    .maybeSingle()
  return (data ?? null) as { name: string; slug: string } | null
}

/** Wide community-detail row with embedded neighborhoods join (by name ilike). */
export async function getCommunityDetailByName(name: string): Promise<{
  id: string
  name: string
  slug: string
  description?: string | null
  hero_image_url?: string | null
  boundary_geojson?: unknown
  is_resort?: boolean
  resort_content?: Record<string, unknown> | null
  neighborhood_id?: string | null
  neighborhoods?: { name: string; slug: string } | null
} | null> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('communities')
    .select('id, name, slug, description, hero_image_url, boundary_geojson, is_resort, resort_content, neighborhood_id, neighborhoods(name, slug)')
    .ilike('name', name)
    .maybeSingle()
  return (data ?? null) as {
    id: string
    name: string
    slug: string
    description?: string | null
    hero_image_url?: string | null
    boundary_geojson?: unknown
    is_resort?: boolean
    resort_content?: Record<string, unknown> | null
    neighborhood_id?: string | null
    neighborhoods?: { name: string; slug: string } | null
  } | null
}

/** Subdivision → neighborhood + city slug lookup (single row). */
export async function getCommunityNeighborhoodCityBySlug(subdivisionName: string): Promise<{
  neighborhoods?: { name: string; slug: string } | null
  cities?: { slug: string } | null
} | null> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return null
  const { data } = await sb
    .from('communities')
    .select('neighborhoods(name, slug), cities(slug)')
    .ilike('name', subdivisionName)
    .not('neighborhood_id', 'is', null)
    .limit(1)
    .maybeSingle()
  return (data ?? null) as {
    neighborhoods?: { name: string; slug: string } | null
    cities?: { slug: string } | null
  } | null
}

/** Check whether a single entity_key is flagged. Returns true if a row exists. */
export async function isSubdivisionFlagged(entityKey: string): Promise<boolean> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return false
  const { data } = await sb
    .from('subdivision_flags')
    .select('entity_key')
    .eq('entity_key', entityKey)
    .maybeSingle()
  return data != null
}

/** Read all (entity_key, is_resort) rows. */
export async function getAllSubdivisionFlags(): Promise<Array<{ entity_key: string; is_resort: boolean }>> {
  const sb = adminClient() ?? supabaseAnon()
  if (!sb) return []
  const { data } = await sb.from('subdivision_flags').select('entity_key, is_resort')
  return (data ?? []) as Array<{ entity_key: string; is_resort: boolean }>
}
