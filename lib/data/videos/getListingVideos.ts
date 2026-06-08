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

import { unstable_cache } from 'next/cache'
import { z } from 'zod'
import { CACHE_WINDOWS, cacheTag } from '@/lib/data/cache/unstable-cache'
import { supabaseAnon } from '@/lib/data/client'
import { parseListingVideoEmbedForTile, isDirectListingVideoFileUrl } from '@/lib/video-embed'
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
 * Pull an `iframe src="..."` URL out of an MLS-supplied ObjectHtml
 * payload. The RETS Spark feed wraps the video reference in an iframe
 * HTML snippet (typical pattern: `<iframe src="https://player.vimeo.com/video/123" ...>`).
 * Returns the unescaped URL, or null if no iframe was found.
 */
function extractIframeSrc(html: string): string | null {
  const m = /<iframe[^>]+src\s*=\s*["']([^"']+)["']/i.exec(html)
  if (!m) return null
  // Spark double-encodes ampersands inside the HTML — convert &amp; back to &
  // so the embed URL stays browser-loadable.
  return m[1].replace(/&amp;/g, '&')
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

/** Rank an MLS VirtualTours entry: unbranded first (no competitor chrome),
 *  then branded, then unknown. Lower = preferred. */
function virtualTourRank(t: unknown): number {
  if (!t || typeof t !== 'object') return 3
  const type = String((t as Record<string, unknown>).Type ?? '').toLowerCase()
  if (type === 'unbranded') return 0
  if (type === 'branded') return 1
  return 2
}

/**
 * Derive a raw video URL from an MLS `details.Videos` entry. The RETS Spark feed
 * stores the reference under `ObjectHtml`, which may be an <iframe> snippet, an
 * <a> link, OR a BARE URL (Dropbox, Aryeo). The previous code only handled the
 * <iframe> case via extractIframeSrc, silently dropping ~half of listing videos
 * — including the $48.56M (Dropbox) and $21M (Aryeo) flagships.
 */
function deriveRawUrl(vid: Record<string, unknown>): string | null {
  for (const f of ['MediaURL', 'VideoURL', 'Url'] as const) {
    const v = vid[f]
    if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) return v.trim()
  }
  const oh = vid.ObjectHtml
  if (typeof oh === 'string') {
    const html = oh.trim()
    const iframe = extractIframeSrc(html)
    if (iframe) return iframe
    const a = /<a[^>]+href\s*=\s*["']([^"']+)["']/i.exec(html)
    if (a) return a[1].replace(/&amp;/g, '&')
    if (/^(?:https?:)?\/\/\S+$/i.test(html)) return html.replace(/&amp;/g, '&')
  }
  return null
}

/**
 * Normalize a raw URL into an embeddable form + render mode:
 *   - 'iframe'    YouTube/Vimeo/Matterport (canonical embed src) + Aryeo/Cloudflare
 *   - 'video-tag' direct progressive file (.mp4/.webm/.mov)
 *   - 'link'      hosts that block framing (Dropbox sends x-frame-options) → watch link
 * Returns null to drop the entry (MapRight parcel maps are not walkthrough videos).
 */
