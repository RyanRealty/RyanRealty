/**
 * Area-guide video → structured data and slug lookup, shared by every place
 * page (city, neighborhood, community, subdivision). Pure: no DB, no React.
 *
 * The guide cut lives in the asset store as an MP4 and on the Ryan Realty
 * YouTube channel. When the YouTube stamp exists the VideoObject carries the
 * channel embed as embedUrl and the file as contentUrl, so Google indexes the
 * video once and credits the channel; without the stamp it is the file alone.
 */
import type { SchemaInput } from '@/lib/site/json-ld'
import type { AreaGuideYouTube } from '@/lib/data/media/getAreaGuideVideos'

export type AreaGuideForSchema = {
  url: string
  youtube?: AreaGuideYouTube | null
}

/** ISO 8601 duration for schema.org (PT27S, PT1M23S). */
export function isoDuration(seconds: number | null | undefined): string | undefined {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return undefined
  const s = Math.round(seconds)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  return `PT${h ? `${h}H` : ''}${m ? `${m}M` : ''}${sec || (!h && !m) ? `${sec}S` : ''}`
}

/**
 * The VideoObject for a place's area guide, or null when there is no guide.
 * `pageUrl` is the place page (relative is fine; buildJsonLd absolutizes).
 */
export function areaGuideVideoSchema(
  placeName: string,
  pageUrl: string,
  guide: AreaGuideForSchema | null | undefined,
): SchemaInput | null {
  const contentUrl = guide?.url?.trim()
  if (!contentUrl) return null
  const yt = guide?.youtube ?? null
  return {
    type: 'video',
    name: yt?.title?.trim() || `${placeName} area guide`,
    description: `A short video guide to ${placeName}, Central Oregon, from Ryan Realty.`,
    url: pageUrl,
    contentUrl,
    ...(yt ? { embedUrl: `https://www.youtube.com/embed/${yt.id}` } : {}),
    ...(yt?.thumbnailUrl ? { thumbnailUrl: yt.thumbnailUrl } : {}),
    ...(yt?.publishedAt ? { uploadDate: yt.publishedAt } : {}),
    ...(isoDuration(yt?.durationSeconds) ? { duration: isoDuration(yt?.durationSeconds) } : {}),
  }
}

/**
 * The geo slugs to try for a subdivision page. Plat slugs carry a recording
 * suffix ("coyote-springs-phase-one", "discovery-west-phase-2a-and-2b",
 * "clearpine-phase-2", "crooked-river-ranch-no-4", "bachelor-sunrise-plld20210914");
 * the guide is cut for the named place, so the phase falls back to its parent.
 * Only trailing recording tokens are stripped, never a real name word, so
 * "awbrey-butte-homesites-phase-eight" resolves to "awbrey-butte-homesites"
 * (no guide, correctly) and never to Awbrey Butte.
 */
export function areaGuideLookupSlugs(slug: string): string[] {
  const s = slug.trim().toLowerCase()
  if (!s) return []
  const out = [s]
  const parent = s
    .replace(/-(phases?|stage|unit|no|pz|plld|plfp|mod|sub)[-a-z0-9]*$/i, '')
    .replace(/-(i{1,3}|iv|v|vi{0,3}|ix|x|[0-9]+[a-z]?)$/i, '')
  if (parent && parent !== s) out.push(parent)
  return out
}
