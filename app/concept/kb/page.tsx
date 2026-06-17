import type { Metadata } from 'next'

import { getRegionPulse, getListingTiles } from '@/lib/data'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { listingDetailPath } from '@/lib/slug'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbCommunities } from '@/components/site/kb/KbCommunities.client'
import { KbFeatured } from '@/components/site/kb/KbFeatured.client'
import { KbListingMap, type KbMapGeo } from '@/components/site/kb/KbListingMap.client'
import { KbTicker } from '@/components/site/kb/KbTicker.client'
import { KbTestimonials } from '@/components/site/kb/KbTestimonials.client'
import { KbTeam } from '@/components/site/kb/KbTeam.client'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import type { KbTownItem, KbCommunityItem, KbTickerItem, KbFeaturedItem } from '@/components/site/kb/types'
import { TESTIMONIALS } from '@/lib/testimonials'
import '@/components/site/kb/kb.css'

/**
 * KB homepage — PREVIEW route. The kinetic-brutalist homepage built for real,
 * section by section, before it promotes to app/page.tsx. noindex so it never
 * competes with the live homepage in search. Live data via the DAL (§0).
 */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'KB Homepage (preview)',
  robots: { index: false, follow: false },
}

const TOWN_ORDER = ['bend', 'la-pine', 'redmond', 'sunriver', 'sisters', 'terrebonne']
const TOWN_IMG: Record<string, string> = {
  bend: '/images/kb/bend-drake-park-aerial.jpg',
  'la-pine': '/images/kb/vandevert-ranch.jpg',
  redmond: '/images/kb/redmond-downtown-aerial.jpg',
  sunriver: '/images/kb/caldera-springs.jpg',
  sisters: '/images/kb/sisters-downtown-three-peaks.jpg',
  terrebonne: '/images/kb/smith-rock-terrebonne.jpg',
}

const COMM_FEATURED = [
  { match: 'tetherow', town: 'Bend', img: '/images/kb/tetherow-golf-aerial.jpg' },
  { match: 'caldera', town: 'Sunriver', img: '/images/kb/caldera-springs.jpg' },
  { match: 'broken top', town: 'Bend', img: '/images/kb/broken-top.jpg' },
  { match: 'crossing', town: 'Bend', img: '/images/kb/northwest-crossing.jpg' },
]

export default async function KbHomePreview() {
  const [pulse, cities, communities, tiles, featured] = await Promise.all([
    getRegionPulse().catch(() => null),
    getCitiesForIndex().catch(() => []),
    getCommunitiesForIndex().catch(() => []),
    getListingTiles({ status: 'active', propertyType: 'A', limit: 3000 }).catch(() => []),
    getListingTiles({ status: 'active', propertyType: 'A', sort: 'price-desc', limit: 6 }).catch(() => []),
  ])

  const cityBySlug = new Map(cities.map((c) => [c.slug, c]))
  const towns: KbTownItem[] = TOWN_ORDER.map((slug) => {
    const c = cityBySlug.get(slug)
    if (!c) return null
    return { name: c.name, activeCount: c.activeCount, medianPrice: c.medianPrice, href: `/cities/${slug}`, img: TOWN_IMG[slug] }
  }).filter((t): t is KbTownItem => t !== null)

  const communityItems: KbCommunityItem[] = COMM_FEATURED.map((f) => {
    const c = communities.find((x) => x.subdivision.toLowerCase().includes(f.match))
    if (!c) return null
    return { name: c.subdivision, activeCount: c.activeCount, town: f.town, href: `/communities/${c.slug}`, img: f.img }
  }).filter((x): x is KbCommunityItem => x !== null)

  const mapFeatures = tiles
    .filter((t) => t.lat != null && t.lng != null)
    .map((t) => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [Number(t.lng), Number(t.lat)] as [number, number] },
      properties: {
        p: t.listPrice,
        bd: t.beds,
        ba: t.baths,
        sf: t.sqft,
        a: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
        sub: t.subdivisionName ?? '',
        city: t.city ?? '',
        img: t.photoUrl ?? '',
      },
    }))
  const mapGeo: KbMapGeo = { type: 'FeatureCollection', features: mapFeatures }

  const tickerItems: KbTickerItem[] = tiles.slice(0, 6).map((t) => ({
    price: t.listPrice,
    address: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
    town: t.city ?? '',
  }))

  const featuredItems: KbFeaturedItem[] = featured
    .filter((t) => t.photoUrl)
    .slice(0, 5)
    .map((t) => ({
      price: t.listPrice,
      address: [t.streetNumber, t.streetName].filter(Boolean).join(' '),
      sub: t.subdivisionName ?? '',
      city: t.city ?? '',
      beds: t.beds,
      baths: t.baths,
      sqft: t.sqft,
      img: t.photoUrl ?? '',
      href: listingDetailPath(
        t.listingKey,
        { streetNumber: t.streetNumber, streetName: t.streetName, city: t.city, postalCode: t.postalCode },
        { city: t.city, subdivision: t.subdivisionName },
        { mlsNumber: t.listNumber },
      ),
    }))

  return (
    <main className="kb-root">
      <SmoothScrollProvider>
        <KbHero
          data={{
            activeCount: pulse?.activeCount ?? null,
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
          }}
        />
        <KbExploreTowns towns={towns} />
        <KbCommunities communities={communityItems} />
        <KbFeatured items={featuredItems} />
        <KbListingMap geojson={mapGeo} totalActive={pulse?.activeCount ?? mapFeatures.length} />
        <KbTicker items={tickerItems} />
        <KbTestimonials reviews={TESTIMONIALS.slice(0, 8)} />
        <KbTeam />
        <KbSell
          data={{
            medianListPrice: pulse?.medianListPrice ?? null,
            medianDaysToPending: pulse?.medianDaysToPending ?? null,
            soldCount30d: pulse?.soldCount30d ?? null,
          }}
        />
        <KbFooter towns={towns} />
      </SmoothScrollProvider>
    </main>
  )
}
