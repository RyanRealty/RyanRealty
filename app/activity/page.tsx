import type { Metadata } from 'next'
import ActivityFeedCard from '@/components/activity/ActivityFeedCard'
import { getActivityFeed } from '@/app/actions/activity-feed'
import AdUnit from '@/components/AdUnit'
import HomeValuationCta from '@/components/HomeValuationCta'
import { listingsBrowsePath } from '@/lib/slug'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const ogImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Live Market Activity',
  description: 'Track new listings, price drops, pending sales, and closed activity across Central Oregon.',
  alternates: { canonical: `${siteUrl}/activity` },
  openGraph: {
    title: 'Live Market Activity | Ryan Realty',
    description: 'Track listing activity signals across Central Oregon neighborhoods.',
    url: `${siteUrl}/activity`,
    type: 'website',
    images: [{ url: ogImage, width: 1200, height: 630 }],
  },
  twitter: {
    card: 'summary',
    title: 'Live Market Activity | Ryan Realty',
    description: 'Track listing activity signals across Central Oregon neighborhoods.',
    images: [ogImage],
  },
}

export default async function ActivityPage() {
  const items = await getActivityFeed({ limit: 24 })
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    name: 'Live Market Activity',
    url: `${siteUrl}/activity`,
    description: 'Recent listing activity events across Central Oregon.',
  }

  return (
    <main className="min-h-screen bg-background">
      <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-7xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-primary-foreground sm:text-4xl">
            Live Market Activity
          </h1>
          <p className="mt-3 text-lg text-muted">
            New listings, price changes, pending sales, and closed updates across Central Oregon.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
            <a
              href={listingsBrowsePath()}
              className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-3 text-sm font-semibold text-primary shadow-md hover:bg-accent/90"
            >
              View All Listings
            </a>
            <a
              href="/homes-for-sale"
              className="inline-flex items-center gap-2 rounded-lg border-2 border-primary-foreground/40 bg-card/10 px-5 py-3 text-sm font-semibold text-primary-foreground backdrop-blur-sm hover:bg-card/20"
            >
              Search on Map
            </a>
          </div>
        </div>
      </section>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item) => (
          <ActivityFeedCard key={item.id} item={item} />
        ))}
      </div>
      <div className="mt-8">
        <AdUnit slot="1001003002" format="horizontal" />
      </div>
      <div className="mt-8">
        <HomeValuationCta />
      </div>
      </div>
    </main>
  )
}
