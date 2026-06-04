import { HeroBlock } from '@/components/site/HeroBlock'
import { GolfCommunityCards } from './GolfCommunityCards'
import { GolfStatBand } from './GolfStatBand'
import { GolfHomesGrid } from './GolfHomesGrid'
import { GolfFaq } from './GolfFaq'
import { GolfCtaBand } from './GolfCtaBand'
import { GOLF_COMMUNITIES, GOLF_STAT_BAND, GOLF_FAQ } from '@/data/golf-landing'
import type { GolfCommunity } from '@/data/golf-landing'
import type { ListingCardData } from '@/components/site/ListingCard'

/**
 * GolfLanding — server component that composes the immersive golf
 * landing page from modular section components.
 *
 * Section order per client-approved immersive direction:
 *   1. Hero (HeroBlock)
 *   2. Community image cards (GolfCommunityCards)
 *   3. Navy stat band (GolfStatBand)
 *   4. Active golf homes grid (GolfHomesGrid)
 *   5. FAQ with FAQPage JSON-LD (GolfFaq)
 *   6. Closing CTA band (GolfCtaBand)
 *
 * The route owner wires the route branch and passes data via props.
 * This component does not fetch — all data arrives as props.
 *
 * Props:
 *   city         — city name for the hero headline, null = Central Oregon
 *   heroImage    — hero photo URL, null = default brand hero
 *   communities  — GolfCommunity[] for the community cards section
 *   homes        — ListingCardData[] for the active homes grid
 *   totalHomes   — total count of golf-course homes (may exceed homes.length if paginated)
 *   allHomesHref — href for "View all X golf homes" button and CTA band
 */

type Props = {
  city: string | null
  heroImage: string | null
  communities: GolfCommunity[]
  homes: ListingCardData[]
  totalHomes: number
  allHomesHref: string
}

/** Community chips for the hero chip nav row. */
const HERO_CHIPS = GOLF_COMMUNITIES.slice(0, 6).map((c) => ({
  label: c.name,
  href: c.communityHref,
}))

export function GolfLanding({
  city,
  heroImage,
  communities,
  homes,
  totalHomes,
  allHomesHref,
}: Props) {
  const cityLabel = city ?? 'Central Oregon'

  const headline = `Golf homes in ${cityLabel}`

  const lede = `${totalHomes > 0 ? `${totalHomes} active golf homes across Central Oregon golf communities.` : 'Golf-course and golf-view homes across Central Oregon golf communities.'} Eleven communities, from Bend to Sisters to Sunriver.`

  const heroPhoto = heroImage
    ? { src: heroImage, alt: `Golf course fairway in ${cityLabel}`, priority: true as const }
    : undefined

  return (
    <>
      {/* 1. Hero */}
      <HeroBlock
        headline={headline}
        lede={lede}
        photo={heroPhoto}
        chips={HERO_CHIPS}
        minHeight={640}
        overlayBottomOpacity={0.72}
      />

      {/* 2. Community image cards */}
      <GolfCommunityCards communities={communities} />

      {/* 3. Navy stat band */}
      <GolfStatBand stats={GOLF_STAT_BAND} />

      {/* 4. Active golf homes grid */}
      <GolfHomesGrid
        homes={homes}
        totalHomes={totalHomes}
        allHomesHref={allHomesHref}
      />

      {/* 5. FAQ with FAQPage JSON-LD */}
      <GolfFaq items={GOLF_FAQ} />

      {/* 6. Closing CTA band */}
      <GolfCtaBand allHomesHref={allHomesHref} totalHomes={totalHomes} />
    </>
  )
}
