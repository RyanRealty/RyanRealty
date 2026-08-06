/**
 * Housing market flagship — per-geo market page.
 *
 * Catch-all route serving BOTH:
 *   /housing-market/<city>                — city-level market page (KB design)
 *   /housing-market/<city>/<community>    — subdivision/community market page
 *                                           (legacy wave-2 render, preserved intact)
 *
 * City-level pages now render in the KB (kinetic-brutalist) design, mirroring
 * app/housing-market/central-oregon/page.tsx (the region report template).
 *
 * Subdivision pages retain their prior wave-2 render: no KB pattern for
 * subdivision scope exists yet (no verified KbHero image, no subdivision
 * KbMarketHud pattern, no KB convergence roadmap wave covers this scope).
 * That case is left intact and noted here — do NOT break it.
 *
 * Data ONLY through @/lib/data. No @/app/actions/* imports (G8).
 *
 * KB section order (city scope — Phase 9, docs/KB_CONVERGENCE_ROADMAP.md):
 *   1. MetadataBlock    — BreadcrumbList + WebPage + Dataset JSON-LD (G34)
 *   2. KbNav            — KB chrome
 *   3. KbSectionTracker — page-level analytics (pageType="market-report")
 *   4. KbBreadcrumb     — Home > Housing market > {cityName}
 *   5. SmoothScrollProvider wrapper
 *   6. KbHero           — city eyebrow + data-driven glance lede
 *   7. KbMarketHud      — city KbMarketData (§0-traced + yearSeries, pulse ?? fallback)
 *   8. KbExploreTowns   — sibling cities (same citySnapshots fan-out)
 *   9. KbArticles       — related reports/guides from blog_posts
 *  10. FAQBlock         — city FAQ (includeJsonLd=true → FAQPage JSON-LD)
 *  11. LeadCaptureBlock — broker inquiry (submitMarketPageInquiry → FUB)
 *  12. KbSell           — seller conversion
 *  13. KbFooter         — full sitemap close
 *
 * Legacy section order (subdivision scope — PRESERVED):
 *   1. MetadataBlock — breadcrumb + webPage + Dataset + faqPage JSON-LD (G34)
 *   2. PageBreadcrumb — Home > Housing market > {cityName} > {communityName}
 *   3. HeroBlock — DisplayHeading H1 + data-driven lede + city photo
 *   4. MarketSnapshot — 4 live SFR stat cards (city-scoped)
 *   5. PriceChart — 12-month median sale price trend
 *   6. MarketDetailStats — fuller stats from getCityMarketDetail
 *   7. PriceBandTable — inventory by price tier (stubbed)
 *   8. CityComparisonTable — per-city comparison
 *   9. ContentSection — narrative + methodology trace
 *  10. FAQBlock — market Q&A (auto-emits FAQPage JSON-LD)
 *  11. LeadCaptureBlock — broker inquiry form
 *  12. RelatedAreas — nearby Central Oregon cities
 *  13. CTABar — navy broker contact band
 *
 * Data accuracy (CLAUDE.md §0):
 *   - Every on-screen number traces to getMarketPulse (market_pulse_live)
 *     or getPriceHistory (market_stats_cache).
 *   - Dataset.dateModified = pulse.refreshedAt (real DB timestamp, not now()).
 *   - buildMarketFaq is the single source feeding FAQ, FAQPage JSON-LD,
 *     and Dataset variableMeasured, so the three surfaces can never diverge.
 *   - buildMarketFaq is fed pulse ?? {…} timeout fallback so Dataset/FAQPage
 *     JSON-LD survives a slow or missing market row (G52 page-contract).
 *
 * Parity contract: design_system/ryan-realty/ui_kits/market-report-detail/parity.json
 */

import type { Metadata } from 'next'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { RESORT_SLUG_TO_CITY } from '@/lib/community-slug'
import { notFound } from 'next/navigation'
import {
  getMarketPulse,
  getPriceHistory,
  getMarketPulseCitySnapshots,
  getCityMarketDetailByTimeframe,
  getRecentBlogPosts,
} from '@/lib/data'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildYearSeries } from '@/lib/kb/year-series'
import type { SchemaInput } from '@/lib/site/json-ld'
import type { CityComparisonRow } from '@/components/site/CityComparisonTable'
import type { MarketPulse } from '@/lib/data'
import type { KbMarketData, KbTownItem } from '@/components/site/kb/types'

