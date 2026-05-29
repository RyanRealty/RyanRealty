// brand-voice:exempt
/**
 * Community (resort / master-planned) detail page -- Wave 3 rebuild.
 *
 * Data ONLY through @/lib/data and @/app/actions/communities (getCommunityBySlug).
 * No raw .from() calls. Composes the same site v2 blocks as app/cities/[slug]/page.tsx.
 *
 * Section order (mirrors city page):
 *   1.  BreadcrumbNav
 *   2.  HeroBlock
 *   3.  MarketSnapshot
 *   4.  CommunityDetailBlock (FIX 5)
 *   5.  NeighborhoodMap (FIX 1)
 *   6.  CommunityListingsGrid (FIX 3)
 *   7.  PriceRangeTiles
 *   8.  OpenHousesGrid (FIX 4)
 *   9.  RelatedAreas (communities)
 *   10. ActivityFeed
 *   11. RelatedAreas (cities)
 *   12. ArticleGrid
 *   13. CTABar
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCommunityBySlug } from '@/app/actions/communities'
import {
  getMarketPulse,
  getRecentBlogPosts,
  getGeoTileImages,
  getGeoBoundaryMapData,
  getCommunitySubdivisions,
  getAllCitySnapshots,
  getListingTiles,
  getCommunityListings,
  getResortCommunityBySlug,
} from '@/lib/data'
import type { CommunitySubdivision } from '@/lib/data'
import resortCommunitiesRegistry from '@/data/resort-communities.json' assert { type: 'json' }
import { communityImage, pickGeoImage } from '@/lib/geo-images'
import { getResortCommunityContent } from '@/lib/resort-community-content'
import { pageMetadata } from '@/lib/site/page-metadata'
import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import PriceRangeTiles from '@/components/site/PriceRangeTiles'
import OpenHousesGrid from '@/components/site/OpenHousesGrid'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import ActivityFeed from '@/components/site/ActivityFeed'
import { ArticleGrid } from '@/components/site/ArticleGrid'
import { CTABar } from '@/components/site/CTABar'
import { NeighborhoodMap } from '@/components/site/NeighborhoodMap'
import { Container } from '@/components/site/primitives'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'

export const dynamicParams = true
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ slug: string }>> {
  return []
}

type Props = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) return { title: 'Community Not Found' }

  const desc =
    community.activeCount > 0
      ? `${community.activeCount} homes for sale in ${community.name}. Live market stats, open houses, and local market context for ${community.name} in ${community.city}, Oregon.`
      : `Explore ${community.name} in ${community.city}, Oregon. Market overview and recent activity from a local brokerage.`

  return pageMetadata({
    title: `${community.name} Homes for Sale | ${community.city}, Oregon`,
    description: desc,
    path: `/communities/${slug}`,
  })
}

const CENTRAL_OREGON_CITY_SLUGS = new Set([
  'bend', 'redmond', 'sisters', 'la-pine', 'sunriver',
  'madras', 'prineville', 'culver', 'terrebonne', 'tumalo', 'powell-butte',
])

function tileToCardData(tile: Awaited<ReturnType<typeof getListingTiles>>[number]): ListingCardData {
  const streetNum = tile.streetNumber ?? ''
  const streetName = tile.streetName ?? ''
  const addressLine = [streetNum, streetName].filter(Boolean).join(' ') || 'Address on request'

  const cityParts: string[] = []
  if (tile.city) cityParts.push(tile.city + ', OR')
  if (tile.postalCode) cityParts.push(tile.postalCode)
  if (tile.subdivisionName) cityParts.push(tile.subdivisionName)
  const cityLine = cityParts.join(' · ')

  return {
    listingKey: tile.listingKey,
    href: `/listing/${tile.listingKey}`,
    photoUrl: tile.photoUrl ?? null,
    price: tile.listPrice ?? null,
    addressLine,
    cityLine,
    beds: tile.beds,
    baths: tile.baths,
    sqft: tile.sqft,
    badge:
      tile.status === 'Coming Soon'
        ? { kind: 'new' as const, label: 'Coming Soon' }
        : tile.priceDropCount && tile.priceDropCount > 0
        ? { kind: 'drop' as const, label: 'Price reduced' }
        : undefined,
  }
}

export default async function CommunityDetailPage({ params }: Props) {
  const { slug } = await params
  const community = await getCommunityBySlug(slug)
  if (!community) notFound()

  const cityName = community.city
  const citySlug = community.citySlug

  const [pulse, blogPosts, geoImages, boundaryMapData, allCitySnapshots, communitySubdivisions] =
    await Promise.all([
      getMarketPulse({ geoType: 'neighborhood', geoSlug: slug }).catch(() => null),
      getRecentBlogPosts({ cityName, limit: 3 }).catch(() => []),
      getGeoTileImages([citySlug, slug, 'central-oregon']).catch((): Record<string, string[]> => ({})),
      getGeoBoundaryMapData({ geoType: 'neighborhood', geoSlug: slug }).catch(() => ({ polygon: null, pins: [] })),
      getAllCitySnapshots().catch(() => []),
      getCommunitySubdivisions({ geoType: 'neighborhood', geoSlug: slug }).catch(
        (): CommunitySubdivision[] => [],
      ),
    ])

  // Rich, verified community content (about prose, amenities, drive times,
  // course, HOA) from data/resort-community-[slug].json, the same source the
  // resort landing pages use. Null for communities without an authored config,
  // so those sections simply do not render.
  const content = await getResortCommunityContent(slug).catch(() => null)

  const registryEntry = getResortCommunityBySlug(slug)

  // Homes to LIST as cards (D91). The authoritative set is the homes that
  // physically fall inside the community boundary — the exact same listings the
  // map pins (getGeoBoundaryMapData → listings_in_boundary spatial RPC). We
  // hand ALL in-boundary keys to getListingTiles so the 24 shown are the newest
  // of the set, not an arbitrary slice. The MV's boundary_neighborhood column
  // is NOT used here: for resort communities it holds the overlapping City of
  // Bend district name (e.g. "Southwest Bend"), never the resort slug.
  // Fallback: the subdivision-name path, so a community whose boundary row is
  // missing still never renders an empty homes-for-sale section.
  const boundaryListingKeys = boundaryMapData.pins.map((p) => p.listingKey)
  let communityListingTiles =
    boundaryListingKeys.length > 0
      ? await getListingTiles({
          listingKeys: boundaryListingKeys,
          status: 'active',
          limit: 24,
        }).catch(() => [])
      : []
  if (communityListingTiles.length === 0) {
    communityListingTiles = await getCommunityListings(community.name, { limit: 24 }).catch(() => [])
  }
  const communityListingCards: ListingCardData[] = communityListingTiles.map(tileToCardData)

  const activeCount = pulse?.activeCount ?? community.activeCount
  const medianListPrice = pulse?.medianListPrice ?? community.medianPrice

  const ledeParts: string[] = []
  if (activeCount > 0) {
    ledeParts.push(`${activeCount} homes for sale in ${community.name}.`)
  }
  if (medianListPrice != null) {
    const rounded = Math.round(medianListPrice / 1000) * 1000
    ledeParts.push(`Median list price $${rounded.toLocaleString()}.`)
  }
  if (pulse?.medianDaysToPending != null) {
    ledeParts.push(`Median ${pulse.medianDaysToPending} days to pending.`)
  }
  const lede = ledeParts.join(' ')

  // FIX 2: communityImage() resolver covers all 14 communities.
  // Priority: dedicated LP photo > golf-guide LP photo > city asset_library > stored heroImageUrl.
  const heroImageUrl =
    communityImage(slug) ??
    pickGeoImage(geoImages[citySlug], slug) ??
    pickGeoImage(geoImages['central-oregon'], slug) ??
    community.heroImageUrl ??
    null

  // The 6 MAIN golf / master-planned communities across Central Oregon (registry
  // order = prominence), excluding the one being viewed. NOT filtered to the
  // current city — these are flagship resorts region-wide, and the section links
  // out to the full set. (Owner: "not all of the golf communities are in
  // Tetherow, lets just do the 6 main ones and then do a click to view all.")
  const mainCommunities: RelatedAreaItem[] = (
    resortCommunitiesRegistry.communities as ReadonlyArray<{
      slug: string
      label: string
      city_slug: string
    }>
  )
    .filter((c) => c.slug !== slug)
    .slice(0, 6)
    .map((c) => ({
      name: c.label,
      href: `/communities/${c.slug}`,
      activeCount: null,
      imageUrl:
        communityImage(c.slug) ??
        pickGeoImage(geoImages[c.city_slug], c.slug) ??
        pickGeoImage(geoImages['central-oregon'], c.slug),
    }))

  const otherCityItems: RelatedAreaItem[] = allCitySnapshots
    .map((s) => ({ s, cs: s.geoKey.replace(/\s+/g, '-') }))
    .filter(({ cs }) => CENTRAL_OREGON_CITY_SLUGS.has(cs))
    .slice(0, 8)
    .map(({ s, cs }) => ({
      name: s.geoLabel,
      href: `/cities/${cs}`,
      activeCount: s.activeSfrCount > 0 ? s.activeSfrCount : null,
      imageUrl:
        pickGeoImage(geoImages[cs], cs) ??
        pickGeoImage(geoImages['central-oregon'], cs),
    }))

  const subNeighborhoods = registryEntry?.sub_neighborhoods ?? []
  const hasSubNeighborhoods = subNeighborhoods.length > 0

  return (
    <main className="min-h-screen bg-background">

      {/* Breadcrumb */}
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          items={[
            { label: 'Home', href: '/' },
            { label: 'Communities', href: '/communities' },
            { label: cityName, href: `/cities/${citySlug}` },
            { label: community.name },
          ]}
        />
      </Container>

      {/* Hero photo + stat lede. FIX 2: communityImage() resolver. */}
      <HeroBlock
        headline={`${community.name}, ${cityName} Oregon`}
        lede={lede}
        photo={
          heroImageUrl
            ? { src: heroImageUrl, alt: `${community.name} in ${cityName}, Oregon.`, priority: true }
            : undefined
        }
        minHeight={560}
      />

      {/* Market snapshot */}
      <MarketSnapshot citySlug={citySlug} cityName={cityName} />

      {/* Rich community content (overview prose + at-a-glance facts + drive
          times) from data/resort-community-[slug].json. Renders only for
          communities with an authored config; numbers carry tabular-nums. */}
      {content ? (
        <section className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-2">
              Overview
            </p>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
              <div className="max-w-2xl space-y-4">
                {content.aboutProse.map((para, i) => (
                  <p key={i} className="text-base leading-relaxed text-foreground">
                    {para}
                  </p>
                ))}
              </div>

              <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
                <p className="text-sm font-semibold text-foreground mb-4">At a glance</p>
                <dl className="space-y-3 text-sm">
                  {content.founded ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Founded</dt>
                      <dd className="font-medium text-foreground tabular-nums">{content.founded}</dd>
                    </div>
                  ) : null}
                  {content.acres ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Size</dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        {content.acres.toLocaleString()} acres
                      </dd>
                    </div>
                  ) : null}
                  {content.architect ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Architect</dt>
                      <dd className="font-medium text-foreground text-right">{content.architect}</dd>
                    </div>
                  ) : null}
                  {content.hoaMasterAnnual ? (
                    <div className="flex justify-between gap-4 border-b border-border pb-2">
                      <dt className="text-muted-foreground">Master HOA</dt>
                      <dd className="font-medium text-foreground tabular-nums">
                        ${content.hoaMasterAnnual.toLocaleString()}/year
                      </dd>
                    </div>
                  ) : null}
                  {content.courseRankings[0] ? (
                    <div className="flex justify-between gap-4">
                      <dt className="text-muted-foreground">Recognition</dt>
                      <dd className="font-medium text-foreground text-right">
                        {content.courseRankings[0].rank} {content.courseRankings[0].publication}
                      </dd>
                    </div>
                  ) : null}
                </dl>
              </div>
            </div>

            {content.driveTimes.length > 0 ? (
              <div className="mt-10">
                <h3 className="text-base font-semibold text-foreground mb-4">Drive times</h3>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {content.driveTimes.map((d) => (
                    <div key={d.destination} className="rounded-xl border border-border bg-card p-4 shadow-sm">
                      <div className="text-2xl font-bold text-foreground tabular-nums">{d.minutes} min</div>
                      <div className="mt-1 text-sm font-medium text-foreground">{d.destination}</div>
                      {d.note ? <div className="mt-0.5 text-xs text-muted-foreground">{d.note}</div> : null}
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </Container>
        </section>
      ) : null}

      {/* Amenities (dining, recreation, lifestyle) from the community config. */}
      {content && content.amenities.length > 0 ? (
        <section className="border-t border-border bg-secondary/40 py-10 md:py-14">
          <Container>
            <h2 className="text-2xl font-bold text-foreground mb-6">
              Amenities and lifestyle in {community.name}
            </h2>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {content.amenities.map((a, i) => (
                <div key={`${a.name}-${i}`} className="rounded-xl border border-border bg-card p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary mb-1">
                    {a.category}
                  </p>
                  <p className="text-base font-semibold text-foreground">{a.name}</p>
                  {a.description ? (
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.description}</p>
                  ) : null}
                  {a.access ? (
                    <p className="mt-3 text-xs text-muted-foreground">{a.access}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* FIX 5: Community detail section with registry data. */}
      {registryEntry ? (
        <section className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <div className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                About {community.name}
              </p>
              <h2 className="text-2xl font-bold text-foreground mb-4">
                {community.name} at a glance
              </h2>

              {hasSubNeighborhoods ? (
                <div className="mt-8">
                  <h3 className="text-lg font-semibold text-foreground mb-4">
                    Neighborhoods within {community.name}
                  </h3>
                  <div className="grid gap-5 sm:grid-cols-2">
                    {subNeighborhoods.map((sn) => (
                      <div
                        key={sn.slug}
                        className="rounded-xl border border-border bg-card p-5 shadow-sm"
                      >
                        <p className="font-semibold text-foreground text-base mb-1">{sn.name}</p>
                        {sn.type ? (
                          <p className="text-xs text-muted-foreground mb-2">{sn.type}</p>
                        ) : null}
                        {sn.description ? (
                          <p className="text-sm text-foreground leading-relaxed mb-3">
                            {sn.description}
                          </p>
                        ) : null}
                        {sn.lot_size_note ? (
                          <p className="text-xs text-muted-foreground mb-2">
                            Lot sizes: {sn.lot_size_note}
                          </p>
                        ) : null}
                        {(sn.hoa_annual_estimate || sn.hoa_master_annual) ? (
                          <div className="mt-3 space-y-1">
                            {sn.hoa_annual_estimate ? (
                              <p className="text-sm tabular-nums text-foreground">
                                HOA (sub): ~${sn.hoa_annual_estimate.toLocaleString()}/year
                              </p>
                            ) : null}
                            {sn.hoa_master_annual ? (
                              <p className="text-sm tabular-nums text-foreground">
                                Master HOA: ~${sn.hoa_master_annual.toLocaleString()}/year
                              </p>
                            ) : null}
                            {sn.hoa_manager ? (
                              <p className="text-xs text-muted-foreground">Managed by {sn.hoa_manager}</p>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              {registryEntry.subdivision_aliases.length > 1 ? (
                <div className="mt-8">
                  <h3 className="text-base font-semibold text-foreground mb-2">
                    MLS subdivision names used within {community.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    Listings inside {community.name} may appear under these MLS subdivision names.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {registryEntry.subdivision_aliases.map((alias) => (
                      <span
                        key={alias}
                        className="inline-flex items-center rounded-full border border-border bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Boundary map. No redundant heading — it is self-evidently a map of
          homes (owner directive 2026-05-29). When the community has GIS
          subdivision plats, render each as its own polygon (broken out);
          otherwise show the single community boundary. */}
      {boundaryMapData.polygon ? (
        <NeighborhoodMap
          polygons={
            communitySubdivisions.length > 0
              ? communitySubdivisions.map((s) => ({
                  slug: s.slug,
                  name: s.label,
                  geometry: s.geometry,
                  href: `/subdivisions/${s.slug}`,
                }))
              : [
                  {
                    slug,
                    name: community.name,
                    geometry: boundaryMapData.polygon,
                  },
                ]
          }
          listings={boundaryMapData.pins.map((p) => ({
            lat: p.lat,
            lng: p.lng,
            href: `/listing/${p.listingKey}`,
            price: p.price,
          }))}
          zoom={14}
          height={560}
          tone="muted"
        />
      ) : null}

      {/* FIX 3: Listing cards for homes inside the community boundary. */}
      {communityListingCards.length > 0 ? (
        <section className="border-t border-border bg-background py-10 md:py-14">
          <Container>
            <div className="mb-6 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {community.name}
                </p>
                <h2 className="text-2xl font-bold text-foreground">
                  Homes for sale in {community.name}
                </h2>
              </div>
              {boundaryMapData.pins.length > 24 ? (
                <a
                  href={`/search?subdivision=${encodeURIComponent(community.name)}&city=${encodeURIComponent(cityName)}`}
                  className="shrink-0 text-sm font-medium text-primary underline-offset-2 hover:underline"
                >
                  View all {boundaryMapData.pins.length}
                </a>
              ) : null}
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {communityListingCards.map((card) => (
                <ListingCard key={card.listingKey} listing={card} />
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Subdivisions within the community (GIS plats, spatial membership via
          getCommunitySubdivisions). Each links to its own page and is drawn as
          a separate polygon on the map above. */}
      {communitySubdivisions.length > 0 ? (
        <section className="border-t border-border bg-secondary/40 py-10 md:py-14">
          <Container>
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                {community.name}
              </p>
              <h2 className="text-2xl font-bold text-foreground">
                Subdivisions within {community.name}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {communitySubdivisions.map((sub) => (
                <a
                  key={sub.slug}
                  href={`/subdivisions/${sub.slug}`}
                  className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card px-5 py-4 shadow-sm transition hover:border-primary/40 hover:shadow-md"
                >
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold text-foreground">{sub.label}</div>
                    <div className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {sub.activeHomes > 0
                        ? `${sub.activeHomes} ${sub.activeHomes === 1 ? 'home' : 'homes'} for sale`
                        : 'No active listings'}
                    </div>
                  </div>
                  <span aria-hidden className="shrink-0 text-muted-foreground transition group-hover:text-primary">
                    →
                  </span>
                </a>
              ))}
            </div>
          </Container>
        </section>
      ) : null}

      {/* Browse by price range */}
      <PriceRangeTiles />

      {/* FIX 4: Open houses section. */}
      <OpenHousesGrid
        city={cityName}
        daysAhead={14}
        eyebrow={`Upcoming in ${community.name}`}
        heading="Open houses"
        viewAllHref={`/open-houses/${citySlug}`}
      />

      {/* 6 main golf/master-planned communities + view all */}
      {mainCommunities.length > 0 ? (
        <RelatedAreas
          eyebrow="Central Oregon"
          title="Golf and master-planned communities"
          items={mainCommunities}
          tone="default"
          cols={3}
          viewAllHref="/communities"
          viewAllLabel="View all communities"
        />
      ) : null}

      {/* Live activity feed */}
      <ActivityFeed
        city={cityName}
        eyebrow={`Live activity · ${cityName}`}
        heading={`What is happening in ${cityName}`}
        viewAllLabel="Full market pulse"
        viewAllHref="/housing-market"
      />

      {/* Cross-nav to other Central Oregon cities */}
      {otherCityItems.length > 0 ? (
        <RelatedAreas
          eyebrow="Central Oregon"
          title="Explore other cities"
          items={otherCityItems}
          cols={4}
        />
      ) : null}

      {/* Blog posts */}
      <ArticleGrid
        items={blogPosts}
        eyebrow="Guides and insights"
        heading={`${community.name} real estate, explained`}
        subtitle={`Local housing news, market data, and buyer and seller guides for ${community.name} and ${cityName}.`}
        tone="muted"
      />

      {/* CTA bar */}
      <CTABar
        eyebrow={`Why Ryan Realty in ${community.name}`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We close deals across ${cityName} every year. We can tell you what the market looked like last month in ${community.name}. If the numbers support it, we will say so.`}
        primary={{ href: '/contact', label: 'Meet the team' }}
        secondary={{ href: 'tel:5412136706', label: 'Call 541.213.6706' }}
        tone="navy"
      />

    </main>
  )
}
