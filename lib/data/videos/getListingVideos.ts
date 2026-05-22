/**
 * getListingVideos — fetch listing videos with 3-tier MLS fallback.
 *
 * Agents pay videographers (Aryeo, Riley Visuals, Walker & Homes, Cloudflare
 * Stream, etc.) and upload the result to MLS. The MLS feeds us those URLs
 * via the Spark sync. We embed; we don't render. For the three listings
 * Ryan Realty actually lists, we sometimes publish our own renders.
 *
 * Fallback order (per docs/DATA_ACCESS_LAYER.md "Listing videos"):
 *   1. listing_videos table  — our own publishes (rare)
 *   2. video_tours_cache     — nightly MLS feed (Aryeo, Vimeo, YouTube, etc.)
 *   3. listings.details.Videos JSONB  — raw MLS payload
 *
 * Returns the union, deduplicated by URL.
 */

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { supabaseAnon } from '@/lib/data/client'
import type { VideoEmbed, VideoSource } from '@/lib/data/types/video'

const InputSchema = z.object({ listingKey: z.string().min(1).max(100) })

type ListingVideosRow = {
  video_url: string
  source: string | null
  duration_seconds: number | null
  sort_order: number | null
}

type CacheListingEntry = {
  listing_key?: string | null
  video_url?: string | null
  video_source?: string | null
  poster_url?: string | null
}

/**
 * Detect the video source/embed shape from a URL.
 */
function classifyVideo(url: string, hintSource?: string | null): {
  source: VideoSource
  embedType: 'iframe' | 'video-tag'
  professional: boolean
} {
  const u = url.toLowerCase()
  // Map hint source first (these come from the MLS feed)
  if (hintSource) {
    const hint = hintSource.toLowerCase()
    if (hint.includes('aryeo')) return { source: 'mls-aryeo', embedType: 'iframe', professional: true }
    if (hint.includes('walker')) return { source: 'mls-walker-homes', embedType: 'iframe', professional: true }
    if (hint.includes('riley')) return { source: 'mls-riley-visuals', embedType: 'iframe', professional: true }
    if (hint.includes('matterport')) return { source: 'mls-matterport', embedType: 'iframe', professional: true }
    if (hint.includes('cloudflare')) return { source: 'mls-cloudflare-stream', embedType: 'iframe', professional: true }
    if (hint.includes('mapright')) return { source: 'mls-mapright', embedType: 'iframe', professional: true }
  }

  // URL pattern heuristics
  if (u.includes('vimeo.com')) return { source: 'mls-vimeo', embedType: 'iframe', professional: true }
  if (u.includes('youtube.com') || u.includes('youtu.be')) {
    return { source: 'mls-youtube', embedType: 'iframe', professional: true }
  }
  if (u.includes('cloudflarestream.com') || u.includes('videodelivery.net')) {
    return { source: 'mls-cloudflare-stream', embedType: 'iframe', professional: true }
  }
  if (u.includes('aryeo.com')) {
    return { source: 'mls-aryeo', embedType: 'iframe', professional: true }
  }
  if (u.includes('matterport.com')) {
    return { source: 'mls-matterport', embedType: 'iframe', professional: true }
  }
  if (u.endsWith('.mp4') || u.endsWith('.webm') || u.endsWith('.mov')) {
    return { source: 'mls-direct-mp4', embedType: 'video-tag', professional: true }
  }
  return { source: 'mls-other', embedType: 'iframe', professional: true }
}

async function fetchVideos(listingKey: string): Promise<VideoEmbed[]> {
  InputSchema.parse({ listingKey })
  const supabase = supabaseAnon()
  if (!supabase) return []

  const out: VideoEmbed[] = []
  const seen = new Set<string>()

  // ─── Tier 1: listing_videos (our own publishes) ───────────────────
  const { data: ourRows, error: ourErr } = await supabase
    .from('listing_videos')
    .select('video_url,source,duration_seconds,sort_order')
    .eq('listing_key', listingKey)
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (!ourErr && ourRows && ourRows.length > 0) {
    for (const row of ourRows as ListingVideosRow[]) {
      if (!row.video_url) continue
      const url = row.video_url
      if (seen.has(url)) continue
      seen.add(url)
      const { source, embedType } = classifyVideo(url, row.source)
      out.push({
        source: 'our-render',
        embedType,
        url,
        durationSeconds: row.duration_seconds ?? undefined,
        professional: true,
      })
      void source
    }
  }

  // ─── Tier 2: video_tours_cache (MLS feed, nightly) ────────────────
  // Stored as one row per scope with `listings` JSONB array. The MLS-feed
  // entries carry a {listing_key, video_url, video_source} shape per item.
  const { data: cacheRows, error: cacheErr } = await supabase
    .from('video_tours_cache')
    .select('listings')
    .in('scope', ['central_oregon_home', 'central_oregon_hub'])
  if (!cacheErr && cacheRows) {
    for (const cacheRow of cacheRows as Array<{ listings: CacheListingEntry[] | null }>) {
      const arr = Array.isArray(cacheRow.listings) ? cacheRow.listings : []
      for (const entry of arr) {
        if (!entry || entry.listing_key !== listingKey) continue
        const url = entry.video_url
        if (!url || seen.has(url)) continue
        seen.add(url)
        const { source, embedType } = classifyVideo(url, entry.video_source)
        out.push({
          source,
          embedType,
          url,
          posterUrl: entry.poster_url ?? undefined,
          professional: true,
        })
      }
    }
  }

  // ─── Tier 3: listings.details.Videos JSONB (raw MLS payload) ──────
  // The `listings.details` jsonb sometimes carries a Videos array on
  // luxury listings that haven't propagated to video_tours_cache yet.
  // Fetch the row and inspect the `details->Videos` path.
  const { data: detailRow, error: detailErr } = await supabase
    .from('listings')
    .select('details')
    .eq('"ListingKey"', listingKey)
    .maybeSingle()
  if (!detailErr && detailRow) {
    const details = (detailRow as { details: unknown }).details
    if (details && typeof details === 'object') {
      const videos = (details as Record<string, unknown>).Videos
      if (Array.isArray(videos)) {
        for (const v of videos) {
          if (!v || typeof v !== 'object') continue
          const vid = v as Record<string, unknown>
          const url =
            typeof vid.MediaURL === 'string'
              ? vid.MediaURL
              : typeof vid.VideoURL === 'string'
                ? vid.VideoURL
                : typeof vid.Url === 'string'
                  ? vid.Url
                  : null
          if (!url || seen.has(url)) continue
          seen.add(url)
          const { source, embedType } = classifyVideo(url, typeof vid.Source === 'string' ? vid.Source : null)
          out.push({
            source,
            embedType,
            url,
            professional: true,
          })
        }
      }
    }
  }

  return out
}

export const getListingVideos = (listingKey: string): Promise<VideoEmbed[]> =>
  unstable_cache(
    () => fetchVideos(listingKey),
    ['listing-videos', listingKey],
    {
      revalidate: CACHE_WINDOWS.videos,
      tags: [cacheTag.listing(listingKey), cacheTag.videos],
    }
  )()
