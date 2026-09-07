/**
 * getAreaGuideVideo — the approved per-location AREA GUIDE video for a geo, from
 * the canonical asset store `public.asset_library`.
 *
 * Unlike getSurfaceImage (which falls back to a regional / any photo so hero+card
 * slots always fill), an area-guide video must be an EXACT geo match — a Bend
 * area guide playing on a Sisters page is wrong — so this returns null when the
 * location has no guide video. These are finished marketing cuts (voiceover +
 * on-screen text), so they belong in a click-to-play "Watch the area guide" slot,
 * never a silent looping hero.
 *
 * YouTube (2026-09-07): the same cuts are published on the Ryan Realty channel
 * (UCpxIXnNVeG25oeDjfE3b4lw). Each asset row carries that upload in `used_in`
 * as a `render_type: 'youtube'` usage record, so the page can send the viewer
 * to the channel and emit a VideoObject with an embedUrl instead of a bare MP4.
 */
import { supabaseAnon } from '@/lib/data/client'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'

export type AreaGuideYouTube = {
  /** 11-char YouTube video id. */
  id: string
  /** Canonical watch URL. */
  url: string
  title: string | null
  thumbnailUrl: string | null
  /** ISO date the video was published on the channel. */
  publishedAt: string | null
  durationSeconds: number | null
}

export type AreaGuideVideo = {
  url: string
  geoTags: string[]
  wide: boolean
  youtube: AreaGuideYouTube | null
}

type UsedInRecord = {
  render_type?: unknown
  render_path?: unknown
  scene_id?: unknown
  title?: unknown
  thumbnail_url?: unknown
  published_at?: unknown
  duration_seconds?: unknown
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * The YouTube upload recorded against an asset, or null. Pure: exported for
 * the unit test. A `used_in` entry is the asset library's usage record
 * (lib/asset-library.mjs markUsed); the YouTube stamp uses render_type
 * 'youtube', scene_id = video id, render_path = watch URL.
 */
export function youtubeFromUsedIn(usedIn: unknown): AreaGuideYouTube | null {
  if (!Array.isArray(usedIn)) return null
  for (const raw of usedIn) {
    if (!raw || typeof raw !== 'object') continue
    const r = raw as UsedInRecord
    if (r.render_type !== 'youtube') continue
    const id = typeof r.scene_id === 'string' ? r.scene_id.trim() : ''
    if (!YOUTUBE_ID.test(id)) continue
    const path = typeof r.render_path === 'string' ? r.render_path.trim() : ''
    const duration = typeof r.duration_seconds === 'number' && Number.isFinite(r.duration_seconds) ? r.duration_seconds : null
    return {
      id,
      url: path.startsWith('https://') ? path : `https://www.youtube.com/watch?v=${id}`,
      title: typeof r.title === 'string' && r.title.trim() ? r.title.trim() : null,
      thumbnailUrl: typeof r.thumbnail_url === 'string' && r.thumbnail_url.startsWith('https://') ? r.thumbnail_url : null,
      publishedAt: typeof r.published_at === 'string' && r.published_at.trim() ? r.published_at.trim() : null,
      durationSeconds: duration,
    }
  }
  return null
}

async function _getAreaGuideVideosUncached(): Promise<AreaGuideVideo[]> {
  const sb = supabaseAnon()
  if (!sb) return []
  const { data, error } = await sb
    .from('asset_library')
    .select('file_url, geo_tags, surface_tags, used_in')
    .eq('type', 'video')
    .eq('approval', 'approved')
    .contains('surface_tags', ['area-guide'])
    .not('file_url', 'is', null)
    .limit(600)
  // THROW on a transient DB error so makeResilientCached never caches an empty
  // result (poison-null). A genuine empty success returns [].
  if (error) throw new Error(`[getAreaGuideVideos] ${error.message ?? JSON.stringify(error)}`)
  if (!data) return []
  return (
    data as Array<{
      file_url: string
      geo_tags: string[] | null
      surface_tags: string[] | null
      used_in: unknown
    }>
  ).map((r) => ({
    url: r.file_url,
    geoTags: r.geo_tags ?? [],
    wide: (r.surface_tags ?? []).includes('area-guide-wide'),
    youtube: youtubeFromUsedIn(r.used_in),
  }))
}

export const getAreaGuideVideos = makeResilientCached(
  _getAreaGuideVideosUncached,
  ['area-guide-videos-v2'],
  { revalidate: CACHE_WINDOWS.assets, tags: [cacheTag.assets] },
  [],
)

/**
 * The area-guide video for an EXACT geo slug (no regional fallback). Returns
 * null when the location has no approved guide video — the caller hides the slot.
 * Pass extra alias slugs (e.g. ['nw-crossing','northwest-crossing']) when a geo is
 * tagged inconsistently; the first exact match wins.
 *
 * `wide` comes back with the URL (not silently dropped) so the player can size
 * itself to the clip's REAL aspect ratio server-side — most of these are
 * phone-shot portrait cuts, and guessing 16:9 client-side before the video's
 * metadata loads pillarboxed them into a mostly-empty navy frame
 * (design-audit P2).
 *
 * `youtube` is the channel upload of the same cut when one is stamped on any
 * matching asset (the portrait and wide cuts share one upload).
 */
export async function getAreaGuideVideo(
  geoSlugs: string | string[]
): Promise<{ url: string; wide: boolean; youtube: AreaGuideYouTube | null } | null> {
  const wanted = (Array.isArray(geoSlugs) ? geoSlugs : [geoSlugs])
    .filter(Boolean)
    .map((g) => g.toLowerCase())
  if (!wanted.length) return null
  const pool = await getAreaGuideVideos()
  const matches = pool.filter((v) => v.geoTags.some((g) => wanted.includes(g.toLowerCase())))
  if (!matches.length) return null
  // Prefer the landscape (16:9) cut; it fills the 16:9 player. A portrait 9:16
  // social only letterboxes (acceptable fallback when no wide cut exists).
  const picked = matches.find((m) => m.wide) ?? matches[0]
  const youtube = picked.youtube ?? matches.find((m) => m.youtube)?.youtube ?? null
  return { url: picked.url, wide: picked.wide, youtube }
}
