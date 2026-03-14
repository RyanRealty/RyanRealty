'use server'

import * as Sentry from '@sentry/nextjs'
import { createClient } from '@supabase/supabase-js'
import { subdivisionEntityKey, parseEntityKey } from '@/lib/slug'
import { RESORT_ENTITY_KEYS, RESORT_LIST } from '@/lib/resort-communities'
import { getSession } from '@/app/actions/auth'
import { getAdminRoleForEmail } from '@/app/actions/admin-roles'
import { logAdminAction } from '@/app/actions/log-admin-action'
import { getOrCreatePlaceBanner, getBannerSearchQuery } from '@/app/actions/banners'
import { getResortCommunityContent } from '@/lib/community-content'

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
 * When a subdivision is marked as resort, ensure communities row exists and backfill hero + resort_content
 * so the resort page can render. Does not overwrite existing hero or resort_content.
 */
async function backfillResortCommunityData(entityKey: string): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !serviceKey?.trim()) return
  const { city, subdivision } = parseEntityKey(entityKey)
  const slug = entityKey.replace(':', '-')
  const supabase = createClient(url, serviceKey)

  const searchQuery = getBannerSearchQuery('subdivision', subdivision, city, true)
  const { url: heroUrl } = await getOrCreatePlaceBanner('subdivision', entityKey, searchQuery)
  const staticContent = getResortCommunityContent(city, subdivision)

  const { data: existing } = await supabase
    .from('communities')
    .select('id, hero_image_url, resort_content')
    .eq('slug', slug)
    .maybeSingle()

  const now = new Date().toISOString()
  if (existing) {
    const updates: Record<string, unknown> = { is_resort: true, updated_at: now }
    if (!(existing as { hero_image_url?: string | null }).hero_image_url && heroUrl) {
      updates.hero_image_url = heroUrl
    }
    if (!(existing as { resort_content?: unknown }).resort_content && staticContent) {
      updates.resort_content = staticContent
    }
    await supabase.from('communities').update(updates).eq('id', (existing as { id: string }).id)
  } else {
    await supabase.from('communities').insert({
      name: subdivision,
      slug,
      is_resort: true,
      hero_image_url: heroUrl ?? null,
      resort_content: staticContent ?? null,
      updated_at: now,
    })
  }
}

/**
 * Set or clear the resort flag for a subdivision (by entity_key).
 * entity_key format: city:subdivision slug, e.g. bend:sunriver.
 * When toggling ON, runs backfill so hero image and resort content exist; when toggling OFF, only sets is_resort = false (no data removed).
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
    await backfillResortCommunityData(key).catch((e) => {
      Sentry.captureException(e, { level: 'warning', extra: { context: 'backfillResortCommunityData', entity_key: key } })
    })
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
  const isResort = (entity_key: string) =>
    flagMap.has(entity_key) ? flagMap.get(entity_key)! : RESORT_ENTITY_KEYS.has(entity_key)
  const result = rows.map(({ city, subdivision }) => {
    const entity_key = subdivisionEntityKey(city, subdivision)
    return { entity_key, city, subdivision, is_resort: isResort(entity_key) }
  })
  for (const ek of flagKeys) {
    if (seen.has(ek)) continue
    const [c, s] = ek.split(':')
    if (c && s) result.push({ entity_key: ek, city: c, subdivision: s.replace(/-/g, ' '), is_resort: isResort(ek) })
  }
  for (const { city, subdivision } of RESORT_LIST) {
    const entity_key = subdivisionEntityKey(city, subdivision)
    if (seen.has(entity_key)) continue
    seen.add(entity_key)
    result.push({ entity_key, city, subdivision, is_resort: isResort(entity_key) })
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