// KB imports (city scope)
import { SmoothScrollProvider } from '@/components/site/kb/SmoothScrollProvider.client'
import { KbNav } from '@/components/site/kb/KbNav.client'
import { KbBreadcrumb } from '@/components/site/kb/KbBreadcrumb'
import { KbHero } from '@/components/site/kb/KbHero.client'
import { KbMarketHud } from '@/components/site/kb/KbMarketHud.client'
import { KbTimeframeStats } from '@/components/site/kb/KbTimeframeStats.client'
import { KbExploreTowns } from '@/components/site/kb/KbExploreTowns.client'
import { KbArticles } from '@/components/site/kb/KbArticles'
import { KbSell } from '@/components/site/kb/KbSell.client'
import { KbFooter } from '@/components/site/kb/KbFooter.client'
// SiteFooter: legacy 2-seg branch only; root layout no longer ships it globally (G58).
import SiteFooter from '@/components/site/SiteFooter'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import '@/components/site/kb/kb.css'

// Legacy wave-2 imports (subdivision scope — preserved intact)
import { PageBreadcrumb } from '@/components/site/PageBreadcrumb'
import { HeroBlock } from '@/components/site/HeroBlock'
import { cityHero } from '@/lib/geo-images'
import MarketSnapshot from '@/components/site/MarketSnapshot'
import { PriceChart } from '@/components/site/PriceChart'
import { PriceBandTable } from '@/components/site/PriceBandTable'
import { CityComparisonTable } from '@/components/site/CityComparisonTable'
import { ContentSection } from '@/components/site/ContentSection'
import { FAQBlock } from '@/components/site/FAQBlock'
import { LeadCaptureBlock } from '@/components/site/LeadCaptureBlock'
import { RelatedAreas, type RelatedAreaItem } from '@/components/site/RelatedAreas'
import { CTABar } from '@/components/site/CTABar'
import { MetadataBlock } from '@/components/site/MetadataBlock'; import { MarketSources } from '@/components/site/MarketSources'
import { MarketDetailStats } from '@/components/site/MarketDetailStats'
import { DisplayHeading } from '@/components/site/primitives'
import { submitMarketPageInquiry } from '@/app/housing-market/actions'
import { CONTACT } from '@/lib/brand/contact'

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
 * - 1-segment: /housing-market/<city> -> city / bare city slug
 * - 2-segment: /housing-market/<city>/<community>
 *     resort/area community -> neighborhood / bare community slug
 *     other MLS subdivisions -> subdivision / bare community slug
 *
 * Never use "city:community". That shape has zero cache rows (W8.1 soft-404 chip).
 */
