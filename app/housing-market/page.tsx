import type { Metadata } from 'next'
import Link from 'next/link'
import { getReportCities } from '@/app/actions/reports'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import ContentPageHero from '@/components/layout/ContentPageHero'
import { CONTENT_HERO_IMAGES } from '@/lib/content-page-hero-images'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Housing Market Hub',
  description: 'Central Oregon housing market hub with city and community market pages, trends, and report access.',
  alternates: { canonical: `${siteUrl}/housing-market` },
  openGraph: {
    title: 'Housing Market Hub | Ryan Realty',
    description: 'Central Oregon housing market hub with city and community market pages.',
    url: `${siteUrl}/housing-market`,
    type: 'website',
    images: [`${siteUrl}/api/og?type=default`],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Housing Market Hub | Ryan Realty',
    description: 'Central Oregon housing market hub with city and community market pages.',
    images: [`${siteUrl}/api/og?type=default`],
  },
}

export default async function HousingMarketHubPage() {
  const { cities } = await getReportCities()
  const topCities = (cities ?? []).slice(0, 12)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Housing Market Hub',
    url: `${siteUrl}/housing-market`,
    description: 'Central Oregon housing market hub with city and community market pages, trends, and report access.',
    hasPart: topCities.map((city) => ({
      '@type': 'WebPage',
      name: `${city} Housing Market`,
      url: `${siteUrl}/housing-market/${encodeURIComponent(city.toLowerCase().replace(/\s+/g, '-'))}`,
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
      ],
    },
  }
  return (
    <main className="min-h-screen bg-background">
      <ContentPageHero
        title="Housing Market Hub"
        subtitle="Track local pricing, inventory, and market pace across Central Oregon cities and communities."
        imageUrl={CONTENT_HERO_IMAGES.reports}
        ctas={[
          { label: 'View Reports', href: '/housing-market/reports', primary: true },
          { label: 'Explore Data', href: '/housing-market/explore', primary: false },
        ]}
      />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="flex flex-wrap gap-3">
        <Link href="/housing-market/reports" className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
          View report index
        </Link>
        <Link href="/housing-market/explore" className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
          Open data explorer
        </Link>
        <Link href="/housing-market/central-oregon" className="rounded-lg border border-border bg-card px-4 py-2.5 text-sm font-medium text-foreground hover:bg-muted">
          Central Oregon hub
        </Link>
      </div>
      <section className="mt-10">
        <h2 className="text-xl font-semibold text-foreground">Cities</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {topCities.map((city) => (
            <Card key={city}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{city}</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <Link href={`/housing-market/${encodeURIComponent(city.toLowerCase().replace(/\s+/g, '-'))}`} className="text-sm font-medium text-primary hover:underline">
                  Open market page
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Separator className="my-10" />

      <section aria-labelledby="related-resources-heading">
        <h2 id="related-resources-heading" className="text-xl font-semibold text-foreground">
          Related resources
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Explore more Central Oregon real estate content across the site.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/cities"
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            All Central Oregon cities
          </Link>
          <Link
            href="/communities"
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Communities & neighborhoods
          </Link>
          <Link
            href="/homes-for-sale"
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Browse homes for sale
          </Link>
          <Link
            href="/guides"
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Buying & selling guides
          </Link>
          <Link
            href="/area-guides"
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Area guides
          </Link>
          <Link
            href="/open-houses"
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Open houses
          </Link>
          <Link
            href="/reports"
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Market reports
          </Link>
          <Link
            href="/activity"
            className="rounded-lg border border-border bg-card px-4 py-3 text-sm font-medium text-foreground hover:bg-muted"
          >
            Recent activity feed
          </Link>
        </div>
      </section>
      </div>
    </main>
  )
}
