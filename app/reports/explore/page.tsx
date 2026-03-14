import type { Metadata } from 'next'
import { Suspense } from 'react'
import ExploreClient from './ExploreClient'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

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

function parseNum(value: string | string[] | undefined): number | undefined {
  if (value == null) return undefined
  const s = typeof value === 'string' ? value : value[0]
  const n = parseInt(s, 10)
  return Number.isFinite(n) ? n : undefined
}

export default async function ExplorePage({ searchParams }: Props) {
  const [params, session, fubPersonId] = await Promise.all([
    searchParams,
    getSession(),
    getFubPersonIdFromCookie(),
  ])
  const city = typeof params?.city === 'string' ? params.city : ''
  const subdivision = typeof params?.subdivision === 'string' ? params.subdivision : ''
  const start = typeof params?.start === 'string' ? params.start : ''
  const end = typeof params?.end === 'string' ? params.end : ''
  const includeCondoTown = params?.condo === '1'
  const includeManufactured = params?.mfd === '1'
  const includeAcreage = params?.acre === '1'
  const initialMinPrice = parseNum(params?.minPrice)
  const initialMaxPrice = parseNum(params?.maxPrice)

  const pageUrl = `${siteUrl}/reports/explore`
  const pageTitle = 'Explore Market Data | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  return (
    <main className="min-h-screen bg-background">
      <section className="bg-primary px-4 py-12 sm:px-6 sm:py-16">
        <div className="mx-auto max-w-6xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            Explore market data
          </h1>
          <p className="mt-3 text-lg text-muted">
            Search by city, community, or address. Choose any date range, property type, and price range. View key metrics, price bands, and monthly trends. Share your view via link, email, or social.
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <Suspense fallback={<p className="text-muted-foreground">Loading explorer…</p>}>
          <ExploreClient
            initialCity={city}
            initialSubdivision={subdivision}
            initialStart={start}
            initialEnd={end}
            initialIncludeCondoTown={includeCondoTown}
            initialIncludeManufactured={includeManufactured}
            initialIncludeAcreage={includeAcreage}
            initialMinPrice={initialMinPrice}
            initialMaxPrice={initialMaxPrice}
          />
        </Suspense>
      </section>
    </main>
  )
}
