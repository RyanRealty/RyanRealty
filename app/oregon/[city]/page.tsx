// @no-parity — W12 out-of-area referral arm: a light KB page composed entirely
// from the existing KB section library (no new visual language, no mockup).
/**
 * Out-of-area city page (/oregon/[city]) — W12 referral-capture tier.
 *
 * The statewide MLS feed carries ~362 Oregon cities; Ryan Realty's home market
 * is Central Oregon. This LIGHT page serves the valid Oregon cities OUTSIDE
 * that market (Medford, Grants Pass, Klamath Falls, ...): honest copy that
 * says this is not our market, the live inventory through the existing browse
 * machinery, and a referral capture form (geo:out-of-area, nothing auto-sends).
 * The middleware 308s non-service-area /cities/* slugs here; garbage slugs get
 * a real 404 from the guard below (before any streaming boundary).
 *
 * INDEXABILITY (lib/out-of-area-cities.ts policy): only the top
 * OUT_OF_AREA_INDEXABLE_TOP_N cities with >= OUT_OF_AREA_INDEXABLE_MIN_ACTIVE
 * active listings index + enter the sitemap (getOutOfAreaCitySitemapEntries,
 * wired by lane D1). Every other city here renders noindex.
 *
 * DATA ACCURACY (§0): counts + median come from geo_snapshot_mv (the same MV
 * cache the /cities pages read); tiles come from listing_tile_mv via
 * getListingTiles. Nothing aggregates raw listings at request time.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getListingTiles } from '@/lib/data'
import { homesForSalePath } from '@/lib/slug'
import {
  getOutOfAreaCity,
  getIndexableOutOfAreaCities,
  isIndexableOutOfAreaCity,
} from '@/lib/data/geo/getOutOfAreaCities'
import { pageMetadata } from '@/lib/site/page-metadata'
import { withTimeoutFallback } from '@/lib/with-timeout-fallback'
import { resolveFeaturedItems } from '@/lib/kb/resolve-featured-items'
import type { SchemaInput } from '@/lib/site/json-ld'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbAbout } from '@/components/site/kb/KbAbout'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import type { KbTownItem } from '@/components/site/kb/types'
import { KbOutOfAreaReferral } from '@/components/site/kb/KbOutOfAreaReferral.client'
import '@/components/site/kb/kb.css'

type Params = { city: string }

export const dynamicParams = true
export const revalidate = 3600

export async function generateStaticParams(): Promise<Array<{ city: string }>> {
  // Seed the indexable top set (>= 5 active, top 25 by count). Long-tail
  // out-of-area cities SSR on demand via dynamicParams and render noindex.
  const indexable = await getIndexableOutOfAreaCities()
  return indexable.map((c) => ({ city: c.slug }))
}

function normalizeSlug(raw: string): string {
  let s = raw
  try {
    s = decodeURIComponent(raw)
  } catch {
    /* raw */
  }
  return s.toLowerCase().trim()
}

