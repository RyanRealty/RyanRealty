/**
 * Client-safe Home featured community types + source line.
 * Keep node:fs / resort-community-content out of this module — the client
 * island imports from here only. Builders + loader live in
 * home-featured-communities.ts (server-only).
 */

import { publicMarketPulseSource } from '@/lib/market/publish-public-methodology'

export type HomeFeaturedCommunityFigure = {
  value: string
  label: string
  /** Sourced magnitude for Rare UI / beUI AnimatedNumber. Omit when unmeasured. */
  n?: number
}

export type HomeFeaturedCommunitySlide = {
  slug: string
  name: string
  city: string
  href: string
  photoSrc: string
  blurb: string | null
  figures: HomeFeaturedCommunityFigure[]
}

/*
 * VOICE-6 (visibility audit 2026-09-22): this line read "Alias-aware active
 * inventory and median list for each resort community." "Alias-aware" is our
 * word for counting every MLS subdivision name a community goes by, so the
 * sentence now says that in the reader's words. It covers only the two figures
 * that count that way (lib/kb/registry-resort-public-figures.ts, active
 * single-family tiles); the sales, new-this-week and days figures come from the
 * community's MarketPulse row, which the prefix already names.
 */
export const HOME_FEATURED_COMMUNITY_SOURCE = publicMarketPulseSource(
  "Homes for sale and the median list price count every single-family listing the MLS files under any of the community's subdivision names.",
)
