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
 *   3. listings.details.Videos JSONB        — raw MLS marketing-video payload
 *   4. listings.details.VirtualTours JSONB  — 3D / Matterport / Zillow-3D tours
 *
 * Tiers 3+4 are the ONE canonical place every listing's media lives (the MLS
 * payload in listings.details). The site previously read Videos but NEVER
 * VirtualTours, so a home with a 3D tour and no marketing video showed nothing
 * even though the tour URL was sitting in details.VirtualTours[].Uri.
 *
 * Returns the union, deduplicated by URL.
 */

import { z } from 'zod'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { makeResilientCached } from '@/lib/data/cache/resilient'
import { supabaseAnon } from '@/lib/data/client'
import type { VideoEmbed } from '@/lib/data/types/video'
import {
  createListingVideoCollector,
  latestMediaHistoryDates,
  mlsDetailsVideoCandidates,
  needsMediaHistoryDate,
  type MediaHistoryDates,
} from '@/lib/listing/listing-video-assembly'

// normalizeEmbed moved to the pure (client-safe) lib/video-embed module so the
// VideoListingCard client component can resolve a scalar tour URL to the same
// CSP-safe embed without pulling next/cache into the browser bundle. Re-exported
// here so every existing `import { normalizeEmbed } from './getListingVideos'`
// (incl. the test) keeps working unchanged.
export { normalizeEmbed } from '@/lib/video-embed'

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
 * The uncached read behind getListingVideos, for a caller that wraps it in its
 * own cache (getListingCardVideo caches only the one reel a card plays). It
 * THROWS on a transient error, so a wrapper can tell a genuine "no video" from
 * a failed read instead of caching the empty. One listing per call: every
 * listings read below is narrowed by ListNumber or ListingKey (TOAST discipline).
 */
export async function fetchListingVideosUncached(listingKey: string): Promise<VideoEmbed[]> {
  return fetchVideos(listingKey)
}

async function fetchVideos(listingKey: string): Promise<VideoEmbed[]> {
  InputSchema.parse({ listingKey })
  const supabase = supabaseAnon()
  if (!supabase) return []

  // Resolve the row by EITHER the MLS ListNumber (carried by canonical
  // /homes-for-sale pretty URLs) OR the RETS ListingKey, so every tier below
  // keys off the canonical ListingKey. The prior code keyed all three tiers by
  // ListingKey only — a ListNumber matched nothing — so listing videos (our pro
  // renders + MLS tours) never loaded on the pretty URLs (every listing page)
  // and the video hero silently fell back to photos. ListNumber first = one
  // query for the common pretty-URL case; it also feeds Tier 3 (details.Videos).
  // THROW on a transient error from the core listings lookup (vs returning the
  // empty result): this row is the source of Tier 3/4 (the real video + tour
  // payload), so an error here would otherwise yield [] and unstable_cache would
  // poison-cache the blank video hero for the whole videos window. The v6-v9 key
  // bumps were repeatedly hand-evicting exactly these poisoned empties.
  const byNumber = await supabase
    .from('listings')
    .select('ListingKey, details, media_suppressed')
    .eq('ListNumber', listingKey)
    .maybeSingle()
  if (byNumber.error) throw new Error(`getListingVideos resolve by ListNumber ${listingKey}: ${byNumber.error.message}`)
  let resolved = byNumber.data as { ListingKey?: string | null; details?: unknown; media_suppressed?: boolean | null } | null
  if (!resolved) {
    const byKey = await supabase
      .from('listings')
      .select('ListingKey, details, media_suppressed')
      .eq('ListingKey', listingKey)
      .maybeSingle()
    if (byKey.error) throw new Error(`getListingVideos resolve by ListingKey ${listingKey}: ${byKey.error.message}`)
    resolved = byKey.data as { ListingKey?: string | null; details?: unknown; media_suppressed?: boolean | null } | null
  }
  const canonicalKey = String(resolved?.ListingKey ?? listingKey).trim()

  // Owner media-removal request: a media_suppressed listing shows NO videos or
  // virtual tours on the public site (mirrors getListingPhotos). Without this a
  // suppressed listing with a 3D tour / marketing video would still display the
  // home's interior as a video hero, defeating the photo removal. The flag is the
  // durable, sync-proof gate — see migration 20260618121500_add_media_suppressed.sql.
  if (resolved?.media_suppressed === true) return []

  // Dedup by media identity, first copy keeps its place; the later copy lends
  // its Vimeo privacy hash or its MLS date (lib/listing/listing-video-assembly.ts).
  const collector = createListingVideoCollector()
  const pushEmbed = (
    raw: string | null | undefined,
    hint: string | null | undefined,
    extra: Partial<VideoEmbed> = {},
  ): void => collector.push(raw, hint, extra)

  // ─── Tier 1: listing_videos (our own publishes) ───────────────────
  const { data: ourRows, error: ourErr } = await supabase
    .from('listing_videos')
    .select('video_url,source,duration_seconds,sort_order')
    .eq('listing_key', canonicalKey)
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (!ourErr && ourRows && ourRows.length > 0) {
    for (const row of ourRows as ListingVideosRow[]) {
      pushEmbed(row.video_url, row.source, {
        source: 'our-render',
        durationSeconds: row.duration_seconds ?? undefined,
      })
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
        if (!entry || entry.listing_key !== canonicalKey) continue
        pushEmbed(entry.video_url, entry.video_source, entry.poster_url ? { posterUrl: entry.poster_url } : {})
      }
    }
  }

  // ─── Tiers 3 + 4: listings.details Videos, then the virtual TOURS ──
  // details.Videos carries marketing videos (ObjectHtml may be an <iframe>
  // snippet, an <a>, or a BARE URL: Dropbox, Aryeo). Tours live in three
  // other places: the scalar VirtualTourURLUnbranded (the most reliable, ~298
  // active listings the site once ignored), VirtualTours[].Uri (unbranded
  // first), and VirtualTourURLBranded. A tour that is the same media as a Video
  // is dropped by the identity dedup; a walkthrough reel stuffed into
  // VirtualTours (Trailmere Vimeo) is tagged video, not 3D. Each Videos[] /
  // VirtualTours[] object's ModificationTimestamp rides along as uploadDate.
  // The shaping lives in lib/listing/listing-video-assembly.ts so /videos and
  // /sitemaps/video.xml resolve a listing's media the same way.
  // A media record stamped with the feed's 1970 sentinel takes its date from
  // the MLS history when it is the listing's only record of its kind. A failed
  // history read only means no date (and so no VideoObject), never no video.
  let history: MediaHistoryDates = {}
  if (needsMediaHistoryDate(resolved?.details)) {
    const { data: events, error: eventsErr } = await supabase
      .from('listing_history')
      .select('event, event_date')
      .eq('listing_key', canonicalKey)
      .in('event', ['Video', 'VirtualTour'])
      .order('event_date', { ascending: false })
      .limit(100)
    if (!eventsErr && events) history = latestMediaHistoryDates(events as Array<{ event: string | null; event_date: string | null }>)
  }
  collector.pushCandidates(mlsDetailsVideoCandidates(resolved?.details, new Date(), history))

  return collector.list()
}