const usd = (n: number): string => `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { city: raw } = await params
  const slug = normalizeSlug(raw)
  const city = await getOutOfAreaCity(slug)
  if (!city) {
    return pageMetadata({
      title: 'City not found',
      description: "We don't have a page for this Oregon city.",
      path: `/oregon/${slug}`,
      noindex: true,
    })
  }
  const indexable = await isIndexableOutOfAreaCity(slug)
  return pageMetadata({
    title: `Homes for sale in ${city.name}, Oregon`,
    description: `Browse ${city.activeAllCount} live ${city.name} listings from the statewide MLS feed. ${city.name} is outside our Central Oregon home market, so we introduce you to a local broker we would use ourselves.`,
    path: `/oregon/${city.slug}`,
    noindex: !indexable,
  })
}

export default async function OutOfAreaCityPage({ params }: { params: Promise<Params> }) {
  const { city: raw } = await params
  const slug = normalizeSlug(raw)

  // Guard FIRST, before anything streams: an unknown slug is a REAL 404
  // (the middleware sends junk /cities/* slugs here expecting exactly that).
  const city = await getOutOfAreaCity(slug)
  if (!city) notFound()

  const pagePath = `/oregon/${city.slug}`

  const [tiles, indexableCities] = await Promise.all([
    // Live inventory via the existing browse machinery (listing_tile_mv). The
    // explicit city predicate exempts the service-area allowlist by design.
    withTimeoutFallback(
      getListingTiles({ city: city.name, status: 'active', limit: 12, sort: 'newest' }),
      [] as Awaited<ReturnType<typeof getListingTiles>>,
      5000,
      'oregon-city:tiles',
    ),
    withTimeoutFallback(
      getIndexableOutOfAreaCities(),
      [] as Awaited<ReturnType<typeof getIndexableOutOfAreaCities>>,
      4000,
      'oregon-city:index',
    ),
  ])

  const featuredItems = await resolveFeaturedItems(tiles, 12)

  // Cross-navigation: the other top out-of-area markets (live counts from the
  // same MV read), so the referral tier interlinks instead of dead-ending.
  const otherCities: KbTownItem[] = indexableCities
    .filter((c) => c.slug !== city.slug)
    .slice(0, 8)
    .map((c) => ({
      name: `${c.name} · Oregon`,
      href: `/oregon/${c.slug}`,
      activeCount: c.activeAllCount,
      medianPrice: c.medianListPrice,
      img: '',
    }))

  // ── Structured data (JSON-LD). §0: every stat from geo_snapshot_mv. ──────
  const datasetStats: Array<{ name: string; value: string | number; unitText?: string }> = [
    { name: 'Active listings (all property types)', value: city.activeAllCount, unitText: 'listings' },
    { name: 'Active single-family listings', value: city.activeSfrCount, unitText: 'listings' },
  ]
  if (city.medianListPrice != null) {
    datasetStats.push({ name: 'Median active list price (single-family)', value: city.medianListPrice, unitText: 'USD' })
  }
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Oregon', url: '/cities' },
        { name: city.name, url: pagePath },
      ],
    },
    {
      type: 'place',
      name: `${city.name}, Oregon`,
      description: `Live MLS inventory for ${city.name}, Oregon, with a broker referral service from Ryan Realty.`,
      url: pagePath,
      address: { state: 'OR', country: 'US' },
    },
    {
      type: 'dataset',
      name: `Active listing snapshot for ${city.name}, Oregon`,
      description: `Live counts for active MLS listings in ${city.name}, Oregon. Sourced from the statewide Oregon MLS feed via Ryan Realty.`,
      url: pagePath,
      spatialCoverageName: `${city.name} · Oregon`,
      variableMeasured: datasetStats,
    },
  ]

  const aboutFacts = [
    { label: 'Active listings', value: city.activeAllCount.toLocaleString('en-US') },
    { label: 'Single-family active', value: city.activeSfrCount.toLocaleString('en-US') },
    ...(city.medianListPrice != null ? [{ label: 'Median list (SFR)', value: usd(city.medianListPrice) }] : []),
    { label: 'Our home market', value: 'Central Oregon' },
  ]

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="out-of-area-city" />
      <MetadataBlock schemas={schemas} />
      <KbBreadcrumb
        overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Cities', href: '/cities' },
          { label: city.name },
        ]}
      />
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: city.activeAllCount > 0 ? city.activeAllCount : null,
            medianListPrice: city.medianListPrice,
            medianDaysToPending: null,
          }}
          eyebrow={`${city.name.toUpperCase()} · OREGON`}
          titleTop="Homes for sale in"
          titleBottom={city.name}
          lead={`in ${city.name}, Oregon, outside Ryan Realty's Central Oregon market.`}
          videoSrc={null}
          posterSrc="/images/homepage/smith-rock-terrebonne.jpg"
        />

        {/* The honest block: this is not our market, here is what we do instead. */}
        <KbAbout
          eyebrow="Outside our home market"
          heading={`We don't work in ${city.name}`}
          paragraphs={[
            `Ryan Realty works Central Oregon. Our brokers live in Bend and cover the towns around it, from Redmond and Sisters to Sunriver and La Pine. ${city.name} is outside that area.`,
            `Our MLS feed is statewide, so the ${city.name} listings on this page are live and current.`,
            `If you are buying or selling in ${city.name}, a broker who works that market every day will know it better than we do. Tell us what you need and we will introduce you to one we would use ourselves. No cost, no obligation.`,
          ]}
          facts={aboutFacts}
        />

        {featuredItems.length > 0 ? (
          <KbFeatured
            items={featuredItems}
            eyebrow={`${city.name} · For sale`}
            viewAllHref={homesForSalePath(city.name)}
            viewAllLabel={`See every ${city.name} home for sale`}
            totalCount={city.activeAllCount ?? null}
          />
        ) : null}

        {/* Referral capture — geo:out-of-area, nothing auto-sends. */}
        <KbOutOfAreaReferral citySlug={city.slug} cityName={city.name} />

        {otherCities.length > 0 ? (
          <KbExploreTowns
            towns={otherCities}
            eyebrow="Other Oregon markets"
            title="More Oregon cities"
            sectionId="other-markets"
            cta={{ href: '/cities', label: 'Our Central Oregon cities' }}
          />
        ) : null}

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
