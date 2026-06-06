/**
 * Central Oregon region market page.
 *
 * Data ONLY through @/lib/data. No @/app/actions/* imports (G8).
 * Composes Wave 2 Layer 3 blocks per parity.json contract.
 *
 * Mockup reference: design_system/ryan-realty/ui_kits/market-report/index.html
 *   (dedicated region mockup is a follow-up deliverable)
 * Parity contract:  design_system/ryan-realty/ui_kits/market-report-region/parity.json
 *
 * Section order:
 *   1. MetadataBlock — breadcrumb + webPage + dataset + faqPage JSON-LD (G34)
 *   2. BreadcrumbNav — Home > Housing market > Central Oregon
 *   3. HeroBlock — DisplayHeading H1 + data-driven region lede
 *   4. MarketSnapshot — region-level 4-stat band (no citySlug = region aggregate)
 *   5. CityComparisonTable — per-city pulse comparison from ONE snapshot call
 *   6. FAQBlock — region market FAQ (includeJsonLd=true)
 *   7. ContentSection — market narrative + methodology trace
 *   8. LeadCaptureBlock — broker inquiry (variant='inquiry')
 *   9. RelatedAreas — per-city links with active counts
 *  10. CTABar — navy broker contact band
 *
 * Data accuracy (CLAUDE.md §0):
 *   - Region pulse via getMarketPulse({geoType:'region', geoSlug:'central-oregon'})
 *     from market_pulse_live, property_type='A'. Freshness 10-15 min.
 *   - City comparison via ONE getMarketPulseCitySnapshots call. Replaces the
 *     legacy ~12-call per-city pulse fan-out in the prior version of this file.
 *   - Dataset.dateModified = regionPulse.refreshedAt (real DB timestamp, never now()).
 *   - buildMarketFaq is the single source feeding FAQ, FAQPage JSON-LD,
 *     and Dataset variableMeasured, so the three surfaces can never diverge.
 */

import type { Metadata } from 'next'
import {
  getMarketPulse,
  getMarketPulseCitySnapshots,
  getPriceHistory,
} from '@/lib/data'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { CityComparisonRow } from '@/components/site/CityComparisonTable'
import type { RelatedAreaItem } from '@/components/site/RelatedAreas'

import { BreadcrumbNav } from '@/components/site/BreadcrumbNav'
import { HeroBlock } from '@/components/site/HeroBlock'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import { PriceChart } from '@/components/site/PriceChart'
import { CityComparisonTable } from '@/components/site/CityComparisonTable'
import { FAQBlock } from '@/components/site/FAQBlock'
import { ContentSection } from '@/components/site/ContentSection'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import { RelatedAreas } from '@/components/site/RelatedAreas'
import { CTABar } from '@/components/site/CTABar'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { Container } from '@/components/site/primitives'
import { submitMarketPageInquiry } from '@/app/housing-market/actions'

export const revalidate = 300

// ---------------------------------------------------------------------------
// Central Oregon cities for the comparison table and related areas.
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
// Metadata
// ---------------------------------------------------------------------------

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Central Oregon market report',
    description:
      'Regional market data for Central Oregon: active inventory, median list price, months of supply, and pace by city. ' +
      'Single-family homes. Updated every 15 minutes from Oregon Data Share.',
    path: '/housing-market/central-oregon',
    keywords: [
      'Central Oregon housing market',
      'Central Oregon real estate market',
      'Central Oregon market report',
      'Bend Redmond Sisters market data',
      'Oregon real estate market',
      'Ryan Realty',
    ],
  })
}

// ---------------------------------------------------------------------------
// Market narrative — data-driven from verified region pulse figures.
// ---------------------------------------------------------------------------