export const getListingVideos = (listingKey: string): Promise<VideoEmbed[]> =>
  makeResilientCached(
    () => fetchVideos(listingKey),
    // v4 cache-key bump 2026-05-31 — invalidates entries cached before the
    // bare-URL ObjectHtml fix (Dropbox/Aryeo videos were dropped because only
    // <iframe>-wrapped ObjectHtml reached classifyVideo; ~49% of listing
    // videos, incl. the luxury flagships, returned empty arrays).
    // v5 bump 2026-06-01 — re-resolve Dropbox video FILES as inline video-tag
    // (showcase hero) instead of the cached 'link' watch-link.
    // v6 bump 2026-06-08 — invalidate entries cached as [] when the lookup keyed
    // by ListNumber missed the ListingKey-keyed tables (every pretty-URL listing).
    // v7 bump 2026-06-08 — now reads details.VirtualTours (3D/Matterport/Zillow-3D
    // tours); entries cached as [] for the ~280 tour-only listings were poison.
    // v8 bump 2026-06-08 — also reads the scalar VirtualTourURLUnbranded/Branded
    // (the reliable tour source, ~298 listings) + Google-Drive tours; tags
    // isVirtualTour. Entries cached under v7 missed the scalar-only tours.
    // v9 bump 2026-06-08 — dedup by media identity (path, not raw): a tour that
    // is the same Vimeo/YouTube as a Video is no longer shown as a broken
    // duplicate (the tour copy lost Vimeo's privacy hash -> dead player).
    // v10 bump 2026-06-09 — fetchVideos now THROWS on a transient row-resolution
    // error (was: returned [] -> unstable_cache poison-cached the blank video
    // hero, which the v6-v9 bumps kept hand-evicting). makeResilientCached retries
    // once uncached then falls back to [], so a blip recovers next request instead
    // of pinning empty for the videos window. v9 entries may be poisoned.
    // v11 bump 2026-06-18 — media_suppressed gate added (owner media-removal
    // requests); evicts entries cached before the suppression check existed.
    // v12 bump 2026-08-17 — details.Videos 3D / Zillow-pano rows tagged
    // isVirtualTour so the hero Unmute path stays on marketing reels.
    // v13 bump 2026-09-22 — VirtualTours walkthroughs (Vimeo/YouTube/mp4/Drive)
    // are video, not 3D. v12 tagged every VirtualTours URI isVirtualTour: true,
    // so Trailmere's walkthrough never got a Video tab.
    // v14 bump 2026-09-22 — zillow.com/view-3d-home is an iframe tour (same as
    // view-imx). v13 cached it as embedType link, which dropped the 3D tab.
    // v15 bump 2026-09-25 — Vimeo srcs keep the unlisted-video privacy hash
    // (vimeo.com/<id>/<hash> or ?h=). v14 entries hold hashless player srcs,
    // which Vimeo answers with "this video does not exist".
    // v17 bump 2026-10-14 — entries carry uploadDate (the MLS media record's
    // ModificationTimestamp), which the listing VideoObject needs.
    // v16 bump 2026-10-14 — every URL passes cleanListingMediaUrl in
    // normalizeEmbed: a SafeLinks-wrapped link (whose data param named another
    // brokerage's agent by email) is unwrapped, an unreadable wrapper dropped.
    // v15 entries hold the wrapped strings.
    ['listing-videos-v17', listingKey],
    {
      revalidate: CACHE_WINDOWS.videos,
      tags: [cacheTag.listing(listingKey), cacheTag.videos],
    },
    [],
  )()
