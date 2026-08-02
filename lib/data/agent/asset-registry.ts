/**
 * lib/data/agent/asset-registry.ts — DAL for property-shoot asset ingestion
 * (docs/plans/BROKER_SMS_AGENT_2026-07-31.md Amendment R2.7).
 *
 * Owns every raw `asset_library` write this feature makes (G1: raw `.from()`
 * only under lib/data/) plus the private `property-shoots` Storage bucket and
 * a best-effort listings lat/lng lookup for the R2.7 GPS-outlier check.
 *
 * COLUMN TRAP (verified against docs/DATABASE_SCHEMA_SNAPSHOT.md 2026-07-31,
 * `asset_library` section, NOT from memory): the live columns are id, type,
 * source, source_id, license, license_metadata, creator, creator_url,
 * storage_bucket, storage_object_path, file_url, file_size_bytes, geo_tags,
 * subject_tags, search_query, width, height, duration_sec, registered_at,
 * last_used_at, used_in, approval, notes, surface_tags, vision_grade.
 * There is NO `vision_caption` / `vision_scene` / `vision_watermark` column —
 * despite those names appearing in this rung's task brief, the snapshot (the
 * mandatory source of truth per CLAUDE.md §7) does not have them, and no
 * migration adds them either (checked supabase/migrations for the string).
 * lib/agent/assets.ts folds that vision output into the free-text `notes`
 * column instead of inventing columns that don't exist. The local manifest at
 * data/asset-library/manifest.json uses a `vision_quality` field name and is
 * intentionally NOT written by this path — the durable source for
 * property-shoot assets is Supabase (this table + the Storage bucket), not
 * the local JSON manifest lib/asset-library.mjs also maintains for the
 * separate stock/generated-asset pipeline.
 *
 * Dedupe: `on_conflict=source,source_id` is the same upsert target
 * lib/asset-library.mjs already uses in production (insertRow()), so the
 * unique constraint is confirmed live even though the printed schema excerpt
 * doesn't spell out constraint names.
 */

import { createServiceClient } from '@/lib/supabase/service'

export const PROPERTY_SHOOTS_BUCKET = 'property-shoots'

export interface AssetLibraryInsertRow {
  type: 'photo' | 'video'
  source: string
  source_id: string
  license?: string
  license_metadata?: Record<string, unknown>
  creator?: string
  creator_url?: string
  storage_bucket: string
  storage_object_path: string
  file_url?: string | null
  file_size_bytes?: number
  geo_tags?: string[]
  subject_tags?: string[]
  search_query?: string
  width?: number
  height?: number
  duration_sec?: number
  approval?: 'approved' | 'intake' | 'rejected' | 'expired'
  notes?: string
  surface_tags?: string[]
  vision_grade?: 'A' | 'B' | 'C' | 'D' | null
}

let bucketEnsured = false

/** Idempotent, memoized within the process. Private bucket — property-shoot
 *  photos are pre-review (approval defaults to 'intake') and pre-market
 *  shoots may show a property before any public marketing exists. */
export async function ensureShootsBucket(): Promise<void> {
  if (bucketEnsured) return
  const sb = createServiceClient()
  const { data } = await sb.storage.getBucket(PROPERTY_SHOOTS_BUCKET)
  if (!data) {
    const { error } = await sb.storage.createBucket(PROPERTY_SHOOTS_BUCKET, {
      public: false,
      fileSizeLimit: 500 * 1024 * 1024,
    })
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`ensureShootsBucket: ${error.message}`)
    }
  }
  bucketEnsured = true
}

export type UploadShootAssetResult = { ok: true } | { ok: false; error: string }

/** Upload (upsert) one file into the property-shoots bucket at `objectPath`
 *  (bucket-relative, e.g. "123-nw-awbrey-ave/ab12...ef.jpg"). */
export async function uploadShootAsset(
  objectPath: string,
  buffer: Buffer,
  contentType: string,
): Promise<UploadShootAssetResult> {
  await ensureShootsBucket()
  const sb = createServiceClient()
  const { error } = await sb.storage.from(PROPERTY_SHOOTS_BUCKET).upload(objectPath, buffer, {
    contentType,
    upsert: true,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** Precise (source, source_id) lookup — the dedupe check. Returns the row id
 *  if it already exists, else null. Never throws; a lookup failure resolves
 *  to null so a transient DB hiccup fails toward re-ingesting (safe, since
 *  the upsert below is also keyed on source,source_id) rather than silently
 *  treating everything as a duplicate. */
export async function findAssetBySourceId(source: string, sourceId: string): Promise<{ id: string } | null> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('asset_library')
    .select('id')
    .eq('source', source)
    .eq('source_id', sourceId)
    .maybeSingle()
  if (error) {
    console.error('[findAssetBySourceId]', error.message)
    return null
  }
  return (data as { id: string } | null) ?? null
}

export type UpsertAssetLibraryResult = { ok: true } | { ok: false; error: string }

/** Upsert one asset_library row, keyed on (source, source_id) — the same
 *  dedupe target lib/asset-library.mjs uses for the stock/generated pipeline. */
export async function upsertAssetLibraryRow(row: AssetLibraryInsertRow): Promise<UpsertAssetLibraryResult> {
  const sb = createServiceClient()
  const { error } = await sb.from('asset_library').upsert(row, { onConflict: 'source,source_id' })
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/**
 * Best-effort address -> lat/lng lookup against `listings` (bare mixed-case
 * columns — supabase-js handles them correctly per CLAUDE.md §7; this is NOT
 * raw SQL). Used only when the tool caller didn't already supply
 * `propertyLatLng` explicitly. Deliberately forgiving: a broker pastes
 * whatever address shorthand they used in text ("123 NW Awbrey Ave, Bend"),
 * so this keeps the leading street number + first two street-name tokens and
 * ILIKE-matches. Returns null on no match, bad input, or any DB error — the
 * caller (lib/agent/assets.ts ingestShoot) treats null exactly like "no
 * property coordinates available" and simply skips the GPS-outlier check.
 */
export async function resolveListingLatLng(propertyLabel: string): Promise<{ lat: number; lng: number } | null> {
  const match = /^\s*(\d+)\s+(.+)$/.exec(propertyLabel)
  if (!match) return null
  const [, streetNumber, rest] = match
  const streetNameGuess = rest.split(',')[0]?.trim().split(/\s+/).slice(0, 2).join(' ')
  if (!streetNameGuess) return null

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('listings')
    .select('Latitude,Longitude')
    .eq('StreetNumber', streetNumber)
    .ilike('StreetName', `%${streetNameGuess}%`)
    .not('Latitude', 'is', null)
    .not('Longitude', 'is', null)
    .limit(1)

  if (error || !data?.length) return null
  const row = data[0] as { Latitude: number | string | null; Longitude: number | string | null }
  const lat = Number(row.Latitude)
  const lng = Number(row.Longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}
