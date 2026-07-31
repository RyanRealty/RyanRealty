/**
 * Curated per-city config for the KB city page (app/cities/[slug]/page.tsx):
 * the scenic hero B-roll and the marquee community cards.
 *
 * Both are hand-maintained tables keyed by city slug, kept out of the page so
 * the page reads as orchestration + render. Every path is a verified file under
 * public/ or a resolved entry in data/city-hero-videos.resolved.json (§0 — never
 * a guessed asset path).
 */

import communityVideoManifest from '@/data/city-hero-videos.resolved.json'

type VideoManifestEntry = { scope?: string; video?: string; poster?: string }

const VIDEO_MANIFEST = communityVideoManifest as Record<string, VideoManifestEntry | undefined>

/**
 * Each city's scenic hero B-roll (Mt Bachelor for Bend, Sparks Lake for
 * Sunriver, ...), produced by scripts/sync-city-videos.mjs into
 * public/videos/cities/ and recorded in data/city-hero-videos.resolved.json
 * (scope:'cities'). It renders as the muted, looping <KbHero> background over
 * its poster still. A city without a clean B-roll clip is absent here and falls
 * back to its verified cityHero photo.
 */
export const CITY_HERO_VIDEO: Record<string, { videoSrc: string; posterSrc: string }> = Object.fromEntries(
  Object.entries(VIDEO_MANIFEST)
    .filter(([, v]) => v?.scope === 'cities' && v.video && v.poster)
    .map(([slug, v]) => [slug, { videoSrc: v!.video as string, posterSrc: v!.poster as string }]),
)

/**
 * Marquee communities per city (hand-picked still + silent Area Guide clip).
 * These float to the front of the communities rail; the rest of the city's
 * communities follow by active count. `match` is a lowercase substring tested
 * against the MLS subdivision name, resolved against LIVE counts from
 * getCommunitiesForIndex — this table supplies imagery only, never a figure.
 */
export const CITY_MARQUEE_COMMUNITIES: Record<string, { match: string; img: string; videoSlug?: string }[]> = {
  bend: [
    { match: 'tetherow', img: '/images/kb/tetherow-golf-aerial.jpg', videoSlug: 'tetherow' },
    { match: 'broken top', img: '/images/kb/broken-top.jpg', videoSlug: 'broken-top' },
    { match: 'northwest crossing', img: '/images/kb/northwest-crossing.jpg', videoSlug: 'northwest-crossing' },
  ],
  sunriver: [{ match: 'caldera', img: '/images/kb/caldera-springs.jpg', videoSlug: 'caldera-springs' }],
}

/** Resolved Area Guide clip URL for a manifest slug, or null when it has none. */
export function communityVideoUrl(videoSlug?: string): string | null {
  if (!videoSlug) return null
  return VIDEO_MANIFEST[videoSlug]?.video ?? null
}
