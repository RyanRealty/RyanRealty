/**
 * /area-guides — Central Oregon by city and community.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE. Every piece of content is preserved:
 *   - BreadcrumbList + webPage JSON-LD (MetadataBlock)
 *   - hero copy + CTAs (View all cities / Browse communities)
 *   - the cities ledger (name + live active count + photo + link), sorted
 *     primary-city-first, sourced from getCitiesForIndex
 *   - the communities ledger (resort/master-planned), name title-cased via the
 *     same fixCase helper, sourced from getCommunitiesForIndex
 *   - the "Search on the map" CTA
 *   - export const metadata + revalidate
 *
 * The two RelatedAreas photo grids are restyled onto the KB KbExploreTowns
 * editorial ledger (the homepage + city/community pages use the same component
 * for their city / community lists — single source of truth, no fork). Each
 * row keeps the area name, its real active-listing count, its photo (revealed
 * on hover), and its link; the KB ledger additionally surfaces the live median
 * list price that the DAL already returns. No content dropped.
 */

import type { Metadata } from 'next'
import Link from 'next/link'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { sortCitiesWithPrimaryFirst, getPrimaryCityRank } from '@/lib/cities'
import { sortResortCommunitiesInPrimaryCities } from '@/lib/communities'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import type { KbTownItem } from '@/components/site/kb/types'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Area Guides | Central Oregon Cities & Communities',
  description:
    'Explore Bend, Redmond, Sisters, Sunriver, La Pine, Prineville and more. Neighborhoods, market trends, and homes for sale in every corner of Central Oregon.',
  alternates: { canonical: `${siteUrl}/area-guides` },
  openGraph: {
    title: 'Area Guides | Ryan Realty — Central Oregon',
    url: `${siteUrl}/area-guides`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

export default async function AreaGuidesPage() {
  const [allCities, allCommunities] = await Promise.all([
    getCitiesForIndex(),
    getCommunitiesForIndex(),
  ])

  const cities = sortCitiesWithPrimaryFirst(allCities)
  const communities = sortResortCommunitiesInPrimaryCities(allCommunities, getPrimaryCityRank)

  const cityItems: KbTownItem[] = cities.map((c) => ({
    name: c.name,
    href: `/cities/${c.slug}`,
    activeCount: c.activeCount ?? 0,
    medianPrice: c.medianPrice ?? null,
    img: c.heroImageUrl ?? '',
  }))

  // Some community names arrive all-lowercase from the data ("vandevert ranch").
  // Title-case only those — leave intentional casing ("NorthWest Crossing") alone.
  const fixCase = (s: string) =>
    /[A-Z]/.test(s) ? s : s.replace(/\b\w/g, (ch) => ch.toUpperCase())

  const communityItems: KbTownItem[] = communities.map((c) => ({
    name: fixCase(c.subdivision),
    href: `/communities/${c.slug}`,
    activeCount: c.activeCount ?? 0,
    medianPrice: c.medianPrice ?? null,
    img: c.heroImageUrl ?? '',
  }))

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="guides" />
      <MetadataBlock
        schemas={[
          {
            type: 'breadcrumb',
            items: [
              { name: 'Home', url: '/' },
              { name: 'Area guides', url: '/area-guides' },
            ],
          },
          {
            type: 'webPage',
            name: 'Central Oregon area guides',
            description:
              'Explore Central Oregon by city and community — Bend, Redmond, Sisters, Sunriver, and beyond, with market trends and homes for sale in every area.',
            url: '/area-guides',
          },
        ]}
      />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Area guides' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle as the prior ContentPageHero. The two CTAs
            (View all cities / Browse communities) are preserved in the CTA row
            below so both destinations stay one tap away. */}
        <KbHero
          data={{ activeCount: null, medianListPrice: null, medianDaysToPending: null }}
          eyebrow="Central Oregon · Explore by area"
          titleTop="Discover"
          titleBottom="Central Oregon"
          lead="From Bend and Redmond to Sisters, Sunriver, and beyond. Explore neighborhoods, market trends, and homes for sale in every corner of the region we call home."
          videoSrc={null}
          posterSrc="/images/trails/green-lakes.jpg"
        />

        {/* CTA row preserved from the prior hero. */}
        <section className="section" id="area-cta" aria-label="View cities and communities">
          <div className="wrap">
            <div className="flex flex-wrap items-center gap-3 py-2">
              <Link href="/cities" className="btn alt">
                View all cities <span className="arr">→</span>
              </Link>
              <Link href="/communities" className="btn alt" style={{ background: 'transparent', color: 'var(--navy)' }}>
                Browse communities <span className="arr">→</span>
              </Link>
            </div>
          </div>
        </section>

        {/* Cities ledger — every city, live active count + median, photo on
            hover, link to /cities/[slug]. Empty-safe (renders null). */}
        <KbExploreTowns
          towns={cityItems}
          eyebrow="Explore by city"
          title="Central Oregon cities"
          sectionId="cities"
          cta={{ href: '/cities', label: 'All cities' }}
        />

        {/* Communities ledger — resort & master-planned. */}
        <KbExploreTowns
          towns={communityItems}
          eyebrow="Resort & master-planned"
          title="Communities"
          sectionId="communities"
          cta={{ href: '/communities', label: 'All communities' }}
        />

        {/* Map search CTA — preserved. */}
        <section className="section" id="map-search" aria-label="Search on the map">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Interactive map</span>
              <h2 className="sec-title display">Search on<br />the map</h2>
            </div>
            <div className="max-w-2xl pt-6">
              <p style={{ color: 'var(--navy-70)', fontSize: 'clamp(1rem,1.6vw,1.2rem)', lineHeight: 1.55 }}>
                Use our interactive map to explore listings, schools, and neighborhoods across the region.
              </p>
              <div className="sec-cta">
                <Link href="/search" className="btn alt">
                  Open map search <span className="arr">→</span>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
