import type { Metadata } from 'next'
import Link from 'next/link'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getCommunitiesForIndex } from '@/app/actions/communities'
import { getSession } from '@/app/actions/auth'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { sortCitiesWithPrimaryFirst, getPrimaryCityRank } from '@/lib/cities'
import { sortResortCommunitiesInPrimaryCities } from '@/lib/communities'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'
import ExploreByCitySlider from '@/components/area-guides/ExploreByCitySlider'
import ResortCommunitiesSlider from '@/components/area-guides/ResortCommunitiesSlider'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Area Guides | Central Oregon Cities & Communities | Ryan Realty',
  description:
    'Explore Bend, Redmond, Sisters, Sunriver, La Pine, Prineville and more. Neighborhoods, market trends, and homes for sale in every corner of Central Oregon.',
  alternates: { canonical: `${siteUrl}/area-guides` },
  openGraph: {
    title: 'Area Guides | Ryan Realty â€” Central Oregon',
    url: `${siteUrl}/area-guides`,
    type: 'website',
  },
}

export default async function AreaGuidesPage() {
  const [allCities, allCommunities, session] = await Promise.all([
    getCitiesForIndex(),
    getCommunitiesForIndex(),
    getSession(),
  ])
  const savedCitySlugs = session?.user ? await getSavedCitySlugs() : []
  const savedCommunityKeys = session?.user ? await getSavedCommunityKeys() : []
  const sorted = sortCitiesWithPrimaryFirst(allCities)
  const primaryCities = sorted.filter((c) => getPrimaryCityRank(c.name) >= 0)
  const others = sorted.filter((c) => getPrimaryCityRank(c.name) < 0)
  const resortCommunities = sortResortCommunitiesInPrimaryCities(allCommunities, getPrimaryCityRank)

  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Discover Central Oregon"
        subtitle="From Bend and Redmond to Sisters, Sunriver, and beyond. Explore neighborhoods, market trends, and homes for sale in every corner of the region we call home."
        imageUrl={CONTENT_HERO_IMAGES.areaGuides}
        ctas={[
          { label: 'View All Cities', href: '/cities', primary: true },
          { label: 'Browse Communities', href: '/communities', primary: false },
        ]}
      />

      <div className="mx-auto max-w-7xl">
        <ExploreByCitySlider
          cities={primaryCities}
          savedSlugs={savedCitySlugs}
          signedIn={!!session?.user}
        />
      </div>

      {others.length > 0 && (
        <section className="border-b border-border bg-card px-4 py-12 sm:px-6" aria-labelledby="more-areas-heading">
          <div className="mx-auto max-w-6xl">
            <h2 id="more-areas-heading" className="text-xl font-bold text-primary">
              More areas
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              View all cities on the <Link href="/cities" className="font-medium text-accent-foreground hover:text-accent-foreground">Cities</Link> page.
            </p>
            <ul className="mt-4 flex flex-wrap gap-3">
              {others.map((city) => (
                <li key={city.slug}>
                  <Link
                    href={`/cities/${city.slug}`}
                    className="rounded-lg border border-border bg-muted px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary hover:text-primary-foreground"
                  >
                    {city.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <div className="mx-auto max-w-7xl">
        <ResortCommunitiesSlider
          communities={resortCommunities}
          savedCommunityKeys={savedCommunityKeys}
          signedIn={!!session?.user}
        />
      </div>

      <section className="border-t border-border bg-card px-4 py-14 sm:px-6" aria-labelledby="map-heading">
        <div className="mx-auto max-w-2xl text-center">
          <h2 id="map-heading" className="text-2xl font-bold text-primary">
            Search on the map
          </h2>
          <p className="mt-3 text-muted-foreground">
            Use our interactive map to explore listings, schools, and neighborhoods.
          </p>
          <Link
            href="/homes-for-sale"
            className="mt-6 inline-block rounded-lg border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-primary-foreground"
          >
            Open map search
          </Link>
        </div>
      </section>
    </main>
  )
}
