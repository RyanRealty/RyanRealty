/**
 * Housing market catch-all, on the components/site/v3 barrel.
 *
 * Serves BOTH:
 *   /housing-market/<city>             city-level market page
 *   /housing-market/<city>/<community> subdivision / resort community page
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11.
 * Both branches open on Instrument. Four of the six patterns, no two adjacent
 * alike. The section order, the sections this migration DELETED, and the
 * per-section reasoning are the parity contract:
 * design_system/ryan-realty/ui_kits/market-report-detail/parity.json.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata, MetadataBlock JSON-LD (BreadcrumbList, WebPage, Dataset,
 * FAQPage), a rendered V3SectionTracker with pageType="market-report",
 * generateStaticParams over the 11 core slugs, dynamicParams true,
 * revalidate 300, and the route. MetadataBlock stays on the legacy register
 * (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * D9: city year overlay and community 12-month median sale pass `chart` on
 * Instrument (E-CHART atom). Do not flatten a series to a figure. Do not add
 * a seventh pattern.
 *
 * DROPPED, city: KbHero, KbExploreTowns, KbArticles, FAQBlock, LeadCaptureBlock,
 * KbSell, KbFooter, SmoothScrollProvider, MarketSources, KbMarketHud, KbMarketChart,
 * KbTimeframeStats. DROPPED, community: PageBreadcrumb, HeroBlock,
 * MarketSnapshot, MarketDetailStats, PriceBandTable, CityComparisonTable,
 * ContentSection, FAQBlock, LeadCaptureBlock, RelatedAreas, CTABar, SiteFooter,
 * DisplayHeading, buildNarrative, PriceChart.
 *
 * DATES RENDER IN PACIFIC. The KB city render formatted blog dates with
 * timeZone UTC and the current-month drop with en-CA Pacific. formatDate and
 * zonedDateKey are both Pacific, so the in-progress month drop is unchanged
 * and any leftover date label now matches the market this page covers.
 * ci:date-format requires the canonical formatter.
 */

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import {
  getPriceHistory,
  getMarketPulseCitySnapshots,
  getCityMarketDetailByTimeframe,
  getCompleteMonthlyMarketDetail,
  getRecentBlogPosts,
  getDetachedOverlays,
} from '@/lib/data'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import { EMPTY_PUBLIC_MIX, getPublicDetachedMix } from '@/lib/data/market-truth/public-mix'
import { getPublicDetachedMonthly, leftoverOrCacheMonthly } from '@/lib/data/market-truth/public-monthly'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildYearSeries } from '@/lib/kb/year-series'
import type { SchemaInput } from '@/lib/site/json-ld'
import { marketVerdict } from '@/lib/market/classify'
import { leftoverHudKpis, leftoverHudPublishes } from '@/lib/market/publish-leftover-hud'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { zonedDateKey } from '@/lib/format/date'
import { valuationHref } from '@/lib/site/valuation-href'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
} from '@/components/site/v3'
import { COMPARISON_CITY_LABELS, CORE_CITY_SLUGS, resolveGeo } from './_v3/geo-constants'
import {
  buildCityMedianChart,
  buildCityPeriodFigures,
  buildMonthlyMedianChart,
} from './_v3/geo-figures'
import { CityMarketView } from './_v3/city-view'
import { CommunityMarketView } from './_v3/community-view'
import { GeoInquirySheet } from './_v3/GeoInquirySheet.client'

export async function generateStaticParams(): Promise<Array<{ slug: string[] }>> {
  return CORE_CITY_SLUGS.map((s) => ({ slug: [s] }))
}

export const dynamicParams = true
export const revalidate = 300

type Props = { params: Promise<{ slug: string[] }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!slug || slug.length === 0) return {}

  const { geoName, citySlug } = resolveGeo(slug)
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

