/**
 * Housing market flagship — per-geo market page.
 *
 * Catch-all route serving BOTH:
 *   /housing-market/<city>                — city-level market page
 *   /housing-market/<city>/<community>    — subdivision/community market page
 *
 * Data ONLY through @/lib/data. No @/app/actions/* imports (G8).
 * Composes Wave 2 Layer 3 blocks per parity.json contract.
 *
 * Mockup reference: design_system/ryan-realty/ui_kits/market-report/index.html
 * Parity contract: design_system/ryan-realty/ui_kits/market-report-detail/parity.json
 *
 * Section order (matches mockup):
 *   1. MetadataBlock — breadcrumb + webPage + dataset + faqPage JSON-LD (G34)
 *   2. BreadcrumbNav — Home > Housing market > {geoName}
 *   3. HeroBlock — DisplayHeading H1 + data-driven lede + Old Mill photo
 *   4. MarketSnapshot — 4 live SFR stat cards
 *   5. PriceChart — 12-month median sale price trend
 *   6. PriceBandTable — inventory by price tier (stubbed until DAL price-band ready)
 *   7. CityComparisonTable — per-city comparison from market_pulse_live
 *   8. ContentSection — narrative + methodology trace
 *   9. FAQBlock — market Q&A (auto-emits FAQPage JSON-LD via includeJsonLd=true)
 *  10. LeadCaptureBlock — monthly report subscription (variant='inquiry')
 *  11. RelatedAreas — nearby Central Oregon cities
 *  12. CTABar — navy broker contact band
 *
 * Data accuracy (CLAUDE.md §0):
 *   - Every on-screen number traces to getMarketPulse (market_pulse_live)
 *     or getPriceHistory (market_stats_cache).
 *   - Dataset.dateModified = pulse.refreshedAt (real DB timestamp, not now()).
 *   - Each Dataset.variableMeasured value = the corresponding on-screen number.
 *   - buildMarketFaq is the single source feeding the FAQ, FAQPage JSON-LD,
 *     and Dataset variableMeasured, so the three surfaces can never diverge.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getMarketPulse,
  getPriceHistory,
  getMarketPulseCitySnapshots,
  getCityMarketDetail,
} from '@/lib/data'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { CityComparisonRow } from '@/components/site/CityComparisonTable'
import type { MarketPulse } from '@/lib/data'

import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import { PriceChart } from '@/components/site/PriceChart'
import { PriceBandTable } from '@/components/site/PriceBandTable'
import { CityComparisonTable } from '@/components/site/CityComparisonTable'
import { ContentSection } from '@/components/site/ContentSection'
import { FAQBlock } from '@/components/site/FAQBlock'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import { CTABar } from '@/components/site/CTABar'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketDetailStats } from '@/components/site/MarketDetailStats'
import { Container, DisplayHeading } from '@/components/site/primitives'

// ---------------------------------------------------------------------------
// Static params — pre-heat the 11 core Central Oregon city slugs at build
// time to avoid cold-start penalty on first organic visit.
// ---------------------------------------------------------------------------

export async function generateStaticParams(): Promise<Array<{ slug: string[] }>> {
  const CORE_CITY_SLUGS = [
    'bend',
    'redmond',
    'sisters',
    'sunriver',
    'la-pine',
    'tumalo',
    'prineville',
    'terrebonne',
    'black-butte-ranch',
    'eagle-crest',
    'crooked-river-ranch',
  ]
  return CORE_CITY_SLUGS.map((s) => ({ slug: [s] }))
}

export const dynamicParams = true
export const revalidate = 300

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Convert a URL slug segment to a display name (title-case). */
function unslug(value: string): string {
  return value
    .split('-')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/**
 * Resolve the DAL geo_type for the catch-all slug.
 * - 1-segment slug:  /housing-market/<city>            → 'city'
 * - 2-segment slug:  /housing-market/<city>/<community>→ 'subdivision'
 *
 * market_pulse_live uses 'subdivision' for community rows and the geo_slug
 * format is "<city>:<community>" for subdivisions.
 */
function resolveGeo(slug: string[]): {
  geoType: 'city' | 'subdivision'
  geoSlug: string
  citySlug: string
  communitySlug: string | null
  cityName: string
  communityName: string | null
  geoName: string
  breadcrumbLabel: string
} {
  const citySlug = slug[0] ?? ''
  const communitySlug = slug[1] ?? null
  const cityName = unslug(citySlug)
  const communityName = communitySlug ? unslug(communitySlug) : null
  const geoName = communityName ?? cityName

  if (communitySlug) {
    return {
      geoType: 'subdivision',
      // market_pulse_live uses "<city>:<community>" for subdivision rows.
      geoSlug: `${citySlug}:${communitySlug}`,
      citySlug,
      communitySlug,
      cityName,
      communityName,
      geoName,
      breadcrumbLabel: `${cityName} > ${communityName}`,
    }
  }

  return {
    geoType: 'city',
    geoSlug: citySlug,
    citySlug,
    communitySlug: null,
    cityName,
    communityName: null,
    geoName: cityName,
    breadcrumbLabel: cityName,
  }
}

// ---------------------------------------------------------------------------
// Market narrative — data-driven prose from verified MoS verdict
// ---------------------------------------------------------------------------

function buildNarrative(
  geoName: string,
  pulse: MarketPulse | null,
  refreshedAt: string | null,
): { what: string; method: string } {
  if (!pulse) {
    return {
      what: `Live market data for ${geoName} is being compiled. Check back shortly.`,
      method: '',
    }
  }

  const mos = pulse.monthsOfSupply
  const active = pulse.activeCount
  const median = pulse.medianListPrice
  const dom = pulse.medianDaysToPending

  let verdict = 'a balanced market'
  if (mos != null) {
    if (mos <= 4) verdict = "a seller's market"
    else if (mos >= 6) verdict = "a buyer's market"
  }

  const parts: string[] = []

  if (active > 0) {
    parts.push(`${geoName} currently has ${active.toLocaleString()} active single-family homes for sale.`)
  }

  if (mos != null) {
    const rounded = Math.round(mos * 10) / 10
    parts.push(
      `At ${rounded} months of supply, the market sits in ${verdict}. ` +
        `A balanced market runs between 4 and 6 months. ` +
        `Below 4 months benefits sellers; above 6 months benefits buyers.`,
    )
  }

  if (median != null) {
    const r = Math.round(median / 1000) * 1000
    parts.push(`The median list price stands at $${r.toLocaleString()}.`)
  }

  if (dom != null && dom > 0) {
    parts.push(`Homes are going pending in a median of ${dom} days.`)
  }

  const what = parts.join(' ')

  // Methodology trace — required by CLAUDE.md §0 for AI-citability.
  const method = refreshedAt
    ? `Data source: market_pulse_live, single-family homes (property_type = A), ` +
      `geo_type = city, refreshed ${new Date(refreshedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })}. ` +
      `Price trend from market_stats_cache monthly aggregates. Months of supply = active listings divided by (closed last 30 days times 2). ` +
      `Under 4 months is a seller's market, 4 to 6 is balanced, over 6 is a buyer's market. ` +
      `Source: Oregon Data Share via Ryan Realty.`
    : ''

  return { what, method }
}

// ---------------------------------------------------------------------------
// Import the shared server action for inquiry submission.
// ---------------------------------------------------------------------------
import { submitMarketPageInquiry } from '@/app/housing-market/actions'

// ---------------------------------------------------------------------------
// Metadata
// ---------------------------------------------------------------------------

type Props = { params: Promise<{ slug: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!slug || slug.length === 0) return {}

  const { geoName, geoType, geoSlug, citySlug } = resolveGeo(slug)
  const canonicalPath = `/housing-market/${slug.map(encodeURIComponent).join('/')}`

  return pageMetadata({
    title: `${geoName} housing market`,
    description:
      `Live ${geoName} market data: active inventory, median list price, months of supply, and pace. ` +
      `Single-family homes. Updated every 15 minutes from Oregon Data Share.`,
    path: canonicalPath,
    keywords: [
      `${geoName} housing market`,
      `${geoName} real estate`,
      `${geoName} homes for sale`,
      `${citySlug} market stats`,
      'Central Oregon',
      'Ryan Realty',
    ],
  })
}

// ---------------------------------------------------------------------------
// Central Oregon cities for comparison table and related areas.
// Defined here so generateStaticParams and the page share the same set.
// ---------------------------------------------------------------------------

const COMPARISON_CITY_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
]

