import type { Metadata } from 'next'
import { getCitiesForIndex } from '@/app/actions/cities'
import { PRIMARY_CITIES } from '@/lib/cities'
import CityCard from '@/components/city/CityCard'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

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
  },
}

export default async function CitiesPage() {
  const allCities = await getCitiesForIndex()
  const primarySet = new Set(PRIMARY_CITIES.map((c) => c.toLowerCase()))
  const primary = allCities.filter((c) => primarySet.has(c.name.toLowerCase()))
  const others = allCities.filter((c) => !primarySet.has(c.name.toLowerCase()))

  return (
    <main className="min-h-screen bg-[var(--background)]">
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

      <section className="bg-[var(--brand-navy)] px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Central Oregon Cities
          </h1>
          <p className="mt-3 text-lg text-[var(--brand-cream)]">
            Find homes in Bend, Redmond, Sisters, Sunriver, and surrounding areas.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-16" aria-labelledby="cities-heading">
        <h2 id="cities-heading" className="sr-only">
          Cities
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {(primary.length > 0 ? primary : allCities).map((city) => (
            <CityCard
              key={city.slug}
              slug={city.slug}
              name={city.name}
              activeCount={city.activeCount}
              medianPrice={city.medianPrice}
              communityCount={city.communityCount}
              heroImageUrl={city.heroImageUrl}
              description={city.description}
            />
          ))}
        </div>
        {primary.length > 0 && others.length > 0 && (
          <div className="mt-12">
            <h3 className="text-xl font-bold text-[var(--brand-navy)]">More cities</h3>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {others.map((city) => (
                <CityCard
                  key={city.slug}
                  slug={city.slug}
                  name={city.name}
                  activeCount={city.activeCount}
                  medianPrice={city.medianPrice}
                  communityCount={city.communityCount}
                  heroImageUrl={city.heroImageUrl}
                  description={city.description}
                />
              ))}
            </div>
          </div>
        )}
      </section>
    </main>
  )
}