export default async function HousingMarketGeoPage({ params }: Props) {
  const { slug } = await params
  if (!slug || slug.length === 0) notFound()

  const geo = resolveGeo(slug)
  const { geoType, geoSlug, citySlug, geoName, cityName, communityName } = geo
  const canonicalPath = `/housing-market/${slug.map(encodeURIComponent).join('/')}`
  const isCity = geoType === 'city'
  const priceHistoryLimit = isCity ? 60 : 24
  const valuationHrefValue = valuationHref(canonicalPath)

  // Data, all through the DAL (G8). No catch-and-swallow: every function below
  // is resilient-cached and answers a transient failure with its own documented
  // fallback, so a `.catch(() => null)` here would only hide a real outage
  // behind a confident empty page.
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const leftoverGeo = geoType === 'neighborhood' || geoType === 'city' ? geoType : null
  const [priceHistory, citySnapshots, timeframes, lastCompleteMonthly, blogPosts, publicSegments, publicPace, publicMix, leftoverMonthly, mtOverlays] =
    await Promise.all([
    getPriceHistory(geoType, geoSlug, 'monthly', priceHistoryLimit),
    getMarketPulseCitySnapshots([...COMPARISON_CITY_LABELS]),
    getCityMarketDetailByTimeframe(geoType, geoSlug),
    getCompleteMonthlyMarketDetail({ geoType, geoSlug, currentMonthKey }),
    isCity ? getRecentBlogPosts({ limit: 3 }) : Promise.resolve([] as Awaited<ReturnType<typeof getRecentBlogPosts>>),
    leftoverGeo
      ? getPublicPlaceSegments({ geoType: leftoverGeo, geoSlug })
      : Promise.resolve([]),
    leftoverGeo
      ? getPublicDetachedPace({ geoType: leftoverGeo, geoSlug })
      : Promise.resolve(EMPTY_PUBLIC_PACE),
    leftoverGeo
      ? getPublicDetachedMix({ geoType: leftoverGeo, geoSlug })
      : Promise.resolve(EMPTY_PUBLIC_MIX),
    leftoverGeo
      ? getPublicDetachedMonthly({ geoType: leftoverGeo, geoSlug, currentMonthKey })
      : Promise.resolve([]),
    leftoverGeo
      ? getDetachedOverlays([{ geoType: leftoverGeo, geoSlug }])
      : Promise.resolve(new Map()),
  ])
  const detailYtd = timeframes?.ytd ?? null
  const detail = timeframes?.monthly ?? null
  const detailRolling = timeframes?.rolling_365d ?? null

  const completePriceMonths = priceHistory.filter((p) => p.periodStart.slice(0, 7) !== currentMonthKey)
  const chartMonths = leftoverOrCacheMonthly(leftoverMonthly, completePriceMonths)

  const mt = leftoverGeo ? mtOverlays.get(`${leftoverGeo}:${geoSlug}`) : undefined
  const hud = leftoverHudKpis({
    grain: leftoverGeo ?? 'city',
    headlines: mt?.headlines ?? null,
    inventory: mt?.inventory ?? null,
    pace: publicPace,
  })

  // Unknown-geo guard: leftover HUD miss and no leftover/cache monthly series
  // is not a place we cover. dynamicParams is true, so without this the route
  // is an infinite thin-page space.
  if (!leftoverHudPublishes(hud) && chartMonths.months.length === 0) notFound()

  const mosRaw = hud.monthsSupply
  const mosText = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null
  const verdict = marketVerdict(mosRaw)

  const refreshedAt = mt?.headlines?.computedAt ?? mt?.inventory?.computedAt ?? null
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(
    geoName,
    {
      grain: geoType,
      source: 'market-truth',
      monthsOfSupply: mosRaw,
      soldCount12mo: publicPace.closedCount ?? null,
      activeCount: hud.active,
      pulseActiveCount: hud.active,
      medianListPrice: hud.medianList,
      medianDaysToPending: hud.daysToPending,
      refreshedAt,
    },
  )

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

  if (datasetVariables.length > 0 && refreshedAt) {
    const metricNames = datasetVariables.map((variable) => variable.name.toLowerCase())
    const metricList =
      metricNames.length === 1
        ? metricNames[0]
        : `${metricNames.slice(0, -1).join(', ')}, and ${metricNames[metricNames.length - 1]}`
    schemas.push({
      type: 'dataset',
      name: `${geoName}, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description:
        `Live single-family home market data for ${geoName}, Oregon. ` +
        `Includes ${metricList}. ` +
        `Sourced from Oregon Data Share via Ryan Realty.`,
      url: canonicalPath,
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: `${geoName}, OR`,
      variableMeasured: datasetVariables,
    })
  }

  if (faqs.length > 0) {
    schemas.push({ type: 'faqPage', items: faqs })
  }

  const yearSeries = buildYearSeries(chartMonths.months, 5)
  const cityChart = buildCityMedianChart(yearSeries, chartMonths.months, chartMonths.leftoverUsed)
  const communityChart =
    chartMonths.leftoverUsed &&
    chartMonths.months.filter((row) => row.medianSalePrice != null).length >= 6
      ? buildMonthlyMedianChart(
          chartMonths.months,
          `${geoName} median close, leftover completed months`,
        )
      : undefined
  const cityClosed = buildCityPeriodFigures({
    ytd: detailYtd,
    monthly: detail,
    lastComplete: lastCompleteMonthly,
    leftover: publicPace,
    currentMonthKey,
  })
  const sheet = <GeoInquirySheet geoName={geoName} />

  const crumbTrail = [
    { label: 'Home', href: '/' },
    { label: 'Housing market', href: '/housing-market' },
    ...(communityName
      ? [
          { label: cityName, href: `/housing-market/${citySlug}` },
          { label: communityName },
        ]
      : [{ label: cityName }]),
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />
        <V3SectionTracker />
        <V3Breadcrumb trail={crumbTrail} />

        {isCity ? (
          <CityMarketView
            cityName={cityName}
            citySlug={citySlug}
            hud={hud}
            mosText={mosText}
            verdict={verdict}
            refreshedAt={refreshedAt}
            valuationHrefValue={valuationHrefValue}
            snapshots={citySnapshots}
            faqs={faqs}
            posts={blogPosts}
            closedFigures={cityClosed.figures}
            closedTrace={cityClosed.trace}
            chart={cityChart}
            sheet={sheet}
            publicSegments={publicSegments}
            publicPace={publicPace}
            publicMix={publicMix}
          />
        ) : (
          <CommunityMarketView
            geoName={geoName}
            cityName={cityName}
            citySlug={citySlug}
            hud={hud}
            mosText={mosText}
            verdict={verdict}
            refreshedAt={refreshedAt}
            valuationHrefValue={valuationHrefValue}
            detail={detail}
            lastComplete={lastCompleteMonthly}
            currentMonthKey={currentMonthKey}
            snapshots={citySnapshots}
            faqs={faqs}
            chart={communityChart}
            sheet={sheet}
          />
        )}
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. The KB page nested KbFooter the same way, and
          ci:default-chrome-footer counts footers without checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