export function normalizeEmbed(
  raw: string | null,
  hintSource?: string | null,
): { url: string; embedType: 'iframe' | 'video-tag' | 'link'; posterUrl?: string } | null {
  if (!raw) return null
  let url = raw.trim()
  if (url.startsWith('//')) url = `https:${url}`
  if (!/^https?:\/\//i.test(url)) return null
  const low = url.toLowerCase()
  const hint = (hintSource ?? '').toLowerCase()

  if (low.includes('mapright') || hint.includes('mapright')) return null

  // Dropbox FIRST (before the generic .mp4 check): it blocks IFRAME framing, and
  // www.dropbox.com/<file>.mp4 serves an HTML PREVIEW, not the file — so the raw
  // share URL is useless in a <video> tag. If the link points at a video FILE,
  // rewrite to dl.dropboxusercontent.com (+ raw=1) which serves it inline, so it
  // becomes a proper SHOWCASE HERO instead of a buried watch-link. (Matt: listing
  // pages must use the tour video like a showcase listing.) Folders stay a link.
  if (low.includes('dropbox.com')) {
    if (/\.(mp4|m4v|mov|webm)(\?|$)/i.test(low)) {
      let direct = url.replace(/:\/\/(?:www\.)?dropbox\.com/i, '://dl.dropboxusercontent.com')
      direct = direct.replace(/([?&])dl=0\b/i, '$1raw=1')
      if (!/[?&](?:dl|raw)=/i.test(direct)) direct += (direct.includes('?') ? '&' : '?') + 'raw=1'
      return { url: direct, embedType: 'video-tag' }
    }
    return { url, embedType: 'link' }
  }

  // Google Drive: agents often "host" a tour as a Drive video FILE. The /view
  // share URL blocks framing and is not a playable file, but /preview embeds a
  // player iframe. Rewrite file/d/<id>/... -> file/d/<id>/preview. (Sutherland's
  // tour, and other agent-uploaded tour videos, live here.)
  const gdrive = url.match(/drive\.google\.com\/file\/d\/([A-Za-z0-9_-]+)/)
  if (gdrive) return { url: `https://drive.google.com/file/d/${gdrive[1]}/preview`, embedType: 'iframe' }

  const parsed = parseListingVideoEmbedForTile(url)
  if (parsed) return { url: parsed.src, embedType: 'iframe', posterUrl: parsed.posterUrl ?? undefined }

  if (isDirectListingVideoFileUrl(url)) return { url, embedType: 'video-tag' }

  // Hosted players + 3D tours that allow framing (Aryeo verified framable
  // 2026-05-31; Matterport + Zillow 3D Home view-imx are built for MLS/IDX
  // embedding, so they stay ON-site in an iframe rather than sending the
  // visitor off to a competitor — important since these arrive via
  // details.VirtualTours).
  if (
    low.includes('aryeo.com') ||
    low.includes('cloudflarestream.com') ||
    low.includes('videodelivery.net') ||
    low.includes('player.vimeo.com') ||
    low.includes('matterport.com') ||
    low.includes('zillow.com/view-imx')
  ) {
    return { url, embedType: 'iframe' }
  }

  // Anything unrecognized: frame-blocked → watch link, never a broken iframe.
  return { url, embedType: 'link' }
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
  let resolved = (await supabase
    .from('listings')
    .select('ListingKey, details')
    .eq('ListNumber', listingKey)
    .maybeSingle()).data as { ListingKey?: string | null; details?: unknown } | null
  if (!resolved) {
    resolved = (await supabase
      .from('listings')
      .select('ListingKey, details')
      .eq('ListingKey', listingKey)
      .maybeSingle()).data as { ListingKey?: string | null; details?: unknown } | null
  }
  const canonicalKey = String(resolved?.ListingKey ?? listingKey).trim()

  const out: VideoEmbed[] = []
  const seen = new Set<string>()

  // ─── Tier 1: listing_videos (our own publishes) ───────────────────
  const { data: ourRows, error: ourErr } = await supabase
    .from('listing_videos')
    .select('video_url,source,duration_seconds,sort_order')
    .eq('listing_key', canonicalKey)
    .order('sort_order', { ascending: true, nullsFirst: false })
  if (!ourErr && ourRows && ourRows.length > 0) {
    for (const row of ourRows as ListingVideosRow[]) {
      if (!row.video_url) continue
      const url = row.video_url
      if (seen.has(url)) continue
      seen.add(url)
      const norm = normalizeEmbed(url, row.source)
      if (!norm) continue
      out.push({
        source: 'our-render',
        embedType: norm.embedType,
        url: norm.url,
        posterUrl: norm.posterUrl,
        durationSeconds: row.duration_seconds ?? undefined,
        professional: true,
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
        const url = entry.video_url
        if (!url || seen.has(url)) continue
        seen.add(url)
        const norm = normalizeEmbed(url, entry.video_source)
        if (!norm) continue
        out.push({
          source: classifyVideo(norm.url, entry.video_source).source,
          embedType: norm.embedType,
          url: norm.url,
          posterUrl: entry.poster_url ?? norm.posterUrl,
          professional: true,
        })
      }
    }
  }

  // ─── Tier 3: listings.details.Videos JSONB (raw MLS payload) ──────
  // The `listings.details` jsonb sometimes carries a Videos array on
  // luxury listings that haven't propagated to video_tours_cache yet.
  // Fetch the row and inspect the `details->Videos` path.
  {
    const details = resolved?.details
    if (details && typeof details === 'object') {
      const videos = (details as Record<string, unknown>).Videos
      if (Array.isArray(videos)) {
        for (const v of videos) {
          if (!v || typeof v !== 'object') continue
          const vid = v as Record<string, unknown>
          // The MLS RETS feed stores the canonical video under `ObjectHtml`,
          // which is an <iframe> snippet for some videographers but a BARE URL
          // (Dropbox, Aryeo) for others. deriveRawUrl handles all shapes;
          // normalizeEmbed picks the embeddable form (or a watch-link).
          const raw = deriveRawUrl(vid)
          if (!raw || seen.has(raw)) continue
          seen.add(raw)
          const hint = typeof vid.Source === 'string' ? vid.Source : null
          const norm = normalizeEmbed(raw, hint)
          if (!norm) continue
          out.push({
            source: classifyVideo(norm.url, hint).source,
            embedType: norm.embedType,
            url: norm.url,
            posterUrl: norm.posterUrl,
            professional: true,
          })
        }
      }

      // ─── Tier 4: virtual TOURS (distinct from videos) ─────────────────
      // Matt: "listing videos and virtual tours are different." Walkthrough
      // VIDEOS live in details.Videos (above); 3D / Matterport / Zillow-3D /
      // Google-Drive TOURS live in THREE other places. Read all, unbranded
      // first, deduped, and tag isVirtualTour so the page can show them in a
      // dedicated tour viewer:
      //   1. details.VirtualTourURLUnbranded — a SCALAR default field, the most
      //      reliable (present even when the VirtualTours expansion never synced;
      //      ~298 active listings the site previously ignored entirely).
      //   2. details.VirtualTours[].Uri — the expansion array.
      //   3. details.VirtualTourURLBranded — fallback (carries agency chrome).
      const det = details as Record<string, unknown>
      const tourCandidates: string[] = []
      const pushTour = (v: unknown) => {
        if (typeof v === 'string' && /^https?:\/\//i.test(v.trim())) tourCandidates.push(v.trim())
      }
      pushTour(det.VirtualTourURLUnbranded)
      if (Array.isArray(det.VirtualTours)) {
        for (const t of [...det.VirtualTours].sort((a, b) => virtualTourRank(a) - virtualTourRank(b))) {
          if (t && typeof t === 'object') pushTour((t as Record<string, unknown>).Uri)
        }
      }
      pushTour(det.VirtualTourURLBranded)
      for (const raw of tourCandidates) {
        if (seen.has(raw)) continue
        seen.add(raw)
        const norm = normalizeEmbed(raw, 'virtual-tour')
        if (!norm) continue
        out.push({
          source: classifyVideo(norm.url).source,
          embedType: norm.embedType,
          url: norm.url,
          posterUrl: norm.posterUrl,
          professional: true,
          isVirtualTour: true,
        })
      }
    }
  }

  return out
}

export const getListingVideos = (listingKey: string): Promise<VideoEmbed[]> =>
  unstable_cache(
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
    ['listing-videos-v8', listingKey],
    {
      revalidate: CACHE_WINDOWS.videos,
      tags: [cacheTag.listing(listingKey), cacheTag.videos],
    }
  )()
