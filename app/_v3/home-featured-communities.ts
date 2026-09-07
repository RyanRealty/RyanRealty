/**
 * Home `/` featured community carousel slides — server loader + builders.
 *
 * Photo + sales figures + short blurb only. Figures come from the alias-aware
 * resort index overlay (same set `/communities/{slug}` prints) and optional
 * MarketPulse fields when present. No invented counts or prices.
 *
 * server-only: keep node:fs (via resort-community-content) off the client
 * graph. Client island imports types/SOURCE from home-featured-community-shared.
 */

import 'server-only'

import { firstSentence } from '@/app/cities/_v3/cities-index-constants'
import { belongingLine } from '@/app/communities/_v3/community-index-rows'
import { firstAboutParagraph } from '@/app/communities/[slug]/_v3/community-opening'
import type { RegistryResortPublicFigures } from '@/lib/kb/registry-resort-public-figures'
import type { MarketPulse } from '@/lib/data/types/market'
import { formatCount } from '@/lib/format/count'
import { formatPriceExact } from '@/lib/format/money'
import { communityImage } from '@/lib/geo-images'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import type { ResortCommunityEntry } from '@/lib/data/communities/registry'
import type { ResortCommunityContent } from '@/lib/resort-community-content'
import {
  HOME_FEATURED_COMMUNITY_SOURCE,
  type HomeFeaturedCommunityFigure,
  type HomeFeaturedCommunitySlide,
} from './home-featured-community-shared'

export type { HomeFeaturedCommunityFigure, HomeFeaturedCommunitySlide }
export { HOME_FEATURED_COMMUNITY_SOURCE }

/** Curated Home featured set. Registry + dedicated photo only; miss omits. */
export const HOME_FEATURED_COMMUNITY_SLUGS = [
  'tetherow',
  'caldera-springs',
  'broken-top',
  'northwest-crossing',
  'eagle-crest',
  'brasada-ranch',
  'awbrey-glen',
  'sunriver',
  'crosswater',
  'widgi-creek',
] as const

export type HomeFeaturedCommunityBuildInput = {
  entry: ResortCommunityEntry
  content: ResortCommunityContent | null
  figures: RegistryResortPublicFigures | null | undefined
  pulse: MarketPulse | null | undefined
  photoSrc?: string | null
}

/** One sales figure only when the source published a positive value. */
export function homeFeaturedSalesFigures(input: {
  figures: RegistryResortPublicFigures | null | undefined
  pulse: MarketPulse | null | undefined
}): HomeFeaturedCommunityFigure[] {
  const out: HomeFeaturedCommunityFigure[] = []
  const active = input.figures?.activeCount
  if (active != null && Number.isFinite(active) && active > 0) {
    out.push({
      value: formatCount(active),
      label: active === 1 ? 'home for sale' : 'homes for sale',
    })
  }
  const median = input.figures?.medianListPrice
  if (median != null && Number.isFinite(median) && median > 0) {
    out.push({
      value: formatPriceExact(median),
      label: 'median list price',
    })
  }
  const closed = input.pulse?.closedLast30Days
  if (closed != null && Number.isFinite(closed) && closed > 0) {
    out.push({
      value: formatCount(closed),
      label: closed === 1 ? 'home sold, last 30 days' : 'homes sold, last 30 days',
    })
  }
  const fresh = input.pulse?.newThisWeek
  if (fresh != null && Number.isFinite(fresh) && fresh > 0) {
    out.push({
      value: formatCount(fresh),
      label: 'new this week',
    })
  }
  const days = publishDaysFigure(input.pulse?.medianDaysToPending ?? null)
  if (days) {
    out.push({
      value: days,
      label: 'days to an offer',
    })
  }
  return out
}

/** Short authored blurb. Miss omits. Never invents place copy. */
export function homeFeaturedBlurb(
  content: ResortCommunityContent | null,
  entry: ResortCommunityEntry,
): string | null {
  const about = firstAboutParagraph(content?.aboutProse ?? [])
  if (about) {
    const short = firstSentence(about)
    return short || about
  }
  const belonging = belongingLine(content)
  if (belonging) return belonging
  const character = entry.character?.trim()
  if (character) return firstSentence(character) || character
  const description = entry.description?.trim()
  if (description) return firstSentence(description) || description
  return null
}

/**
 * Build one slide. Requires a dedicated community photo and a registry entry.
 * Sales figures may be empty when overlay/pulse miss — still show place + blurb.
 */
export function buildHomeFeaturedCommunitySlide(
  input: HomeFeaturedCommunityBuildInput,
): HomeFeaturedCommunitySlide | null {
  const name = input.entry.label?.trim()
  const slug = input.entry.slug?.trim()
  if (!name || !slug) return null
  const photoSrc = (input.photoSrc ?? communityImage(slug))?.trim() || null
  if (!photoSrc) return null
  const city = input.entry.city?.trim() || 'Central Oregon'
  return {
    slug,
    name,
    city,
    href: `/communities/${slug}`,
    photoSrc,
    blurb: homeFeaturedBlurb(input.content, input.entry),
    figures: homeFeaturedSalesFigures({
      figures: input.figures,
      pulse: input.pulse,
    }),
  }
}

export function buildHomeFeaturedCommunitySlides(
  inputs: readonly HomeFeaturedCommunityBuildInput[],
): HomeFeaturedCommunitySlide[] {
  const out: HomeFeaturedCommunitySlide[] = []
  for (const input of inputs) {
    const slide = buildHomeFeaturedCommunitySlide(input)
    if (slide) out.push(slide)
  }
  return out
}

/** Server loader for Home. Misses omit. Parallel pulse reads. */
export async function loadHomeFeaturedCommunitySlides(): Promise<HomeFeaturedCommunitySlide[]> {
  const { getResortCommunityBySlug } = await import('@/lib/data/communities/registry')
  const { getRegistryResortPublicFigures } = await import('@/lib/kb/registry-resort-public-figures')
  const { getResortCommunityContent } = await import('@/lib/resort-community-content')
  const { getMarketPulse } = await import('@/lib/data')

  const figuresByKey = await getRegistryResortPublicFigures().catch(
    () => new Map<string, RegistryResortPublicFigures>(),
  )
  const inputs = await Promise.all(
    HOME_FEATURED_COMMUNITY_SLUGS.map(
      async (slug): Promise<HomeFeaturedCommunityBuildInput | null> => {
        const entry = getResortCommunityBySlug(slug)
        if (!entry) return null
        const [content, pulse] = await Promise.all([
          getResortCommunityContent(slug).catch(() => null),
          getMarketPulse({ geoType: 'community', geoSlug: slug }).catch(() => null),
        ])
        return {
          entry,
          content,
          figures: figuresByKey.get(slug) ?? null,
          pulse,
        }
      },
    ),
  )
  return buildHomeFeaturedCommunitySlides(
    inputs.filter((row): row is HomeFeaturedCommunityBuildInput => row != null),
  )
}
