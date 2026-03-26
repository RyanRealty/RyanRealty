import type { Metadata } from 'next'
import Link from 'next/link'
import { getReportCities } from '@/app/actions/reports'
import { getLiveMarketPulse } from '@/app/actions/market-stats'
import { cityEntityKey } from '@/lib/slug'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Central Oregon Market Hub',
  description: 'Regional market overview across Central Oregon cities including inventory, new listings, and pricing signals.',
  alternates: { canonical: `${siteUrl}/housing-market/central-oregon` },
  openGraph: {
    title: 'Central Oregon Market Hub | Ryan Realty',
    description: 'Regional market overview across Central Oregon cities.',
    url: `${siteUrl}/housing-market/central-oregon`,
    type: 'website',
    images: [`${siteUrl}/api/og?type=default`],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Central Oregon Market Hub | Ryan Realty',
    description: 'Regional market overview across Central Oregon cities.',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

export default async function CentralOregonHubPage() {
  const { cities } = await getReportCities()
  const core = (cities ?? []).slice(0, 12)
  const rows = await Promise.all(
    core.map(async (city) => {
      const slug = cityEntityKey(city)
      const pulse = await getLiveMarketPulse({ geoType: 'city', geoSlug: slug })
      return { city, slug, pulse }
    })
  )
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Central Oregon Market Hub',
    url: `${siteUrl}/housing-market/central-oregon`,
    description: 'Regional market overview across Central Oregon cities including inventory, new listings, and pricing signals.',
    hasPart: rows.map(({ city, slug }) => ({
      '@type': 'WebPage',
      name: `${city} Housing Market`,
      url: `${siteUrl}/housing-market/${slug}`,
    })),
    breadcrumb: {
      '@type': 'BreadcrumbList',
      itemListElement: [
        {
          '@type': 'ListItem',
          position: 1,
          name: 'Housing Market',
          item: `${siteUrl}/housing-market`,
        },
        {
          '@type': 'ListItem',
          position: 2,
          name: 'Central Oregon',
          item: `${siteUrl}/housing-market/central-oregon`,
        },
      ],
    },
  }

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <h1 className="text-3xl font-semibold text-foreground">Central Oregon Market Hub</h1>
      <p className="mt-3 text-muted-foreground">
        Compare city-level demand and inventory to understand where momentum is building.
      </p>
      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(({ city, slug, pulse }) => (
          <article key={city} className="rounded-lg border border-border bg-card p-5">
            <h2 className="text-lg font-semibold text-foreground">{city}</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Active {pulse?.active_count ?? 0} • Pending {pulse?.pending_count ?? 0}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              New 30d {pulse?.new_count_30d ?? 0} • Median list{' '}
              {pulse?.median_list_price != null ? `$${Math.round(Number(pulse.median_list_price)).toLocaleString()}` : 'N/A'}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href={`/housing-market/${slug}`} className="rounded-md border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-background">
                City market page
              </Link>
              <Link href={`/housing-market/reports/city/${encodeURIComponent(city)}`} className="rounded-md border border-border bg-muted px-3 py-2 text-xs font-medium text-foreground hover:bg-background">
                Report page
              </Link>
            </div>
          </article>
        ))}
      </section>
    </main>
  )
}
