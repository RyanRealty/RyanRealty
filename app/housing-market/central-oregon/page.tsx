/**
 * Central Oregon region market report — KB (kinetic-brutalist) design.
 *
 * Converted from Wave 2 site blocks to the KB section library (Phase 9,
 * docs/KB_CONVERGENCE_ROADMAP.md). Reuses components/site/kb/* AS-IS; no fork.
 *
 * THE PAGE CONTRACT: KB design + SEO (pageMetadata + MetadataBlock JSON-LD:
 * BreadcrumbList/WebPage/Dataset/FAQPage) + KbSectionTracker pageType="market-report".
 * Every figure live and traced to a @/lib/data source (§0).
 *
 * Section order:
 *   1. MetadataBlock    — BreadcrumbList + WebPage + Dataset JSON-LD (AI-citability G34)
 *   2. KbNav            — KB chrome
 *   3. KbSectionTracker — page-level analytics (pageType="market-report")
 *   4. KbBreadcrumb     — Home > Housing market > Central Oregon
 *   5. SmoothScrollProvider wrapper
 *   6. KbHero           — region eyebrow + glance lede
 *   7. KbMarketHud      — region KbMarketData (§0-traced figures + yearSeries)
 *   8. KbExploreTowns   — per-city tiles with live active counts
 *   9. KbArticles       — related reports/guides from blog_posts
 *  10. FAQBlock         — region FAQ (includeJsonLd=true → FAQPage JSON-LD)
 *  11. KbSell           — seller conversion
 *  12. KbFooter         — full sitemap close
 *
 * Data accuracy (CLAUDE.md §0):
 *   regionPulse   — market_pulse_live, geo_type='region', geo_slug='central-oregon',
 *                   property_type='A'. Freshness 10-15 min. Source: getMarketPulse.
 *   priceHistory  — market_stats_cache region rows. Source: getPriceHistory.
 *   citySnapshots — market_pulse_live, geo_type='city', cityLabels in CITY_LABELS.
 *                   ONE call. Source: getMarketPulseCitySnapshots.
 *   blogPosts     — blog_posts, published, newest first. Source: getRecentBlogPosts.
 *   Dataset.dateModified = regionPulse.refreshedAt (real DB timestamp, never now()).
 *   buildMarketFaq is the single source feeding FAQ, FAQPage JSON-LD, and
 *   Dataset variableMeasured, so the three surfaces cannot diverge.
 *
 * Parity contract: design_system/ryan-realty/ui_kits/market-report-region/parity.json
 */

import type { Metadata } from 'next'
import {
  getMarketPulse,
  getMarketPulseCitySnapshots,
  getPriceHistory,
  getRecentBlogPosts,
} from '@/lib/data'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildYearSeries } from '@/lib/kb/year-series'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { KbMarketData, KbTownItem } from '@/components/site/kb/types'
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { FAQBlock } from '@/components/site/FAQBlock'
import '@/components/site/kb/kb.css'

export const revalidate = 300

// ---------------------------------------------------------------------------
// City label → slug map (drives KbExploreTowns items + Dataset spatialCoverage)
// ---------------------------------------------------------------------------

const CITY_LABELS = [
  'Bend',
  'Redmond',
  'Sisters',
  'Sunriver',
  'La Pine',
  'Tumalo',
  'Prineville',
  'Terrebonne',
]

