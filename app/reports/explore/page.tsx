import type { Metadata } from 'next'
import { Suspense } from 'react'
import ExploreClient from './ExploreClient'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryanrealty.com').replace(/\/$/, '')

export const metadata: Metadata = {
  title: 'Explore Market Data',
  description:
    'Interactive market explorer: filter by city and date range, view key metrics, price bands, and trends. Share your view via link, email, or social.',
  alternates: { canonical: `${siteUrl}/reports/explore` },
  openGraph: {
    title: 'Explore Market Data | Ryan Realty',
    description: 'Interactive market data: metrics, price bands, and trends by city and period. Share your view.',
    url: `${siteUrl}/reports/explore`,
    type: 'website',
    siteName: 'Ryan Realty',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore Market Data | Ryan Realty',
    description: 'Interactive market data by city and period. Share your view.',
  },
}

type Props = { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }

export default async function ExplorePage({ searchParams }: Props) {
  const params = await searchParams
  const city = typeof params?.city === 'string' ? params.city : ''
  const subdivision = typeof params?.subdivision === 'string' ? params.subdivision : ''
  const start = typeof params?.start === 'string' ? params.start : ''
  const end = typeof params?.end === 'string' ? params.end : ''

  return (
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Explore market data</h1>
        <p className="mt-2 text-zinc-600">
          Type a city, community, neighborhood, or address. View key metrics, price bands, and monthly trends. Share your view with a link, email, or social.
        </p>
      </div>
      <Suspense fallback={<p className="text-zinc-500">Loading explorer…</p>}>
        <ExploreClient initialCity={city} initialSubdivision={subdivision} initialStart={start} initialEnd={end} />
      </Suspense>
    </main>
  )
}
