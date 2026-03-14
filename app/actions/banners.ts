'use server'

import { createClient } from '@supabase/supabase-js'
import { fetchPlacePhoto, fetchPlacePhotoOptions } from '../../lib/photo-api'
import { cityEntityKey, subdivisionEntityKey } from '../../lib/slug'
import { getBannerSearchQuery } from '../../lib/banner-prompts'
import { getResortEntityKeys } from './subdivision-flags'
import { getBrowseCities } from './listings'
import { getSubdivisionsInCity } from './listings'

const BUCKET = 'banners'

export type BannerEntity =
  | { entityType: 'city'; entityKey: string; displayName: string }
  | { entityType: 'subdivision'; entityKey: string; displayName: string; city: string; isResort?: boolean }

export { getBannerSearchQuery }

/**
 * Get public URL for a city or subdivision banner, or null if none exists.
 * Use this for hero, cards ("View homes in Bend"), and anywhere else — same URL, no regeneration.
 */
export async function getBannerUrl(
  entityType: 'city' | 'subdivision',
  entityKey: string
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null

  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('banner_images')
    .select('storage_path')
    .eq('entity_type', entityType)
    .eq('entity_key', entityKey)
    .maybeSingle()

  const path = (data as { storage_path?: string } | null)?.storage_path
  if (!path) return null

  return `${url}/storage/v1/object/public/${BUCKET}/${path}`
}

/**
 * Get attribution for a stored banner (when source is unsplash/pexels). Null for AI-generated.
 */
export async function getBannerAttribution(
  entityType: 'city' | 'subdivision',
  entityKey: string
): Promise<string | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url?.trim() || !anonKey?.trim()) return null
  const supabase = createClient(url, anonKey)
  const { data } = await supabase
    .from('banner_images')
    .select('attribution')
    .eq('entity_type', entityType)
    .eq('entity_key', entityKey)
    .maybeSingle()
  const att = (data as { attribution?: string | null } | null)?.attribution
  return att?.trim() ?? null
}

/**
 * Get banner URL and attribution if one already exists in storage.
 * Never fetches or generates images during page render — returns null if no banner stored.
 * Use the admin "Generate Banners" UI or generateAllMissingBanners() to populate banners.
 */
export async function getOrCreatePlaceBanner(
  entityType: 'city' | 'subdivision',
  entityKey: string,
  _searchQuery?: string
): Promise<{ url: string | null; attribution: string | null }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl?.trim() || !key?.trim()) return { url: null, attribution: null }

  const sb = createClient(supabaseUrl, key)
  const { data } = await sb
    .from('banner_images')
    .select('storage_path, attribution')
    .eq('entity_type', entityType)
    .eq('entity_key', entityKey)
    .maybeSingle()

  const row = data as { storage_path?: string; attribution?: string | null } | null
  if (!row?.storage_path) return { url: null, attribution: null }

  return {
    url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${row.storage_path}`,
    attribution: row.attribution?.trim() ?? null,
  }
}

/**
 * Batch-fetch banner URLs and attributions for multiple entities of the same type in a SINGLE query.
 * Returns a Map keyed by entity_key with {url, attribution} values.
 */
export async function getBannersBatch(
  entityType: 'city' | 'subdivision',
  entityKeys: string[]
): Promise<Map<string, { url: string | null; attribution: string | null }>> {
  const result = new Map<string, { url: string | null; attribution: string | null }>()
  if (entityKeys.length === 0) return result

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl?.trim() || !key?.trim()) return result

  const sb = createClient(supabaseUrl, key)
  const { data } = await sb
    .from('banner_images')
    .select('entity_key, storage_path, attribution')
    .eq('entity_type', entityType)
    .in('entity_key', entityKeys)

  for (const row of (data ?? []) as { entity_key: string; storage_path?: string; attribution?: string | null }[]) {
    if (!row.storage_path) continue
    result.set(row.entity_key, {
      url: `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${row.storage_path}`,
      attribution: row.attribution?.trim() ?? null,
    })
  }

  return result
}

/** Download image from URL, upload to Storage, upsert banner_images. Returns new public URL or null. */
async function downloadAndStoreBanner(
  entityType: 'city' | 'subdivision',
  entityKey: string,
  imageUrl: string,
  attribution: string | null
): Promise<string | null> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl?.trim() || !serviceKey?.trim()) return null
  let buffer: Buffer
  try {
    const res = await fetch(imageUrl, { next: { revalidate: 0 } })
    if (!res.ok) return null
    buffer = Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
  const storagePath =
    entityType === 'city'
      ? `cities/${entityKey}.jpg`
      : `subdivisions/${entityKey.replace(':', '/')}.jpg`
  const source = imageUrl.includes('unsplash') ? 'unsplash' : 'pexels'
  const supabase = createClient(supabaseUrl, serviceKey)
  const { data: buckets } = await supabase.storage.listBuckets()
  if (!buckets?.some((b) => b.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true })
  }
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(storagePath, buffer, {
    contentType: 'image/jpeg',
    upsert: true,
  })
  if (uploadError) return null
  await supabase.from('banner_images').upsert(
    {
      entity_type: entityType,
      entity_key: entityKey,
      storage_path: storagePath,
      source,
      attribution: attribution?.trim() || null,
    },
    { onConflict: 'entity_type,entity_key' }
  )
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${storagePath}`
}

