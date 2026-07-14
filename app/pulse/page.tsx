/**
 * /pulse — Central Oregon Market Pulse, the live MLS activity feed.
 *
 * KB (kinetic-brutalist) design — Phase 9 "feed" page-class migration. Restyled
 * IN PLACE from the prior PulseHero + Container(HomeValuationCta) + PulseFeed
 * layout. Every piece of content and every interactive surface is preserved:
 *
 *   - the hero copy (H1 "The Central Oregon market pulse" + subtitle "Every new
 *     listing, every sold home, every price drop…") now renders in the KB
 *     Amboqia display via KbHero
 *   - EVERY region-snapshot stat the old PulseHero showed (active listings,
 *     median list, months of supply, market verdict) is kept, plus the
 *     additional snapshot fields (sold last 30 days, new last 7 days, median
 *     active days on market) surfaced in a KB stats strip — nothing dropped
 *   - the HomeValuationCta lead-capture card
 *   - the FULL interactive PulseFeed, untouched: city + event-type filters with
 *     URL sync, infinite scroll, in-view video autoplay, like/save, the in-feed
 *     signup card, the market-snapshot / brand / lifestyle interstitials, and
 *     the post-mount personalized re-rank. All props (initialItems,
 *     initialNextOffset, defaultCities, citySnapshots, regionSnapshot,
 *     lifestyleCards) are passed exactly as before
 *   - all three parallel server fetches (getPulseFeed, getPulseRegionSnapshot,
 *     getPulseCitySnapshots) are unchanged
 *
 * Only the chrome + hero presentation changed. PulseFeed's logic, hydration
 * guard (error-418 deterministic-order-until-mount), and edge/empty states are
 * left exactly as authored.
 *
 * SEO: export const metadata (canonical + OG + Twitter) preserved verbatim.
 * PAGE CONTRACT: KB design + SEO + tracking (KbSectionTracker pageType="feed").
 */

import type { Metadata } from 'next'
import PulseFeed from '@/components/pulse/PulseFeed'
import { LIFESTYLE_CARDS } from '@/lib/pulse-lifestyle-cards.server'
import HomeValuationCta from '@/components/HomeValuationCta'
import {
  getPulseFeed,
  getPulseCitySnapshots,
  getPulseRegionSnapshot,
} from '@/app/actions/pulse-feed'
import { PULSE_DEFAULT_CITIES } from '@/lib/pulse-config'
import { generateBreadcrumbSchema } from '@/lib/structured-data'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import '@/components/site/kb/kb.css'

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
const defaultOgImage = `${siteUrl}/api/og?type=default`