function resolveGeo(slug: string[]): {
  geoType: 'city' | 'neighborhood' | 'subdivision'
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
    // Resort/area communities are neighborhood/<bare-slug> in the cache
    // (docs/DATABASE_FOR_AI_AGENTS.md). Other MLS subdivisions use
    // subdivision/<bare-slug>. Never "city:community": that shape has zero rows
    // and soft-404d every 2-segment path (W8.1).
    const isResort = Boolean(RESORT_SLUG_TO_CITY[communitySlug])
    return {
      geoType: isResort ? 'neighborhood' : 'subdivision',
      geoSlug: communitySlug,
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
// (used by the legacy subdivision render only)
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
    // formatMonthsOfSupply keeps the printed digits on the same side of the
    // 4/6 thresholds as the raw value the verdict classified — a naive
    // Math.round(4.04*10)/10 prints "4" beside "a balanced market" and the
    // page contradicts itself (§0 rule 5).
    parts.push(
      `At ${formatMonthsOfSupply(mos)} months of supply, the market sits in ${verdict}. ` +
        `A balanced market runs between 4 and 6 months. ` +
        `Under 4 months favors sellers. Over 6 favors buyers.`,
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
      `Price trend from market_stats_cache monthly aggregates. ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE} ` +
      `Source: Oregon Data Share via Ryan Realty.`
    : ''

  return { what, method }
}

// ---------------------------------------------------------------------------
// Central Oregon cities for sibling tiles (KB city render) and comparison
// table + related areas (legacy subdivision render).
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
  //   pulse        — market_pulse_live, geo_type={geoType}, geo_slug={geoSlug},
  //                  property_type='A'. Freshness 10-15 min. Source: getMarketPulse.
  //   priceHistory — market_stats_cache, geo_type={geoType}, geo_slug={geoSlug},
  //                  period_type='monthly'. Source: getPriceHistory.
  //   citySnapshots — market_pulse_live, geo_type='city', geo_slug IN
  //                   COMPARISON_CITY_LABELS. Source: getMarketPulseCitySnapshots.
  //   detail       — market_stats_cache, full projection, most recent monthly row.
  //                  Source: getCityMarketDetail. City-level only. Feeds the
  //                  KbMarketHud sale-to-list KPI (city scope) and the legacy
  //                  MarketDetailStats section (subdivision scope).
  //   blogPosts    — blog_posts, published, newest first. Source: getRecentBlogPosts.
  //                  City scope only (not fetched for subdivisions).
  // -------------------------------------------------------------------------
  const isCity = geoType === 'city'
  const priceHistoryLimit = isCity ? 60 : 24

  // W8.4 timeframe selector — YTD default + trailing month + rolling 12mo; one
  // DAL helper fans out to the cached getCityMarketDetail per period (city only,
  // never rejects — each period self-catches to null).
  const [pulse, priceHistory, citySnapshots, timeframes, blogPosts] = await Promise.all([
    getMarketPulse({ geoType, geoSlug }).catch(() => null),
    getPriceHistory(geoType, geoSlug, 'monthly', priceHistoryLimit).catch(() => []),
    getMarketPulseCitySnapshots(COMPARISON_CITY_LABELS).catch(() => []),
    getCityMarketDetailByTimeframe(geoType, geoSlug),
    isCity
      ? getRecentBlogPosts({ limit: 3 }).catch(() => [])
      : Promise.resolve([] as Awaited<ReturnType<typeof getRecentBlogPosts>>),
  ])
  const detailYtd = timeframes?.ytd ?? null
  const detail = timeframes?.monthly ?? null
  const detailRolling = timeframes?.rolling_365d ?? null

  // Unknown-geo guard: a URL with NO pulse row and NO price history is not a
  // place we cover — 404 instead of rendering confident fallback copy
  // ("Single-family market data for Anything At All, Oregon…") for a made-up
  // slug. dynamicParams is true, so without this the route is an infinite
  // thin-page space. A transient double-failure can 404 one ISR window (300s);
  // that beats publishing §0-violating copy about a place with no data.
  if (!pulse && priceHistory.length === 0) notFound()

  // Drop in-progress current month from price series to avoid a misleading
  // partial-month spike at the chart edge.
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
  // Pulse-timeout fallback (G52 page-contract): feed pulse ?? snapshot so the
  // structured data survives a slow or missing market row (§0 compliant).
  // -------------------------------------------------------------------------
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(
    geoName,
    pulse ?? { activeCount: null, medianListPrice: null, refreshedAt: null },
  )

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

  // ===========================================================================
  // CITY SCOPE — KB (kinetic-brutalist) render, mirroring the region report.
  // ===========================================================================

  if (geoType === 'city') {
    // -------------------------------------------------------------------------
    // KbMarketData — §0 traced. Every field maps to a single DAL source.
    //   active / closed30 / medianList / daysToPending / monthsSupply
    //     → pulse (market_pulse_live, geo_type='city')
    //   trend        → completePriceMonths last 13 (market_stats_cache)
    //   byTown       → citySnapshots (market_pulse_live city rows) — sibling medians
    //   countyMedian → region median: use citySnapshots across all siblings, or null
    //   yearSeries   → buildYearSeries(completePriceMonths, 5)
    // -------------------------------------------------------------------------
    const monthLabel = (iso?: string) =>
      iso
        ? new Date(iso).toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })
        : ''

    // Sale-to-list ratio from getCityMarketDetail (market_stats_cache,
    // avg_sale_to_list_ratio — a decimal fraction, e.g. 0.9736). KbMarketHud's
    // "Sale to list" KPI renders `${val.toFixed(1)}%`, so scale ×100. This
    // surfaces the closed-sales detail the legacy MarketDetailStats section
    // showed (and that the city KB render had been dropping while still paying
    // for the getCityMarketDetail fetch). §0: the exact cached value, ×100 for
    // the percent display — no rounding that changes the figure.
    const saleToListPct =
      detail?.avgSaleToListRatio != null && Number.isFinite(detail.avgSaleToListRatio)
        ? detail.avgSaleToListRatio * 100
        : null

    const marketData: KbMarketData = {
      active: pulse?.activeCount ?? null,
      closed30: pulse?.closedLast30Days ?? null,
      new30: null,
      medianList: pulse?.medianListPrice ?? null,
      saleToList: saleToListPct,
      daysToPending: pulse?.medianDaysToPending ?? null,
      monthsSupply: pulse?.monthsOfSupply ?? null,
      trend: completePriceMonths
        .slice(-13)
        .filter((p) => p.medianSalePrice != null)
        .map((p) => ({ label: monthLabel(p.periodStart), value: p.medianSalePrice as number })),
      byTown: citySnapshots
        .filter((s) => s.median_list_price != null)
        .map((s) => ({ name: s.geo_label, median: s.median_list_price as number })),
      countyMedian: null,
      yearSeries: buildYearSeries(completePriceMonths, 5),
    }

    // -------------------------------------------------------------------------
    // KbHero lede — data-driven from the city pulse (§0). Same pattern as region.
    // -------------------------------------------------------------------------
    const ledeParts: string[] = []
    if (pulse && pulse.activeCount > 0) {
      ledeParts.push(
        `${pulse.activeCount.toLocaleString()} active single-family homes in ${cityName}.`,
      )
    }
    if (pulse?.medianListPrice != null) {
      const r = Math.round(pulse.medianListPrice / 1000) * 1000
      ledeParts.push(`Median list price $${r.toLocaleString()}.`)
    }
    if (pulse?.monthsOfSupply != null) {
      // Classify the RAW value, not the rounded display value (design-audit
      // P2, CLAUDE.md §0 — see app/housing-market/page.tsx for the same fix).
      const raw = pulse.monthsOfSupply
      let verdict = 'balanced market'
      if (raw <= 4) verdict = "seller's market"
      else if (raw >= 6) verdict = "buyer's market"
      ledeParts.push(`${formatMonthsOfSupply(raw)} months of supply: ${verdict}.`)
    }
    const lede =
      ledeParts.join(' ') ||
      `Single-family market data for ${cityName}, Oregon, updated every 15 minutes from Oregon Data Share.`

    // -------------------------------------------------------------------------
    // Sibling city tiles — KbExploreTowns (other Central Oregon cities).
    // Each slug links to /housing-market/<city-slug>. Excludes current city.
    // -------------------------------------------------------------------------
    const siblingCities: KbTownItem[] = citySnapshots
      .filter(
        (s) =>
          COMPARISON_CITY_SLUGS[s.geo_label] !== undefined &&
          COMPARISON_CITY_SLUGS[s.geo_label] !== citySlug,
      )
      .map((s) => ({
        name: s.geo_label,
        href: `/housing-market/${COMPARISON_CITY_SLUGS[s.geo_label] ?? s.geo_slug.replace(/\s+/g, '-')}`,
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

    return (
      <main className="kb-root">
        {/* AI-citability structured data: BreadcrumbList + WebPage + Dataset.
            KbBreadcrumb has no JSON-LD of its own. FAQPage emitted by FAQBlock. */}
        <MetadataBlock schemas={schemas} />

        <KbNav />
        <KbSectionTracker pageType="market-report" />

        {/* BreadcrumbList visual — Home > Housing market > {cityName} */}
        <KbBreadcrumb overlay
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Housing market', href: '/housing-market' },
            { label: cityName },
          ]}
        />

        <SmoothScrollProvider>
          {/* Hero — city eyebrow + data-driven glance lede */}
          <KbHero
            data={{
              activeCount: pulse?.activeCount ?? null,
              medianListPrice: pulse?.medianListPrice ?? null,
              medianDaysToPending: pulse?.medianDaysToPending ?? null,
            }}
            eyebrow={`${cityName} · Oregon`}
            titleTop={cityName}
            titleBottom="market report"
            lead={lede}
          />

          {/* Market HUD — city KbMarketData. §0: all figures from market_pulse_live
              (city row) and market_stats_cache (price history). yearSeries built
              from completePriceMonths via buildYearSeries, same pattern as the
              region and city pages. */}
          <KbMarketHud data={marketData} eyebrow={`${cityName} · The market`} geoName={cityName} asOf={pulse?.refreshedAt ?? null} />

          {/* W8.4 timeframe selector — YTD default; each period is a pre-fetched
              market_stats_cache row (§0-traced, formats only). */}
          {(detailYtd || detail || detailRolling) ? (
            <KbTimeframeStats
              cityName={cityName}
              periods={{ ytd: detailYtd, monthly: detail, rolling_365d: detailRolling }}
              initial={detailYtd ? 'ytd' : detail ? 'monthly' : 'rolling_365d'}
            />
          ) : null}

          {/* Sibling city tiles — other Central Oregon cities for cross-navigation.
              §0: every count is the exact active_count from market_pulse_live. */}
          {siblingCities.length > 0 ? (
            <KbExploreTowns
              towns={siblingCities}
              eyebrow="Central Oregon"
              title="Other Central Oregon cities"
              sectionId="cities"
              cta={{ href: '/cities', label: 'Every Central Oregon city' }}
            />
          ) : null}

          {/* Guide articles — recent published blog posts. */}
          {articlePosts.length > 0 ? (
            <KbArticles
              posts={articlePosts}
              eyebrow="Guides and insights"
              heading={`${cityName} real estate, explained`}
              subtitle={`Local housing news, neighborhood deep dives, and buyer and seller guides for ${cityName} and Central Oregon.`}
            />
          ) : null}

          {/* FAQ — city Q&A from buildMarketFaq (single source with Dataset vars).
              includeJsonLd=true auto-emits FAQPage JSON-LD (G34). */}
          {faqs.length > 0 ? (
            <section id="faq" aria-label={`${cityName} real estate questions`}>
              <FAQBlock
                items={faqs}
                eyebrow="Common questions"
                title={`${cityName} real estate questions`}
                intro="Direct answers based on live MLS data."
                includeJsonLd={true}
                tone="muted"
              />
            </section>
          ) : null}

          {/* Broker inquiry — general market-question lead capture (buyer OR
              seller), submitted through submitMarketPageInquiry -> FUB person +
              event + Meta CAPI. The legacy wave-2 city render carried this form;
              the city KB render had replaced it with KbSell alone, which is a
              seller-only address handoff that navigates to /sell/valuation and
              never writes a FUB lead from this page. Restored so a buyer or a
              "just have a question" visitor still has an on-page capture path.
              LeadCaptureBlock is design-system styled (tone='muted') and is the
              same component + server action the subdivision render uses. */}
          <section id="ask-a-broker" aria-label={`Questions about the ${cityName} market`}>
            <LeadCaptureBlock
              variant="inquiry"
              onSubmit={submitMarketPageInquiry}
              eyebrow="Talk to a broker"
              title={`Questions about the ${cityName} market?`}
              intro="Tell us what you are weighing. A local broker will follow up with specifics for your situation."
              submitLabel="Ask a broker"
              tone="muted"
            />
          </section>

          {/* Sell CTA — feeds off city pulse figures */}
          <KbSell
            data={{
              medianListPrice: pulse?.medianListPrice ?? null,
              medianDaysToPending: pulse?.medianDaysToPending ?? null,
              soldCount30d: pulse?.closedLast30Days ?? null,
            }}
            eyebrow={`Sell in ${cityName}`}
          />

          <MarketSources sources={['ods']} /><KbFooter towns={siblingCities} />
        </SmoothScrollProvider>
      </main>
    )
  }

  // ===========================================================================
  // SUBDIVISION SCOPE — legacy wave-2 render, preserved intact.
  //
  // No KB pattern exists for subdivision market reports (no verified KbHero
  // image, no subdivision KbMarketHud pattern, no KB convergence roadmap wave
  // covers this scope as of Phase 9). This case is left untouched to avoid
  // breaking working subdivision market pages.
  // ===========================================================================

  // -------------------------------------------------------------------------
  // Hero lede — data-driven for the legacy render (subdivision scope).
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
  const subdivisionLede = ledeParts.join(' ')

  // -------------------------------------------------------------------------
  // City comparison table data — from getMarketPulseCitySnapshots fan-out.
  // -------------------------------------------------------------------------
  const comparisonCities: CityComparisonRow[] = citySnapshots
    .filter((s) => COMPARISON_CITY_SLUGS[s.geo_label] !== undefined)
    .map((s) => ({
      slug: COMPARISON_CITY_SLUGS[s.geo_label] ?? s.geo_slug,
      label: s.geo_label,
      activeCount: s.active_count,
      medianListPrice: s.median_list_price,
      monthsOfSupply: s.months_of_supply,
      // §0 the column header reads "Days to pending", so it gets the real
      // to-pending median. It used to get median_active_dom — the age of UNSOLD
      // inventory — which overstated market speed 3-5x (Sisters 85 vs 16 real,
      // Bend 57 vs 15, live 2026-07-24). Different populations entirely.
      medianDaysToPending: s.median_days_to_pending,
    }))

  // -------------------------------------------------------------------------
  // Related areas — other Central Oregon cities (excluding the current city).
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
    <>
    <main className="min-h-screen bg-background">

      {/* AI-citability structured data: breadcrumb + webPage + Dataset.
          BreadcrumbNav below has includeJsonLd=false to avoid a duplicate
          BreadcrumbList. FAQPage is emitted by FAQBlock further down. */}
      <MetadataBlock schemas={schemas} />

      {/* Breadcrumb */}
      <PageBreadcrumb trail={[{ label: 'Housing market', href: '/housing-market' },
            ...(communityName
              ? [
                  { label: cityName, href: `/housing-market/${citySlug}` },
                  { label: communityName },
                ]
              : [{ label: geoName }])]} includeJsonLd={false} />

      {/* Hero — DisplayHeading H1 in Amboqia via HeroBlock.
          lede is data-driven from pulse (market_pulse_live). */}
      <HeroBlock
        headline={`${geoName} housing market`}
        lede={subdivisionLede || `Single-family market data for ${geoName}, Oregon.`}
        photo={{ src: cityHero(citySlug).src, alt: cityHero(citySlug).alt }}
        minHeight={480}
      />

      {/* Market snapshot — city-scoped 4-stat cards from market_pulse_live.
          Note: subdivision scope shows parent-city stats for context (market_pulse_live
          has no subdivision rows, so city-parent data is the closest verified figure). */}
      <MarketSnapshot citySlug={citySlug} cityName={cityName} />

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
          City-level only; subdivision detail deferred until market_stats_cache
          subdivision rows are verified. */}
      <MarketDetailStats detail={detail} geoName={geoName} />

      {/* Price-band breakdown — stubbed until DAL price-band aggregation exists. */}
      <PriceBandTable
        items={[]}
        geoName={geoName}
        eyebrow="Price bands"
        title={`Where ${geoName} activity is`}
        tone="default"
      />

      {/* City comparison — per-city pulse data. */}
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
        eyebrow="Market data"
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

      {/* Lead capture — broker inquiry (captured via submitPageCTA -> FUB). */}
      <LeadCaptureBlock
        variant="inquiry"
        onSubmit={submitMarketPageInquiry}
        eyebrow="Talk to a broker"
        title={`Questions about the ${geoName} market?`}
        intro="Tell us what you are weighing. A local broker will follow up with specifics for your situation."
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
        title="Schedule a call with a Ryan Realty broker."
        body={`We close deals in ${geoName} and across Central Oregon.`}
        primary={{ href: '/contact', label: 'Schedule a call' }}
        secondary={{ href: `tel:${CONTACT.phoneDirectTel}`, label: CONTACT.phoneDirect }}
        tone="navy"
      />
      <MarketSources sources={['ods']} />
    </main>
    <SiteFooter />
    </>
  )
}
