import type { Metadata } from 'next'
import { getCitiesForIndex } from '@/app/actions/cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import CityTilesGridStatic from '@/components/city/CityTilesGridStatic'
import { DisplayHeading } from '@/components/site/primitives'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Central Oregon Cities — Bend, Redmond, Sisters, Sunriver | Ryan Realty',
  description:
    'Explore homes for sale in Central Oregon cities. Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and more.',
  alternates: { canonical: `${siteUrl}/cities` },
  openGraph: {
    title: 'Central Oregon Cities | Ryan Realty',
    description: 'Explore homes for sale in Central Oregon cities.',
    url: `${siteUrl}/cities`,
    siteName: 'Ryan Realty',
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: { card: 'summary_large_image', images: [ogImage] },
}

export default async function CitiesPage() {
  const allCities = await getCitiesForIndex()
  const sortedCities = sortCitiesWithPrimaryFirst(allCities)
  const visibleCities = sortedCities.slice(0, 60)
  const hiddenCount = Math.max(0, sortedCities.length - visibleCities.length)

  return (
    <main className="min-h-screen bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'CollectionPage',
            name: 'Central Oregon Cities',
            description: 'Explore homes for sale in Central Oregon cities.',
            url: `${siteUrl}/cities`,
            publisher: { '@type': 'Organization', name: 'Ryan Realty' },
          }),
        }}
      />

      <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl text-center">
          <DisplayHeading
            as="h1"
            className="text-3xl text-primary-foreground sm:text-4xl"
          >
            Central Oregon Cities
          </DisplayHeading>
          <p className="mt-3 text-lg text-muted">
            Find homes in Bend, Redmond, Sisters, Sunriver, and surrounding areas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="cities-heading">
        <h2 id="cities-heading" className="sr-only">
          Cities
        </h2>
        <CityTilesGridStatic cities={visibleCities} />
        {hiddenCount > 0 && (
          <p className="mt-6 text-sm text-muted-foreground">
            Showing top {visibleCities.length} cities by active inventory. {hiddenCount} additional cities are available in search.
          </p>
        )}
      </section>
    </main>
  )
}
