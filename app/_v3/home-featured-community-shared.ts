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

export const HOME_FEATURED_COMMUNITY_SOURCE = publicMarketPulseSource(
  'Alias-aware active inventory and median list for each resort community.',
)
