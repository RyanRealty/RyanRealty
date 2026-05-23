'use server'

import * as Sentry from '@sentry/nextjs'
import { subdivisionEntityKey, parseEntityKey } from '@/lib/slug'
import {
  getAllCommunitySnapshots,
  getResortEntityKeysFromFlags,
  findCommunityBySlug,
  updateCommunityRowById,
  insertCommunityRow,
  upsertSubdivisionResortFlag,
  bulkUpsertResortFlags,
  getAllSubdivisionFlags,
} from '@/lib/data'
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
  return getResortEntityKeysFromFlags()
}

/**
 * When a subdivision is marked as resort, ensure communities row exists and backfill hero + resort_content
 * so the resort page can render. Does not overwrite existing hero or resort_content.
 */
async function backfillResortCommunityData(entityKey: string): Promise<void> {
  const { city, subdivision } = parseEntityKey(entityKey)
  const slug = entityKey.replace(':', '-')
  const searchQuery = getBannerSearchQuery('subdivision', subdivision, city, true)
  const { url: heroUrl } = await getOrCreatePlaceBanner('subdivision', entityKey, searchQuery)
  const staticContent = getResortCommunityContent(city, subdivision)
  const existing = await findCommunityBySlug(slug)
  const now = new Date().toISOString()
  if (existing) {
    const updates: Record<string, unknown> = { is_resort: true, updated_at: now }
    if (!existing.hero_image_url && heroUrl) updates.hero_image_url = heroUrl
    if (!existing.resort_content && staticContent) updates.resort_content = staticContent
    await updateCommunityRowById(existing.id, updates)
  } else {
    await insertCommunityRow({
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
 */
export async function setSubdivisionResort(
  entityKey: string,
  isResort: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = entityKey.trim().toLowerCase()
  if (!key || !key.includes(':')) {
    return { ok: false, error: 'entity_key must be in form city:subdivision' }
  }
  const flagResult = await upsertSubdivisionResortFlag(key, isResort)
  if (!flagResult.ok) return { ok: false, error: flagResult.error ?? 'flag update failed' }
  if (isResort) {
    await backfillResortCommunityData(key).catch((e) => {
      Sentry.captureException(e, {
        level: 'warning',
        extra: { context: 'backfillResortCommunityData', entity_key: key },
      })
    })
  }
  const session = await getSession()
  const adminRole = session?.user?.email
    ? (await getAdminRoleForEmail(session.user.email))?.role ?? null
    : null
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
 * List distinct city/subdivision from geo_snapshot_mv and merge with subdivision_flags.
 * For admin resort-communities page.
 */
export async function listSubdivisionsWithFlags(): Promise<SubdivisionRow[]> {
  const snapshots = await getAllCommunitySnapshots()
  const seen = new Set<string>()
  const rows: { city: string; subdivision: string }[] = []
  for (const snap of snapshots) {
    const subdivision = snap.geoLabel?.trim()
    if (!subdivision) continue
    const cityLowerFromKey = snap.geoKey.split(':')[0]
    if (!cityLowerFromKey) continue
    const city = cityLowerFromKey
      .split(' ')
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(' ')
    const ek = subdivisionEntityKey(city, subdivision)
    if (seen.has(ek)) continue
    seen.add(ek)
    rows.push({ city, subdivision })
  }
  rows.sort((a, b) => a.city.localeCompare(b.city) || a.subdivision.localeCompare(b.subdivision))
  const flags = await getAllSubdivisionFlags()
  const flagMap = new Map<string, boolean>()
  const flagKeys = new Set<string>()
  for (const f of flags) {
    flagMap.set(f.entity_key, f.is_resort === true)
    flagKeys.add(f.entity_key)
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
export async function seedResortCommunitiesFromDefaultList(): Promise<
  { ok: true; count: number } | { ok: false; error: string }
> {
  const res = await bulkUpsertResortFlags(Array.from(RESORT_ENTITY_KEYS))
  if (!res.ok) return { ok: false, error: res.error ?? 'seed failed' }
  return { ok: true, count: res.count }
}
