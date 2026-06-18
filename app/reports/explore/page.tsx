/**
 * /reports/explore (canonical /housing-market/explore) — interactive market
 * data explorer.
 *
 * KB (kinetic-brutalist) design — Phase 9 page-class migration. Restyled IN
 * PLACE. Every piece of content is preserved:
 *   - export const metadata (canonical + OG + Twitter, /housing-market/explore)
 *   - the page-view tracking trio (getSession + getFubPersonIdFromCookie +
 *     trackPageViewIfPossible) — unchanged
 *   - all 11 searchParam-derived initial values + the YTD-preset detection
 *   - the Suspense-streamed <ExploreClient> with EVERY prop intact (the
 *     interactive filters, recharts, share, voice/plain-language search all keep
 *     their logic — this is a wrapper restyle, not a rebuild)
 *   - the breadcrumb (Market reports › Explore) and the hero copy
 *
 * Only the presentation changed: KB shell (KbNav, KbBreadcrumb, KbFooter,
 * SmoothScrollProvider, KbSectionTracker pageType='market-reports'), Amboqia
 * display hero, hard-edge cream surface.
 */

import type { Metadata } from 'next'
import { Suspense } from 'react'
import ExploreClient from './ExploreClient'
import { getSession } from '@/app/actions/auth'
import { getFubPersonIdFromCookie } from '@/app/actions/fub-identity-bridge'
import { trackPageViewIfPossible } from '@/lib/followupboss'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Explore Market Data',
  description:
    'Interactive market explorer: filter by city and date range, view key metrics, price bands, and trends. Share your view via link, email, or social.',
  alternates: { canonical: `${siteUrl}/housing-market/explore` },
  openGraph: {
    title: 'Explore Market Data | Ryan Realty',
    description: 'Interactive market data: metrics, price bands, and trends by city and period. Share your view.',
    url: `${siteUrl}/housing-market/explore`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty explore market data' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Explore Market Data | Ryan Realty',
    description: 'Interactive market data by city and period. Share your view.',
    images: [defaultOgImage],
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
  const includeCommercial = params?.commercial === '1'
  const initialMinPrice = parseNum(params?.minPrice)
  const initialMaxPrice = parseNum(params?.maxPrice)
  const now = new Date()
  const ytdStart = `${now.getFullYear()}-01-01`
  const ytdEnd = now.toISOString().slice(0, 10)
  const initialPresetId = start && end && start === ytdStart && end === ytdEnd ? 'ytd' : undefined

  const pageUrl = `${siteUrl}/housing-market/explore`
  const pageTitle = 'Explore Market Data | Ryan Realty'
  trackPageViewIfPossible({ sessionUser: session?.user ?? undefined, fubPersonId, pageUrl, pageTitle })

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="market-reports" />
      <KbBreadcrumb
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Market reports', href: '/housing-market/reports' },
          { label: 'Explore' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + intro copy as the prior navy hero, in the KB Amboqia
            display. Two lines per the KB hero rhythm. */}
        <section className="section" id="explore-hero" aria-label="Explore market data">
          <div className="wrap">
            <div className="sec-head">
              <span className="sec-index">Central Oregon · Live data</span>
            </div>
            <div className="pt-7" style={{ maxWidth: '24ch' }}>
              <h1 className="display" style={{ fontSize: 'clamp(2.4rem,8vw,6rem)', lineHeight: 0.9 }}>
                Explore<br />market data
              </h1>
            </div>
            <p
              className="mt-5"
              style={{
                color: 'var(--navy-70)',
                fontSize: 'clamp(1rem,1.8vw,1.25rem)',
                lineHeight: 1.5,
                maxWidth: '62ch',
              }}
            >
              Search by city, community, or address. Choose any date range, property type, and price range.
              View key metrics, price bands, and monthly trends. Share your view via link, email, or social.
            </p>
          </div>
        </section>

        {/* Interactive explorer — Suspense-streamed. ExploreClient keeps its full
            logic (filters, recharts, share, plain-language + voice search) and
            EVERY prop. Only the surrounding chrome changed. */}
        <section className="section" id="explorer" aria-label="Market data explorer">
          <div className="wrap pb-16">
            <Suspense
              fallback={
                <p className="mono-lab" role="status" aria-live="polite" style={{ color: 'var(--navy-70)' }}>
                  Loading explorer…
                </p>
              }
            >
              <ExploreClient
                initialCity={city}
                initialSubdivision={subdivision}
                initialStart={start}
                initialEnd={end}
                initialPresetId={initialPresetId}
                initialIncludeCondoTown={includeCondoTown}
                initialIncludeManufactured={includeManufactured}
                initialIncludeAcreage={includeAcreage}
                initialIncludeCommercial={includeCommercial}
                initialMinPrice={initialMinPrice}
                initialMaxPrice={initialMaxPrice}
              />
            </Suspense>
          </div>
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
