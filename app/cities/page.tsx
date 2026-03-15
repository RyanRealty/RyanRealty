import type { Metadata } from 'next'
import { getCitiesForIndex } from '@/app/actions/cities'
import { getSession } from '@/app/actions/auth'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
import { sortCitiesWithPrimaryFirst } from '@/lib/cities'
import CityTilesGrid from '@/components/city/CityTilesGrid'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const revalidate = 60

export const metadata: Metadata = {
  title: 'Central Oregon Cities â€” Bend, Redmond, Sisters, Sunriver | Ryan Realty',
  description:
    'Explore homes for sale in Central Oregon cities. Bend, Redmond, Sisters, Sunriver, La Pine, Prineville, and more.',
  alternates: { canonical: `${siteUrl}/cities` },
  openGraph: {
    title: 'Central Oregon Cities | Ryan Realty',
    description: 'Explore homes for sale in Central Oregon cities.',
    url: `${siteUrl}/cities`,
    siteName: 'Ryan Realty',
    type: 'website',
  },
}

export default async function CitiesPage() {
  const [allCities, session] = await Promise.all([getCitiesForIndex(), getSession()])
  const savedSlugs = session?.user ? await getSavedCitySlugs() : []
  const sortedCities = sortCitiesWithPrimaryFirst(allCities)
  const signedIn = !!session?.user

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
          <h1 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Central Oregon Cities
          </h1>
          <p className="mt-3 text-lg text-muted">
            Find homes in Bend, Redmond, Sisters, Sunriver, and surrounding areas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="cities-heading">
        <h2 id="cities-heading" className="sr-only">
          Cities
        </h2>
        <CityTilesGrid cities={sortedCities} savedSlugs={savedSlugs} signedIn={signedIn} />
      </section>
    </main>
  )
}