function buildRegionNarrative(
  pulse: { activeCount: number; medianListPrice: number | null; monthsOfSupply: number | null; medianDaysToPending: number | null } | null,
  refreshedAt: string | null,
): { what: string; method: string } {
  if (!pulse) {
    return {
      what: 'Live market data for Central Oregon is being compiled. Check back shortly.',
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
    parts.push(`Central Oregon currently has ${active.toLocaleString()} active single-family homes for sale across all cities.`)
  }

  if (mos != null) {
    const rounded = Math.round(mos * 10) / 10
    parts.push(
      `At ${rounded} months of supply, the region sits in ${verdict}. ` +
        `A balanced market runs between 4 and 6 months. ` +
        `Below 4 months benefits sellers; above 6 months benefits buyers.`,
    )
  }

  if (median != null) {
    const r = Math.round(median / 1000) * 1000
    parts.push(`The region median list price stands at $${r.toLocaleString()}.`)
  }

  if (dom != null && dom > 0) {
    parts.push(`Homes are going pending in a median of ${dom} days across the region.`)
  }

  const what = parts.join(' ')

  const method = refreshedAt
    ? `Data source: market_pulse_live, single-family homes (property_type = A), ` +
      `geo_type = region, geo_slug = central-oregon, refreshed ${new Date(refreshedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'America/Los_Angeles' })}. ` +
      `City comparison from market_pulse_live geo_type = city rows for the same property_type. ` +
      `Months of supply = active listings divided by (closed last 30 days times 2). ` +
      `Under 4 months is a seller's market, 4 to 6 is balanced, over 6 is a buyer's market. ` +
      `Source: Oregon Data Share via Ryan Realty.`
    : ''

  return { what, method }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function CentralOregonRegionPage() {
  // -------------------------------------------------------------------------
  // Data — all via @/lib/data (G8). No @/app/actions/* imports.
  //
  // §0 trace:
  //   regionPulse   — market_pulse_live, geo_type='region', geo_slug='central-oregon',
  //                   property_type='A'. Freshness 10-15 min. Source: getMarketPulse.
  //   citySnapshots — market_pulse_live, geo_type='city', geo_label IN
  //                   COMPARISON_CITY_LABELS, property_type='A'.
  //                   ONE call replaces the legacy ~12-call per-city fan-out.
  //                   Source: getMarketPulseCitySnapshots.
  // -------------------------------------------------------------------------
  const [regionPulse, citySnapshots, priceHistory] = await Promise.all([
    getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null),
    getMarketPulseCitySnapshots(COMPARISON_CITY_LABELS).catch(() => []),
    getPriceHistory('region', 'central-oregon', 'monthly', 24).catch(() => []),
  ])

  // Drop the in-progress current month so the chart edge is not a misleading
  // partial-month spike (same pattern as the city/flagship page).
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
  const refreshedAt = regionPulse?.refreshedAt ?? null

  // -------------------------------------------------------------------------
  // buildMarketFaq is the SINGLE source for FAQ, FAQPage JSON-LD, and
  // Dataset variableMeasured. All three surfaces draw from one verified pulse.
  // -------------------------------------------------------------------------
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq('Central Oregon', regionPulse)

  // -------------------------------------------------------------------------
  // Hero lede — data-driven from the region pulse.
  // -------------------------------------------------------------------------
  const ledeParts: string[] = []
  if (regionPulse && regionPulse.activeCount > 0) {
    ledeParts.push(`${regionPulse.activeCount.toLocaleString()} active single-family homes across Central Oregon.`)
  }
  if (regionPulse?.medianListPrice != null) {
    const r = Math.round(regionPulse.medianListPrice / 1000) * 1000
    ledeParts.push(`Region median list price $${r.toLocaleString()}.`)
  }
  if (regionPulse?.monthsOfSupply != null) {
    const mos = Math.round(regionPulse.monthsOfSupply * 10) / 10
    let verdict = 'balanced market'
    if (mos <= 4) verdict = "seller's market"
    else if (mos >= 6) verdict = "buyer's market"
    ledeParts.push(`${mos} months of supply: ${verdict}.`)
  }
  const lede = ledeParts.join(' ')

  // -------------------------------------------------------------------------
  // JSON-LD schemas — breadcrumb + webPage + dataset.
  // FAQPage is emitted by FAQBlock (includeJsonLd=true) below.
  // -------------------------------------------------------------------------
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Housing market', url: '/housing-market' },
        { name: 'Central Oregon', url: '/housing-market/central-oregon' },
      ],
    },
    {
      type: 'webPage',
      name: 'Central Oregon market report',
      description:
        'Live Central Oregon regional market data: active inventory, median list price, months of supply, and pace. Single-family homes only.',
      url: '/housing-market/central-oregon',
    },
  ]

  // Dataset schema — emit only when we have at least one verified variable.
  // §0: dateModified is the real refreshedAt from market_pulse_live, never now().
  if (datasetVariables.length > 0 && refreshedAt) {
    schemas.push({
      type: 'dataset',
      name: `Central Oregon, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description:
        'Live single-family home market data for Central Oregon. ' +
        'Includes region median list price, active inventory, months of supply, and median days to pending. ' +
        'Sourced from Oregon Data Share via Ryan Realty.',
      url: '/housing-market/central-oregon',
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: datasetVariables,
    })
  }

  // -------------------------------------------------------------------------
  // City comparison table data — from ONE getMarketPulseCitySnapshots call.
  // §0: every value is exactly what came from market_pulse_live; the component
  // owns display-level formatting, not this layer.
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
  // Related areas — same city snapshots, framed as navigation tiles.
  // -------------------------------------------------------------------------
  const relatedItems: RelatedAreaItem[] = citySnapshots
    .filter((s) => COMPARISON_CITY_SLUGS[s.geo_label] !== undefined)
    .slice(0, 8)
    .map((s) => ({
      name: s.geo_label,
      href: `/housing-market/${COMPARISON_CITY_SLUGS[s.geo_label] ?? s.geo_slug}`,
      activeCount: s.active_count > 0 ? s.active_count : null,
    }))

  // -------------------------------------------------------------------------
  // Narrative — data-driven prose from the verified region pulse.
  // -------------------------------------------------------------------------
  const { what: narrativeWhat, method: narrativeMethod } = buildRegionNarrative(
    regionPulse,
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
            { label: 'Central Oregon' },
          ]}
        />
      </Container>

      {/* Hero — DisplayHeading H1 in Amboqia via HeroBlock.
          lede is data-driven from regionPulse (market_pulse_live). */}
      <HeroBlock
        headline="Central Oregon market report"
        lede={lede || 'Single-family market data across Central Oregon, updated every 15 minutes from Oregon Data Share.'}
        minHeight={480}
      />

      {/* Region market snapshot — no citySlug = region aggregate.
          Reads market_pulse_live geo_type='region', geo_slug='central-oregon'. */}
      <MarketSnapshot />

      {/* Region price trend — monthly median sale price from market_stats_cache
          (region rows confirmed). Completed months only; partial month dropped. */}
      {completePriceMonths.length >= 6 ? (
        <PriceChart
          eyebrow="12-month trend"
          title="Central Oregon median sale price"
          intro="Monthly median sale price for single-family homes across Central Oregon, completed months only. Source: Oregon Data Share via Ryan Realty."
          data={completePriceMonths}
          tone="default"
        />
      ) : null}

      {/* City comparison — ONE getMarketPulseCitySnapshots call replaces
          the legacy per-city pulse fan-out. §0: every figure is the exact
          value returned from market_pulse_live for that city row. */}
      {comparisonCities.length > 0 ? (
        <CityComparisonTable
          cities={comparisonCities}
          eyebrow="City by city"
          title="Central Oregon market comparison"
          tone="muted"
        />
      ) : null}

      {/* FAQ — region market Q&A from buildMarketFaq (same verified source as Dataset).
          includeJsonLd=true auto-emits FAQPage JSON-LD (G34). */}
      {faqs.length > 0 ? (
        <FAQBlock
          items={faqs}
          eyebrow="Common questions"
          title="Central Oregon real estate questions"
          intro="Direct answers based on live MLS data."
          includeJsonLd={true}
          tone="muted"
        />
      ) : null}

      {/* Market narrative + methodology trace (CLAUDE.md §0 AI-citability). */}
      <ContentSection
        eyebrow="What the numbers say"
        title="Central Oregon market summary"
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

      {/* Lead capture — framed as an inquiry, not a report-subscription promise.
          Submitted via the existing server action (no new stub). */}
      <LeadCaptureBlock
        variant="inquiry"
        onSubmit={submitMarketPageInquiry}
        eyebrow="Talk to a broker"
        title="Questions about the Central Oregon market?"
        intro="Tell us what you are weighing. A local broker will follow up with specifics for your situation. No pressure."
        submitLabel="Ask a broker"
        tone="muted"
      />

      {/* Related areas — city navigation with live active counts. */}
      {relatedItems.length > 0 ? (
        <RelatedAreas
          eyebrow="Central Oregon cities"
          title="Explore city markets"
          items={relatedItems}
          tone="default"
          cols={4}
        />
      ) : null}

      {/* CTA bar — navy broker contact band. */}
      <CTABar
        eyebrow="Questions about Central Oregon?"
        title="Local brokers. Specific numbers. No pressure."
        body="We close deals across Central Oregon. We can tell you what the data means for your situation."
        primary={{ href: '/contact', label: 'Schedule a call' }}
        secondary={{ href: 'tel:5412136706', label: '541.213.6706' }}
        tone="navy"
      />

    </main>
  )
}
