'use server'

import { createClient } from '@supabase/supabase-js'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { logAdminAction } from '@/app/actions/log-admin-action'

export type GeoPlaceType = 'country' | 'state' | 'city' | 'neighborhood' | 'community'

export type GeoPlaceRow = {
  id: string
  type: GeoPlaceType
  parent_id: string | null
  name: string
  slug: string
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

function slugFromName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'unknown'
}

/**
 * List geo_places by type and optional parent_id.
 */
export async function listGeoPlaces(options: {
  type: GeoPlaceType
  parentId?: string | null
}): Promise<GeoPlaceRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) return []
  const supabase = createClient(url, key)
  let q = supabase.from('geo_places').select('id, type, parent_id, name, slug, metadata, created_at, updated_at').eq('type', options.type)
  if (options.parentId != null) {
    q = options.parentId ? q.eq('parent_id', options.parentId) : q.is('parent_id', null)
  }
  const { data } = await q.order('name')
  return (data ?? []) as GeoPlaceRow[]
}

/**
 * Create a geo place (e.g. neighborhood under a city). Idempotent by (parent_id, slug).
 */
export async function createGeoPlace(params: {
  type: GeoPlaceType
  parentId: string | null
  name: string
  metadata?: Record<string, unknown>
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured.' }
  }
  const slug = slugFromName(params.name)
  if (!slug) return { ok: false, error: 'Invalid name.' }
  const supabase = createClient(supabaseUrl, serviceKey)
  const { data, error } = await supabase
    .from('geo_places')
    .insert({
      type: params.type,
      parent_id: params.parentId || null,
      name: params.name.trim(),
      slug,
      metadata: params.metadata ?? {},
    })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') {
      const { data: existing } = await supabase.from('geo_places').select('id').eq('type', params.type).eq('parent_id', params.parentId ?? null).eq('slug', slug).maybeSingle()
      if (existing) return { ok: true, id: (existing as { id: string }).id }
    }
    return { ok: false, error: error.message }
  }
  const session = await getSession()
  const adminRole = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({
    adminEmail: session?.user?.email ?? '',
    role: adminRole ?? null,
    actionType: 'create',
    resourceType: 'geo_place',
    resourceId: (data as { id: string }).id,
    details: { type: params.type, slug, name: params.name.trim() },
  })
  return { ok: true, id: (data as { id: string }).id }
}

/**
 * Update a geo place (e.g. set community's parent_id to a neighborhood for assignment).
 */
export async function updateGeoPlace(
  id: string,
  updates: { parent_id?: string | null; name?: string; metadata?: Record<string, unknown> }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured.' }
  }
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (updates.parent_id !== undefined) payload.parent_id = updates.parent_id || null
  if (updates.name !== undefined) payload.name = updates.name.trim()
  if (updates.metadata !== undefined) payload.metadata = updates.metadata
  const { error } = await createClient(supabaseUrl, serviceKey).from('geo_places').update(payload).eq('id', id)
  if (error) return { ok: false, error: error.message }
  const session = await getSession()
  const adminRole = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({
    adminEmail: session?.user?.email ?? '',
    role: adminRole ?? null,
    actionType: 'update',
    resourceType: 'geo_place',
    resourceId: id,
    details: updates,
  })
  return { ok: true }
}

/**
 * Get a single geo place by id.
 */
export async function getGeoPlace(id: string): Promise<GeoPlaceRow | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) return null
  const { data } = await createClient(url, key).from('geo_places').select('id, type, parent_id, name, slug, metadata, created_at, updated_at').eq('id', id).maybeSingle()
  return data as GeoPlaceRow | null
}

/**
 * Ensure geo_places has country (US), state (Oregon), and cities from listings. Call from admin or cron.
 * Returns count of cities ensured. Does not remove or change existing rows.
 */
export async function ensureGeoPlacesFromListings(): Promise<{ ok: true; citiesEnsured: number } | { ok: false; error: string }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured.' }
  }
  const supabase = createClient(supabaseUrl, serviceKey)
  const { getBrowseCities } = await import('./listings')
  const cities = await getBrowseCities()
  if (cities.length === 0) return { ok: true, citiesEnsured: 0 }

  let countryId: string | null = null
  let stateId: string | null = null
  const { data: countries } = await supabase.from('geo_places').select('id').eq('type', 'country').eq('slug', 'us').limit(1)
  if (countries?.length) countryId = (countries[0] as { id: string }).id
  else {
    const { data: ins } = await supabase.from('geo_places').insert({ type: 'country', parent_id: null, name: 'United States', slug: 'us' }).select('id').single()
    if (ins) countryId = (ins as { id: string }).id
  }
  if (!countryId) return { ok: false, error: 'Could not ensure country.' }

  const { data: states } = await supabase.from('geo_places').select('id').eq('type', 'state').eq('parent_id', countryId).eq('slug', 'oregon').limit(1)
  if (states?.length) stateId = (states[0] as { id: string }).id
  else {
    const { data: ins } = await supabase.from('geo_places').insert({ type: 'state', parent_id: countryId, name: 'Oregon', slug: 'oregon' }).select('id').single()
    if (ins) stateId = (ins as { id: string }).id
  }
  if (!stateId) return { ok: false, error: 'Could not ensure state.' }

  let citiesEnsured = 0
  const cityIdsBySlug = new Map<string, string>()
  for (const { City } of cities) {
    const name = City.trim()
    if (!name) continue
    const slug = slugFromName(name)
    const { data: existing } = await supabase.from('geo_places').select('id').eq('type', 'city').eq('parent_id', stateId).eq('slug', slug).maybeSingle()
    let cityId: string
    if (existing) {
      cityId = (existing as { id: string }).id
    } else {
      const { data: ins } = await supabase.from('geo_places').insert({ type: 'city', parent_id: stateId, name, slug }).select('id').single()
      if (!ins) continue
      cityId = (ins as { id: string }).id
      citiesEnsured++
    }
    cityIdsBySlug.set(slug, cityId)
  }

  const { getSubdivisionsInCity } = await import('./listings')
  for (const { City } of cities) {
    const name = City.trim()
    if (!name) continue
    const slug = slugFromName(name)
    const cityId = cityIdsBySlug.get(slug)
    if (!cityId) continue
    const subs = await getSubdivisionsInCity(name)
    for (const { subdivisionName } of subs) {
      const subSlug = slugFromName(subdivisionName)
      const { data: ex } = await supabase.from('geo_places').select('id').eq('type', 'community').eq('parent_id', cityId).eq('slug', subSlug).maybeSingle()
      if (!ex) {
        await supabase.from('geo_places').insert({ type: 'community', parent_id: cityId, name: subdivisionName, slug: subSlug })
      }
    }
  }
  return { ok: true, citiesEnsured }
}