const CITY_SLUG: Record<string, string> = {
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
// Page
// ---------------------------------------------------------------------------

export default async function CentralOregonRegionPage() {
  // -------------------------------------------------------------------------
  // Data — all via @/lib/data (G8). No @/app/actions/* imports.
  //
  // §0 trace:
  //   regionPulse   — market_pulse_live, geo_type='region', geo_slug='central-oregon',
  //                   property_type='A'. Freshness 10-15 min.
  //   priceHistory  — market_stats_cache, geo_type='region', geo_slug='central-oregon',
  //                   interval='monthly', 60 months.
  //   citySnapshots — market_pulse_live, geo_type='city', geo_label IN CITY_LABELS,
  //                   property_type='A'. ONE call replaces legacy ~12-call fan-out.
  //   blogPosts     — blog_posts, status='published', newest first. Up to 3.
  // -------------------------------------------------------------------------
  const [regionPulse, priceHistory, citySnapshots, blogPosts] = await Promise.all([
    getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }).catch(() => null),
    getPriceHistory('region', 'central-oregon', 'monthly', 60).catch(() => []),
    getMarketPulseCitySnapshots(CITY_LABELS).catch(() => []),
    getRecentBlogPosts({ limit: 3 }).catch(() => []),
  ])

  // Drop the in-progress current month — partial-month spike is misleading.
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
  // buildMarketFaq — SINGLE source for FAQ, FAQPage JSON-LD, and
  // Dataset variableMeasured. All three surfaces draw from one verified pulse.
  // -------------------------------------------------------------------------
  // Pulse-timeout fallback (G52 page-contract): the Dataset + FAQPage JSON-LD must
  // survive a slow or missing region market row, so feed buildMarketFaq a
  // pulse-or-fallback input rather than a bare nullable pulse. Null fields degrade
  // gracefully inside buildMarketFaq (a stat with no value is omitted, never
  // fabricated — §0); the structured-data block itself never vanishes.
  const pulse = regionPulse
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(
    'Central Oregon',
    pulse ?? { activeCount: null, medianListPrice: null, refreshedAt: null },
  )

  // -------------------------------------------------------------------------
  // KbMarketData — §0 traced. Every field maps to a single DAL source.
  //   active / closed30 / medianList / daysToPending / monthsSupply
  //     → regionPulse (market_pulse_live, geo_type='region')
  //   trend         → completePriceMonths last 13 (market_stats_cache)
  //   byTown        → citySnapshots (market_pulse_live city rows)
  //   countyMedian  → regionPulse.medianListPrice (same region row)
  //   yearSeries    → buildYearSeries(completePriceMonths, 5)
  // -------------------------------------------------------------------------
  const monthLabel = (iso?: string) =>
    iso
      ? new Date(iso).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
      : ''

  const marketData: KbMarketData = {
    active: regionPulse?.activeCount ?? null,
    closed30: regionPulse?.closedLast30Days ?? null,
    new30: null,
    medianList: regionPulse?.medianListPrice ?? null,
    saleToList: null,
    daysToPending: regionPulse?.medianDaysToPending ?? null,
    monthsSupply: regionPulse?.monthsOfSupply ?? null,
    trend: completePriceMonths
      .slice(-13)
      .filter((p) => p.medianSalePrice != null)
      .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
    byTown: citySnapshots
      .filter((s) => s.median_list_price != null)
      .map((s) => ({ name: s.geo_label, median: s.median_list_price as number })),
    countyMedian: regionPulse?.medianListPrice ?? null,
    yearSeries: buildYearSeries(completePriceMonths, 5),
  }

  // -------------------------------------------------------------------------
  // KbHero lede — data-driven from the region pulse.
  // -------------------------------------------------------------------------
  const ledeParts: string[] = []
  if (regionPulse && regionPulse.activeCount > 0) {
    ledeParts.push(
      `${regionPulse.activeCount.toLocaleString()} active single-family homes across Central Oregon.`,
    )
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
  const lede =
    ledeParts.join(' ') ||
    'Single-family market data across Central Oregon, updated every 15 minutes from Oregon Data Share.'

  // -------------------------------------------------------------------------
  // City tiles — KbExploreTowns from the same citySnapshots (§0).
  // Each slug links to /housing-market/<city-slug> (market report), not /cities.
  // -------------------------------------------------------------------------
  const cityTowns: KbTownItem[] = citySnapshots
    .filter((s) => CITY_SLUG[s.geo_label] !== undefined)
    .map((s) => ({
      name: s.geo_label,
      href: `/housing-market/${CITY_SLUG[s.geo_label] ?? s.geo_slug.replace(/\s+/g, '-')}`,
      activeCount: s.active_count,
      medianPrice: s.median_list_price,
      img: '',
    }))

  // -------------------------------------------------------------------------
  // Blog / guide articles (KbArticles). Falls back to empty (renders null).
  // -------------------------------------------------------------------------
  const articlePosts = blogPosts.map((p) => ({
    title: p.title,
    href: `/blog/${p.slug}`,
    excerpt: p.excerpt,
    imageUrl: p.heroImageUrl,
    dateLabel: p.publishedAt
      ? new Date(p.publishedAt).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : null,
  }))

  // -------------------------------------------------------------------------
  // JSON-LD schemas — BreadcrumbList + WebPage + Dataset.
  // FAQPage is emitted by FAQBlock (includeJsonLd=true) below (G34).
  // §0: dateModified is the real refreshedAt from market_pulse_live, never now().
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

  return (
    <main className="kb-root">
      {/* AI-citability structured data: BreadcrumbList + WebPage + Dataset.
          KbBreadcrumb has no JSON-LD of its own. FAQPage emitted by FAQBlock. */}
      <MetadataBlock schemas={schemas} />

      <KbNav />
      <KbSectionTracker pageType="market-report" />

      {/* BreadcrumbList visual — Home > Housing market > Central Oregon */}
      <KbBreadcrumb
        trail={[
          { label: 'Home', href: '/' },
          { label: 'Housing market', href: '/housing-market' },
          { label: 'Central Oregon' },
        ]}
      />

      <SmoothScrollProvider>
        {/* Hero — region eyebrow + data-driven glance lede */}
        <KbHero
          data={{
            activeCount: regionPulse?.activeCount ?? null,
            medianListPrice: regionPulse?.medianListPrice ?? null,
            medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
          }}
          eyebrow="Central Oregon · Oregon"
          titleTop="Central Oregon"
          titleBottom="market report"
          lead={lede}
        />

        {/* Market HUD — region KbMarketData. §0: all figures from market_pulse_live
            (region row) and market_stats_cache (price history). yearSeries built
            from completePriceMonths via buildYearSeries, same pattern as city page. */}
        <KbMarketHud data={marketData} eyebrow="Central Oregon · The market" />

        {/* City tiles — per-city active counts from ONE getMarketPulseCitySnapshots
            call. §0: every count is the exact active_count from market_pulse_live. */}
        {cityTowns.length > 0 ? (
          <KbExploreTowns
            towns={cityTowns}
            eyebrow="Central Oregon"
            title="Cities and towns"
            sectionId="cities"
            cta={{ href: '/cities', label: 'Every Central Oregon city' }}
          />
        ) : null}

        {/* Guide articles — recent published blog posts, region-aware. */}
        {articlePosts.length > 0 ? (
          <KbArticles
            posts={articlePosts}
            eyebrow="Guides and insights"
            heading="Central Oregon real estate, explained"
            subtitle="Local housing news, neighborhood deep dives, and buyer and seller guides for Central Oregon."
          />
        ) : null}

        {/* FAQ — region Q&A from buildMarketFaq (single source with Dataset vars).
            includeJsonLd=true auto-emits FAQPage JSON-LD (G34). */}
        {faqs.length > 0 ? (
          <section id="faq" aria-label="Central Oregon real estate questions">
            <FAQBlock
              items={faqs}
              eyebrow="Common questions"
              title="Central Oregon real estate questions"
              intro="Direct answers based on live MLS data."
              includeJsonLd={true}
              tone="muted"
            />
          </section>
        ) : null}

        {/* Sell CTA — feeds off region pulse figures */}
        <KbSell
          data={{
            medianListPrice: regionPulse?.medianListPrice ?? null,
            medianDaysToPending: regionPulse?.medianDaysToPending ?? null,
            soldCount30d: regionPulse?.closedLast30Days ?? null,
          }}
          eyebrow="Sell in Central Oregon"
        />

        <KbFooter towns={cityTowns} />
      </SmoothScrollProvider>
    </main>
  )
}
