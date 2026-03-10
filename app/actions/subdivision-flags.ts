'use server'

import { createClient } from '@supabase/supabase-js'
import { subdivisionEntityKey } from '@/lib/slug'
import { RESORT_ENTITY_KEYS } from '@/lib/resort-communities'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { logAdminAction } from '@/app/actions/log-admin-action'

/**
 * Returns the set of entity_key values that are marked as resort communities.
 * Used by search/community pages to show full resort treatment.
 */
export async function getResortEntityKeys(): Promise<Set<string>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) return new Set()
  const supabase = createClient(url, key)
  const { data } = await supabase
    .from('subdivision_flags')
    .select('entity_key')
    .eq('is_resort', true)
  const keys = (data ?? []).map((r: { entity_key: string }) => r.entity_key)
  return new Set(keys)
}

/**
 * Set or clear the resort flag for a subdivision (by entity_key).
 * entity_key format: city:subdivision slug, e.g. bend:sunriver.
 */
export async function setSubdivisionResort(
  entityKey: string,
  isResort: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured.' }
  }
  const supabase = createClient(url, serviceKey)
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) {
    return { ok: false, error: 'entity_key must be in form city:subdivision' }
  }
  if (isResort) {
    const { error } = await supabase.from('subdivision_flags').upsert(
      { entity_key: key, is_resort: true, updated_at: new Date().toISOString() },
      { onConflict: 'entity_key' }
    )
    if (error) return { ok: false, error: error.message }
  } else {
    const { error } = await supabase.from('subdivision_flags').update({ is_resort: false, updated_at: new Date().toISOString() }).eq('entity_key', key)
    if (error) return { ok: false, error: error.message }
  }
  const session = await getSession()
  const adminRole = session?.user?.email ? (await getAdminRoleForEmail(session.user.email))?.role ?? null : null
  await logAdminAction({
    adminEmail: session?.user?.email ?? '',
    role: adminRole ?? null,
    actionType: isResort ? 'create' : 'update',
    resourceType: 'subdivision_flag',
    resourceId: key,
    details: { is_resort: isResort },
  })
  return { ok: true }
}

export type SubdivisionRow = { entity_key: string; city: string; subdivision: string; is_resort: boolean }

/**
 * List distinct city/subdivision from listings and merge with subdivision_flags.
 * For admin resort-communities page.
 */
export async function listSubdivisionsWithFlags(): Promise<SubdivisionRow[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !key?.trim()) return []
  const supabase = createClient(url, key)
  const { data: listingRows } = await supabase
    .from('listings')
    .select('City, SubdivisionName')
    .not('SubdivisionName', 'is', null)
  const seen = new Set<string>()
  const rows: { city: string; subdivision: string }[] = []
  for (const r of listingRows ?? []) {
    const city = (r.City ?? '').toString().trim()
    const sub = (r.SubdivisionName ?? '').toString().trim()
    if (!city || !sub) continue
    const ek = subdivisionEntityKey(city, sub)
    if (seen.has(ek)) continue
    seen.add(ek)
    rows.push({ city, subdivision: sub })
  }
  rows.sort((a, b) => a.city.localeCompare(b.city) || a.subdivision.localeCompare(b.subdivision))
  const { data: flags } = await supabase.from('subdivision_flags').select('entity_key, is_resort')
  const flagMap = new Map<string, boolean>()
  const flagKeys = new Set<string>()
  for (const f of flags ?? []) {
    const ek = (f as { entity_key: string }).entity_key
    flagMap.set(ek, (f as { is_resort: boolean }).is_resort === true)
    flagKeys.add(ek)
  }
  const result = rows.map(({ city, subdivision }) => {
    const entity_key = subdivisionEntityKey(city, subdivision)
    return { entity_key, city, subdivision, is_resort: flagMap.get(entity_key) ?? false }
  })
  for (const ek of flagKeys) {
    if (seen.has(ek)) continue
    const [c, s] = ek.split(':')
    if (c && s) result.push({ entity_key: ek, city: c, subdivision: s.replace(/-/g, ' '), is_resort: flagMap.get(ek) ?? false })
  }
  result.sort((a, b) => a.city.localeCompare(b.city) || a.subdivision.localeCompare(b.subdivision))
  return result
}

/**
 * Seed subdivision_flags with the built-in Oregon resort community list (is_resort = true).
 * Idempotent: upserts each entity_key so existing rows are just updated.
 */
export async function seedResortCommunitiesFromDefaultList(): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) {
    return { ok: false, error: 'Supabase not configured.' }
  }
  const supabase = createClient(url, serviceKey)
  const now = new Date().toISOString()
  const rows = Array.from(RESORT_ENTITY_KEYS).map((entity_key) => ({
    entity_key,
    is_resort: true,
    updated_at: now,
  }))
  const { error } = await supabase.from('subdivision_flags').upsert(rows, { onConflict: 'entity_key' })
  if (error) return { ok: false, error: error.message }
  return { ok: true, count: rows.length }
}