/**
 * Return 4 Unsplash options for "pick another" UI (thumbUrl for thumbnails, url for saving).
 */
export async function getPlaceBannerOptions(searchQuery: string): Promise<
  { url: string; thumbUrl: string; attribution: string }[]
> {
  const options = await fetchPlacePhotoOptions(searchQuery.trim() || 'Central Oregon', 4)
  return options.map((o) => ({ url: o.url, thumbUrl: o.thumbUrl, attribution: o.attribution }))
}

/**
 * Set the place banner to a chosen Unsplash photo (from picker). Returns new URL on success.
 */
export async function setPlaceBannerFromPhoto(
  entityType: 'city' | 'subdivision',
  entityKey: string,
  photoUrl: string,
  attribution: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const url = await downloadAndStoreBanner(entityType, entityKey, photoUrl, attribution)
  if (url) return { ok: true, url }
  return { ok: false, error: 'Failed to save image.' }
}

/**
 * Fetch a new Unsplash photo (different page) and replace the stored banner.
 */
export async function refreshPlaceBanner(
  entityType: 'city' | 'subdivision',
  entityKey: string,
  searchQuery: string
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const page = Math.floor(Math.random() * 5) + 1
  const photo = await fetchPlacePhoto(searchQuery, { page })
  if (!photo?.url) return { ok: false, error: 'No photo found. Set UNSPLASH_ACCESS_KEY in .env.local.' }
  const url = await downloadAndStoreBanner(entityType, entityKey, photo.url, photo.attribution)
  if (url) return { ok: true, url }
  return { ok: false, error: 'Failed to save image.' }
}

/**
 * List all cities and subdivisions that exist in listings but have no banner yet.
 * Resort/planned communities get isResort so we fetch community-specific imagery; others get city landscape.
 */
export async function listMissingBanners(): Promise<BannerEntity[]> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!supabaseUrl?.trim() || !anonKey?.trim()) return []

  const [cities, existing, resortKeys] = await Promise.all([
    getBrowseCities(),
    createClient(supabaseUrl, anonKey).from('banner_images').select('entity_type, entity_key'),
    getResortEntityKeys(),
  ])

  const existingSet = new Set<string>()
  for (const row of existing.data ?? []) {
    const r = row as { entity_type: string; entity_key: string }
    existingSet.add(`${r.entity_type}:${r.entity_key}`)
  }

  const missing: BannerEntity[] = []

  for (const { City } of cities) {
    const key = cityEntityKey(City)
    if (!existingSet.has(`city:${key}`)) {
      missing.push({ entityType: 'city', entityKey: key, displayName: City })
    }
    const subs = await getSubdivisionsInCity(City)
    for (const { subdivisionName } of subs) {
      const subKey = subdivisionEntityKey(City, subdivisionName)
      if (!existingSet.has(`subdivision:${subKey}`)) {
        missing.push({
          entityType: 'subdivision',
          entityKey: subKey,
          displayName: subdivisionName,
          city: City,
          isResort: resortKeys.has(subKey),
        })
      }
    }
  }

  return missing
}

/**
 * Fetch a banner from Unsplash (pretty landscape), store in Storage and banner_images.
 * Resort/planned communities: image of that community. Other communities: scenic landscape of the city.
 */
export async function generateAndStoreBanner(entity: BannerEntity): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const searchQuery =
    entity.entityType === 'city'
      ? getBannerSearchQuery('city', entity.displayName)
      : getBannerSearchQuery('subdivision', entity.displayName, entity.city, entity.isResort)
  const { url } = await getOrCreatePlaceBanner(entity.entityType, entity.entityKey, searchQuery)
  if (url) return { ok: true, url }
  return { ok: false, error: 'No photo found. Set UNSPLASH_ACCESS_KEY in .env.local.' }
}

/**
 * Generate (or regenerate) a single banner for the current page. Call from city/subdivision search page.
 * Pass isResort for subdivisions so resort communities get community-specific imagery, others get city landscape.
 */
export async function generateBannerForPage(params: {
  entityType: 'city' | 'subdivision'
  entityKey: string
  displayName: string
  city?: string
  isResort?: boolean
}): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const entity: BannerEntity =
    params.entityType === 'city'
      ? { entityType: 'city', entityKey: params.entityKey, displayName: params.displayName }
      : {
          entityType: 'subdivision',
          entityKey: params.entityKey,
          displayName: params.displayName,
          city: params.city ?? '',
          isResort: params.isResort,
        }
  return generateAndStoreBanner(entity)
}

/**
 * Generate banners only for entities that don't have one yet (one Unsplash fetch per missing entity).
 * Runs sequentially with a short delay between calls to avoid rate limits.
 */
export async function generateAllMissingBanners(): Promise<{
  generated: number
  failed: number
  errors: string[]
}> {
  const missing = await listMissingBanners()
  const errors: string[] = []
  let generated = 0
  let failed = 0

  for (const entity of missing) {
    const result = await generateAndStoreBanner(entity)
    if (result.ok) {
      generated++
    } else {
      failed++
      errors.push(`${entity.entityType}:${entity.entityKey}: ${result.error}`)
    }
    await new Promise((r) => setTimeout(r, 1500))
  }

  return { generated, failed, errors }
}