const COMPARISON_CITY_SLUGS: Record<string, string> = {
  'Bend': 'bend',
  'Redmond': 'redmond',
  'Sisters': 'sisters',
  'Sunriver': 'sunriver',
  'La Pine': 'la-pine',
  'Tumalo': 'tumalo',
  'Prineville': 'prineville',
  'Terrebonne': 'terrebonne',
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function HousingMarketGeoPage({ params }: Props) {
  const { slug } = await params
  if (!slug || slug.length === 0) notFound()

  const geo = resolveGeo(slug)
  const { geoType, geoSlug, citySlug, geoName, cityName, communityName } = geo
  const canonicalPath = `/housing-market/${slug.map(encodeURIComponent).join('/')}`

  // -------------------------------------------------------------------------
  // Data — all via @/lib/data (G8). No @/app/actions/* imports.
  //
  // §0 trace:
  //   pulse       — market_pulse_live, geo_type={geoType}, geo_slug={geoSlug},
  //                 property_type='A'. Freshness 10-15 min. Source: getMarketPulse.
  //   priceHistory — market_stats_cache, geo_type={geoType}, geo_slug={geoSlug},
  //                  period_type='monthly', limit=24. Source: getPriceHistory.
  //   citySnapshots — market_pulse_live, geo_type='city', geo_slug IN
  //                   COMPARISON_CITY_LABELS. Source: getMarketPulseCitySnapshots.
  //   detail      — market_stats_cache, full projection, most recent monthly row.
  //                 Source: getCityMarketDetail. Used by MarketDetailStats section.
  //                 City-level only (market_stats_cache city rows verified).
  // -------------------------------------------------------------------------
  const [pulse, priceHistory, citySnapshots, detail] = await Promise.all([
    getMarketPulse({ geoType, geoSlug }).catch(() => null),
    getPriceHistory(geoType, geoSlug, 'monthly', 24).catch(() => []),
    getMarketPulseCitySnapshots(COMPARISON_CITY_LABELS).catch(() => []),
    geoType === 'city'
      ? getCityMarketDetail({ geoType, geoSlug, periodType: 'monthly' }).catch(() => null)
      : Promise.resolve(null),
  ])

  // Drop in-progress current month from price series to avoid a misleading
  // partial-month spike at the chart edge (same pattern as city page).
  const currentMonthKey = new Date()
    .toLocaleDateString('en-CA', { timeZone: 'America/Los_Angeles' })
    .slice(0, 7)
  const completePriceMonths = priceHistory.filter(
    (p) => p.periodStart.slice(0, 7) !== currentMonthKey,
  )

  // -------------------------------------------------------------------------
  // §0: Dataset.dateModified = pulse.refreshedAt (real refresh ts from
  // market_pulse_live). Never a hardcoded or derived date.
  // -------------------------------------------------------------------------
  const refreshedAt = pulse?.refreshedAt ?? null

  // -------------------------------------------------------------------------
  // buildMarketFaq is the SINGLE source for:
  //   1. Visible FAQ items (on-screen)
  //   2. FAQPage JSON-LD (emitted by FAQBlock)
  //   3. Dataset variableMeasured (passed to MetadataBlock)
  // This ensures the three surfaces can never diverge (§0 compliance).
  // -------------------------------------------------------------------------
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(geoName, pulse)

  // -------------------------------------------------------------------------
  // Hero lede — data-driven, no marketing adjectives (CLAUDE.md brand voice).
  // Numbers come from pulse (market_pulse_live), the same source MarketSnapshot
  // uses, so the hero and the stat band can never show different figures.
  // -------------------------------------------------------------------------
  const ledeParts: string[] = []
  if (pulse && pulse.activeCount > 0) {
    ledeParts.push(`${pulse.activeCount.toLocaleString()} single-family homes for sale.`)
  }
  if (pulse?.medianListPrice != null) {
    const r = Math.round(pulse.medianListPrice / 1000) * 1000
    ledeParts.push(`Median list price $${r.toLocaleString()}.`)
  }
  if (pulse?.medianDaysToPending != null && pulse.medianDaysToPending > 0) {
    ledeParts.push(`Median ${pulse.medianDaysToPending} days to pending.`)
  }
  const lede = ledeParts.join(' ')

  // -------------------------------------------------------------------------
  // JSON-LD schemas — emitted through MetadataBlock (not inline script tags).
  // BreadcrumbNav includeJsonLd=false to avoid duplicate BreadcrumbList.
  // -------------------------------------------------------------------------
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Housing market', url: '/housing-market' },
        ...(communityName
          ? [
              { name: cityName, url: `/housing-market/${citySlug}` },
              { name: communityName, url: canonicalPath },
            ]
          : [{ name: geoName, url: canonicalPath }]),
      ],
    },
    {
      type: 'webPage',
      name: `${geoName} housing market`,
      description: `Live ${geoName} market data: active inventory, median list price, months of supply, and pace. Single-family homes only.`,
      url: canonicalPath,
    },
  ]

  // Dataset schema — only emit when we have at least one verified variable
  // to measure. §0: dateModified is the real refreshedAt, never hardcoded.
  if (datasetVariables.length > 0 && refreshedAt) {
    schemas.push({
      type: 'dataset',
      name: `${geoName}, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description:
        `Live single-family home market data for ${geoName}, Oregon. ` +
        `Includes median list price, active inventory, months of supply, and median days to pending. ` +
        `Sourced from Oregon Data Share via Ryan Realty.`,
      url: canonicalPath,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${geoName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  // -------------------------------------------------------------------------
  // City comparison table data — from getMarketPulseCitySnapshots fan-out.
  // §0: every value is exactly what came from market_pulse_live; no rounding
  // beyond display formatting in the component.
  // -------------------------------------------------------------------------
  const comparisonCities: CityComparisonRow[] = citySnapshots
    .filter((s) => COMPARISON_CITY_SLUGS[s.geo_label] !== undefined)
    .map((s) => ({
      slug: COMPARISON_CITY_SLUGS[s.geo_label] ?? s.geo_slug,
      label: s.geo_label,
      activeCount: s.active_count,
      medianListPrice: s.median_list_price,
      monthsOfSupply: s.months_of_supply,
      medianDaysToPending: s.median_active_dom,
    }))

  // -------------------------------------------------------------------------
  // Related areas — other Central Oregon cities (excluding the current one).
  // activeCount from the citySnapshots fan-out (same source, same timestamp).
  // -------------------------------------------------------------------------
  const relatedItems: RelatedAreaItem[] = citySnapshots
    .filter((s) => {
      const sSlug = COMPARISON_CITY_SLUGS[s.geo_label]
      return sSlug !== undefined && sSlug !== citySlug
    })
    .slice(0, 8)
    .map((s) => ({
      name: s.geo_label,
      href: `/housing-market/${COMPARISON_CITY_SLUGS[s.geo_label] ?? s.geo_slug}`,
      activeCount: s.active_count > 0 ? s.active_count : null,
    }))

  // -------------------------------------------------------------------------
  // Narrative — dynamically generated from the same verified pulse numbers.
  // -------------------------------------------------------------------------
  const { what: narrativeWhat, method: narrativeMethod } = buildNarrative(
    geoName,
    pulse,
    refreshedAt,
  )

  return (
    <main className="min-h-screen bg-background">

      {/* AI-citability structured data: breadcrumb + webPage + Dataset.
          BreadcrumbNav below has includeJsonLd=false to avoid a duplicate
          BreadcrumbList. FAQPage is emitted by FAQBlock further down. */}
      <MetadataBlock schemas={schemas} />

      {/* Breadcrumb */}
      <Container className="pt-3 pb-1">
        <BreadcrumbNav
          includeJsonLd={false}
          items={[
            { label: 'Home', href: '/' },
            { label: 'Housing market', href: '/housing-market' },
            ...(communityName
              ? [
                  { label: cityName, href: `/housing-market/${citySlug}` },
                  { label: communityName },
                ]
              : [{ label: geoName }]),
          ]}
        />
      </Container>

      {/* Hero — DisplayHeading H1 in Amboqia via HeroBlock.
          lede is data-driven from pulse (market_pulse_live). */}
      <HeroBlock
        headline={`${geoName} housing market`}
        lede={lede || `Single-family market data for ${geoName}, Oregon.`}
        minHeight={480}
      />

      {/* Market snapshot — city-scoped 4-stat cards from market_pulse_live.
          City-level ONLY: market_pulse_live has no subdivision rows, and
          MarketSnapshot is city-scoped, so rendering it on a community URL
          would show the parent city's stats mislabeled as the community.
          MarketSnapshot fetches independently via getMarketPulse so its
          internal data is consistent with the hero lede above. */}
      {geoType === 'city' ? (
        <MarketSnapshot citySlug={citySlug} cityName={geoName} />
      ) : null}

      {/* Price trend — verified monthly median SALE price (market_stats_cache,
          SFR-only). Completed months only; partial current month dropped. */}
      {completePriceMonths.length >= 6 ? (
        <PriceChart
          eyebrow="12-month trend"
          title={`${geoName} median sale price`}
          intro="Monthly median sale price for single-family homes, completed months only. Source: Oregon Data Share via Ryan Realty."
          data={completePriceMonths}
          tone="muted"
        />
      ) : null}

      {/* Fuller market stats — closed-sales detail from market_stats_cache.
          §0: every number traces to getCityMarketDetail (confirmed-existing
          columns only). City-level only; subdivision detail deferred until
          market_stats_cache subdivision rows are verified. */}
      {geoType === 'city' ? (
        <MarketDetailStats detail={detail} geoName={geoName} />
      ) : null}

      {/* Price-band breakdown.
          TODO: Pass real items once a DAL price-band aggregation exists.
          See PriceBandTable.tsx for the full TODO and the data shape.
          Until then items=[] renders the "coming soon" stub. */}
      <PriceBandTable
        items={[]}
        geoName={geoName}
        eyebrow="Price bands"
        title={`Where ${geoName} activity is`}
        tone="default"
      />

      {/* City comparison — per-city pulse data.
          §0: every figure is the exact value returned from getMarketPulseCitySnapshots. */}
      {comparisonCities.length > 0 ? (
        <CityComparisonTable
          cities={comparisonCities}
          currentCitySlug={citySlug}
          eyebrow="Central Oregon comparison"
          title={`How ${geoName} compares`}
          tone="muted"
        />
      ) : null}

      {/* Market narrative + methodology trace (CLAUDE.md §0 AI-citability). */}
      <ContentSection
        eyebrow="What the numbers say"
        title={`${geoName} market summary`}
        tone="default"
        divider
      >
        <div className="flex flex-col gap-4 text-muted-foreground text-base leading-relaxed">
          <p>{narrativeWhat}</p>
          {narrativeMethod ? (
            <p className="text-xs text-muted-foreground border-t border-border pt-4 mt-2">
              <strong className="text-foreground">Methodology:</strong>{' '}
              {narrativeMethod}
            </p>
          ) : null}
        </div>
      </ContentSection>

      {/* FAQ — market Q&A from buildMarketFaq (same verified source as Dataset).
          includeJsonLd=true auto-emits FAQPage JSON-LD (G34). */}
      {faqs.length > 0 ? (
        <FAQBlock
          items={faqs}
          eyebrow="Common questions"
          title={`${geoName} real estate questions`}
          intro="Direct answers based on live MLS data."
          includeJsonLd={true}
          tone="muted"
        />
      ) : null}

      {/* Lead capture — broker inquiry (captured via submitPageCTA -> FUB).
          Framed as an inquiry, not a "monthly report" promise, because there
          is no report-email automation to honor that promise (§0 honesty). */}
      <LeadCaptureBlock
        variant="inquiry"
        onSubmit={submitMarketPageInquiry}
        eyebrow="Talk to a broker"
        title={`Questions about the ${geoName} market?`}
        intro="Tell us what you are weighing. A local broker will follow up with specifics for your situation. No pressure."
        submitLabel="Ask a broker"
        tone="muted"
      />

      {/* Related areas — other Central Oregon cities. */}
      {relatedItems.length > 0 ? (
        <RelatedAreas
          eyebrow="Central Oregon cities"
          title="Explore other markets"
          items={relatedItems}
          tone="default"
          cols={4}
        />
      ) : null}

      {/* CTA bar — navy broker contact band. */}
      <CTABar
        eyebrow={`Questions about ${geoName}?`}
        title="Local brokers. Specific numbers. No pressure."
        body={`We close deals in ${geoName} and across Central Oregon. We can tell you what the data means for your situation.`}
        primary={{ href: '/contact', label: 'Schedule a call' }}
        secondary={{ href: 'tel:5412136706', label: '541.213.6706' }}
        tone="navy"
      />

    </main>
  )
}