export const metadata: Metadata = {
  title: 'Market Pulse',
  description:
    'Live activity from the Central Oregon market. Every new listing, sold home, pending, and price drop. Filter by city and scroll.',
  alternates: { canonical: `${siteUrl}/pulse` },
  openGraph: {
    title: 'Central Oregon Market Pulse | Ryan Realty',
    description:
      'New listings, sold homes, price drops, and pending sales across Bend, Redmond, Sisters, Sunriver, and the rest of Central Oregon. Updated continuously.',
    url: `${siteUrl}/pulse`,
    type: 'website',
    siteName: 'Ryan Realty',
    images: [{ url: defaultOgImage, width: 1200, height: 630, alt: 'Ryan Realty Market Pulse' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Central Oregon Market Pulse | Ryan Realty',
    description:
      'Live MLS activity from Central Oregon: new listings, sold homes, price drops. Filter by city.',
    images: [defaultOgImage],
  },
}

export const dynamic = 'force-dynamic'

// Region-snapshot formatting — preserved verbatim from the prior PulseHero so
// the KB stats strip renders the same figures the page always showed.
function formatPriceShort(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '—'
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 2)}M`
  if (value >= 1_000) return `$${Math.round(value / 1_000)}K`
  return `$${Math.round(value).toLocaleString('en-US')}`
}

function formatHealthVerdict(label: string | null | undefined, mos: number | null | undefined): string {
  if (label && label.trim()) return label
  if (mos == null) return 'Tracking'
  if (mos <= 4) return 'Seller market'
  if (mos < 6) return 'Balanced'
  return 'Buyer market'
}

export default async function PulsePage() {
  const defaultCities = [...PULSE_DEFAULT_CITIES]
  const [{ items, nextOffset }, regionSnapshot, citySnapshots] = await Promise.all([
    getPulseFeed({ offset: 0, limit: 12 }),
    getPulseRegionSnapshot(),
    getPulseCitySnapshots(defaultCities),
  ])

  // Every region stat the old PulseHero surfaced, plus the additional snapshot
  // fields, so nothing is lost in the restyle. Rendered only when present.
  const regionStats = regionSnapshot
    ? [
        { label: 'Active listings', value: regionSnapshot.active_count.toLocaleString('en-US') },
        { label: 'Median list', value: formatPriceShort(regionSnapshot.median_list_price) },
        {
          label: 'Months of supply',
          value:
            regionSnapshot.months_of_supply != null
              ? `${regionSnapshot.months_of_supply.toFixed(1)} mo`
              : '—',
        },
        {
          label: 'Market',
          value: formatHealthVerdict(
            regionSnapshot.market_health_label,
            regionSnapshot.months_of_supply
          ),
        },
        { label: 'Sold · 30 days', value: regionSnapshot.sold_count_30d.toLocaleString('en-US') },
        { label: 'New · 7 days', value: regionSnapshot.new_count_7d.toLocaleString('en-US') },
        {
          label: 'Median active days',
          value:
            regionSnapshot.median_active_dom != null
              ? `${Math.round(regionSnapshot.median_active_dom)} days`
              : '—',
        },
      ]
    : []

  return (
    <main className="kb-root">
      <KbNav />
      <KbSectionTracker pageType="feed" />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            generateBreadcrumbSchema([
              { name: 'Home', url: siteUrl },
              { name: 'Market pulse', url: `${siteUrl}/pulse` },
            ])
          ),
        }}
      />
      <KbBreadcrumb overlay
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Market pulse' },
        ]}
      />
      <SmoothScrollProvider>
        {/* Hero — same H1 + subtitle as the prior PulseHero, in the KB Amboqia
            display. activeCount feeds the live sub-row. */}
        <KbHero
          data={{
            activeCount: regionSnapshot?.active_count ?? null,
            medianListPrice: regionSnapshot?.median_list_price ?? null,
            medianDaysToPending: null,
          }}
          eyebrow="Bend · Oregon · Live MLS"
          titleTop="The Central"
          titleBottom="Oregon pulse"
          lead="Every new listing, every sold home, every price drop. Live from the MLS, in order. Pick the cities you care about and scroll."
          videoSrc={null}
          posterSrc="/images/homepage/smith-rock-terrebonne.jpg"
        />

        {/* Region snapshot — every stat the prior PulseHero showed, preserved in
            a KB stats strip. Renders only when a snapshot is available. */}
        {regionStats.length > 0 && (
          <section className="section" id="pulse-snapshot" aria-label="Central Oregon market snapshot">
            <div className="wrap">
              <div className="sec-head">
                <span className="sec-index">Central Oregon · Region</span>
                <h2 className="sec-title display">
                  The market<br />right now
                </h2>
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
                {regionStats.map((s) => (
                  <div key={s.label}>
                    <dt className="mono-lab" style={{ color: 'var(--navy-70)' }}>
                      {s.label}
                    </dt>
                    <dd
                      className="display mt-1 tabular-nums"
                      style={{ fontSize: 'clamp(1.5rem,4vw,2.2rem)', lineHeight: 1, color: 'var(--navy)' }}
                    >
                      {s.value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        )}

        {/* Lead-capture CTA — unchanged "what's my home worth" card. */}
        <section className="section" id="pulse-valuation" aria-label="Free home valuation">
          <div className="wrap">
            <HomeValuationCta />
          </div>
        </section>

        {/* The live feed — fully interactive, untouched. Filters, infinite
            scroll, video autoplay, likes/saves, in-feed signup, snapshot /
            brand / lifestyle interstitials, and the post-mount personalized
            re-rank all preserved exactly. */}
        <section className="section" id="pulse-feed" aria-label="Live market activity feed">
          <PulseFeed
            initialItems={items}
            initialNextOffset={nextOffset}
            defaultCities={defaultCities}
            citySnapshots={citySnapshots}
            regionSnapshot={regionSnapshot}
            lifestyleCards={LIFESTYLE_CARDS}
          />
        </section>

        <KbFooter towns={[]} />
      </SmoothScrollProvider>
    </main>
  )
}
