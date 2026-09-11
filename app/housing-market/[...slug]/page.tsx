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

import { cache } from 'react'
import type { Metadata } from 'next'
import { getFinancingMix } from '@/lib/data/analytics/getFinancingMix'
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
import { latestSaleMedian } from '@/lib/market/latest-sale-median'
import { pageMetadata } from '@/lib/site/page-metadata'
import { buildYearSeries } from '@/lib/kb/year-series'
import type { SchemaInput } from '@/lib/site/json-ld'
import { marketVerdict } from '@/lib/market/classify'
import { leftoverHudKpis, leftoverHudPublishes } from '@/lib/market/publish-leftover-hud'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatPriceExact } from '@/lib/format/money'
import { zonedDateKey } from '@/lib/format/date'
import { valuationHref } from '@/lib/site/valuation-href'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  V3_ROOT_CLASS,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3SectionTracker,
  V3Instrument,
  v3Text,
  type V3InstrumentFigure,
} from '@/components/site/v3'
import { COMPARISON_CITY_LABELS, CORE_CITY_SLUGS, resolveGeo } from './_v3/geo-constants'
import {
  buildCityMedianChart,
  buildCityPeriodFigures,
  buildMonthlyMedianChart,
  financingSentence,
} from './_v3/geo-figures'
import { buildAmenityShareChart } from '../_v3/market-charts'
import { CityMarketView } from './_v3/city-view'
import { CommunityMarketView } from './_v3/community-view'
import { GeoInquirySheet } from './_v3/GeoInquirySheet.client'

export async function generateStaticParams(): Promise<Array<{ slug: string[] }>> {
  return CORE_CITY_SLUGS.map((s) => ({ slug: [s] }))
}

export const dynamicParams = true
export const revalidate = 300

type Props = { params: Promise<{ slug: string[] }> }

/**
 * ONE read for the metadata and the body (SITE-26).
 *
 * generateMetadata used to validate nothing: resolveGeo only title-cases the URL
 * segment, so /housing-market/grants-pass produced a confident "Grants Pass
 * housing market" head with index,follow, and the real guard below threw
 * notFound() only AFTER the head had flushed. Twenty-four real out-of-market
 * Oregon town slugs (grants-pass, medford, salem, ashland, mcminnville,
 * brookings and 18 more; 203 impressions, 0 clicks) were indexed as hollow 200s
 * that way. The guard now runs where the head is written, against the SAME
 * cached read the body renders, so those slugs serve the not-found shell with
 * robots noindex instead of an indexable market page.
 *
 * STILL A 200, NOT A 404, and that is a property of this route tree rather than
 * of this guard: app/loading.tsx and app/housing-market/loading.tsx make Next
 * stream the shell, so a notFound() thrown anywhere in the render — head
 * included — cannot set the status. middleware.ts already carries the repo's
 * answer for /cities and /communities (validate the slug at the edge against a
 * STATIC set and emit a real 404) and is the place to add these; it is owned by
 * another node this round. noindex is what this route can do on its own, and it
 * is what takes the pages out of the index.
 *
 * React cache() memoizes per request across generateMetadata and the render, so
 * this adds no round trip: the description's figures are the identical values
 * the Instrument and the Dataset JSON-LD are built from. dynamicParams stays
 * true — CORE_CITY_SLUGS is a presentation list, not a registry, and madras,
 * culver, powell-butte, camp-sherman and every two-segment community URL render
 * legitimately outside it.
 */
const loadGeoMarket = cache(async (slugKey: string) => {
  const slug = slugKey.split('/')
  const geo = resolveGeo(slug)
  const { geoType, geoSlug, geoName, cityName } = geo
  const canonicalPath = `/housing-market/${slug.map(encodeURIComponent).join('/')}`
  const isCity = geoType === 'city'
  const priceHistoryLimit = isCity ? 60 : 24

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
  const publishes = leftoverHudPublishes(hud) || chartMonths.months.length > 0

  const mosRaw = hud.monthsSupply
  const mosText = mosRaw != null ? formatMonthsOfSupply(mosRaw) : null
  const verdict = marketVerdict(mosRaw)

  const refreshedAt = mt?.headlines?.computedAt ?? mt?.inventory?.computedAt ?? null
  // The FAQ's sale price is the chart's latest complete month, so the two
  // cannot disagree on the same page.
  const saleMedian = latestSaleMedian(chartMonths.months, currentMonthKey)
  const faq = buildMarketFaq(
    geoName,
    {
      grain: geoType,
      source: 'market-truth',
      monthsOfSupply: mosRaw,
      soldCount12mo: publicPace.closedCount ?? null,
      activeCount: hud.active,
      pulseActiveCount: hud.active,
      medianListPrice: hud.medianList,
      medianSalePrice: saleMedian?.value ?? null,
      medianSaleMonthLabel: saleMedian?.monthLabel ?? null,
      medianDaysToPending: hud.daysToPending,
      refreshedAt,
    },
  )

  // HOW HOMES HERE GET BOUGHT (2026-08-27). The full report is the ONE surface
  // for the all-property-types financing mix: the six-brokerage sweep found no
  // local competitor publishes it as data, and the place pages must not carry
  // it beside the detached finance cells (two cash shares under near-identical
  // labels was the defect that pulled it off /cities/bend the day it shipped).
  // Here it gets its own section with the population NAMED in the heading.
  const financingMix = publishes && isCity ? await getFinancingMix({ city: cityName, days: 365 }) : null

  return {
    geo,
    canonicalPath,
    isCity,
    publishes,
    currentMonthKey,
    citySnapshots,
    timeframes,
    lastCompleteMonthly,
    blogPosts,
    publicSegments,
    publicPace,
    publicMix,
    chartMonths,
    hud,
    mosText,
    verdict,
    refreshedAt,
    faqs: faq.faqs,
    datasetVariables: faq.datasetVariables,
    asOfIso: faq.asOfIso,
    asOfLabel: faq.asOfLabel,
    financingMix,
  }
})

/**
 * The snippet's figures ARE the Dataset JSON-LD's figures — same values, same
 * request. The old description was a constant that overflowed MAX_DESC (155)
 * for every geo name on the route (Bend 157, Redmond 160, Caldera Springs 168)
 * and truncated to "…from Oregon Data…", so the one thing every search result
 * showed was a cut-off sentence with no number in it.
 *
 * Reading `datasetVariables` rather than the HUD is deliberate: buildMarketFaq
 * applies publishMonthsOfSupply's withholding rules, so a figure it declined to
 * publish cannot reappear in the snippet, and the months-of-supply value here
 * is the same one the Dataset variable carries, formatted once by
 * formatMonthsOfSupply. The verdict word comes from marketVerdict() on the raw
 * value — the canonical thresholds in lib/market/classify.ts (ci:market-formula).
 */
function geoTitle(input: {
  geoName: string
  datasetVariables: ReadonlyArray<{ name: string; value: string | number }>
}): string {
  const active = input.datasetVariables.find((v) => v.name === 'Active Listings')?.value ?? null
  if (active == null) return `${input.geoName} housing market`
  return `${input.geoName} housing market: ${Number(active).toLocaleString('en-US')} homes for sale`
}

function geoDescription(input: {
  geoName: string
  datasetVariables: ReadonlyArray<{ name: string; value: string | number; unitText?: string }>
  verdictLabel: string
}): string {
  const read = (name: string) => input.datasetVariables.find((v) => v.name === name)?.value ?? null
  const active = read('Active Listings')
  const medianList = read('Median List Price')
  const supply = read('Months of Supply')

  const clauses: string[] = []
  if (active != null) clauses.push(`${Number(active).toLocaleString('en-US')} homes for sale`)
  if (medianList != null) clauses.push(`${formatPriceExact(Number(medianList))} median list price`)
  // Plain language in the snippet (SITE-81): "homes for sale vs a month of sales"
  // matches the on-page MOS bars, not the internal MOS acronym alone.
  if (supply != null) {
    clauses.push(`${supply} months of homes for sale vs a month of sales`)
  }

  if (clauses.length === 0) {
    return `Single-family market data for ${input.geoName}, Oregon: inventory, list prices, and how fast homes go under contract.`
  }
  const verdictClause = supply != null ? ` A ${input.verdictLabel}.` : ''
  const head = `${input.geoName} single-family homes: ${clauses.join(', ')}.${verdictClause}`
  const tail = ' Live from Oregon Data Share MLS.'
  return head.length + tail.length <= 155 ? head + tail : head
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  if (!slug || slug.length === 0) notFound()

  const data = await loadGeoMarket(slug.join('/'))
  // The head is where the guard belongs: a geo we do not cover never gets an
  // indexable <head>. The body keeps the same check as a second line.
  if (!data.publishes) notFound()

  const { geoName, citySlug } = data.geo
  return pageMetadata({
    title: geoTitle({ geoName, datasetVariables: data.datasetVariables }),
    description: geoDescription({
      geoName,
      datasetVariables: data.datasetVariables,
      verdictLabel: data.verdict.label,
    }),
    path: data.canonicalPath,
    keywords: [
      `${geoName} housing market`,
      `${geoName} real estate`,
      `${citySlug} market stats`,
      'Central Oregon',
      'Ryan Realty',
    ],
  })
}

export default async function HousingMarketGeoPage({ params }: Props) {
  const { slug } = await params
  if (!slug || slug.length === 0) notFound()

  const data = await loadGeoMarket(slug.join('/'))
  if (!data.publishes) notFound()

  const {
    canonicalPath,
    isCity,
    currentMonthKey,
    citySnapshots,
    timeframes,
    lastCompleteMonthly,
    blogPosts,
    publicSegments,
    publicPace,
    publicMix,
    chartMonths,
    hud,
    mosText,
    verdict,
    refreshedAt,
    faqs,
    datasetVariables,
    asOfIso,
    asOfLabel,
    financingMix,
  } = data
  const { geoType, citySlug, geoName, cityName, communityName } = data.geo
  const valuationHrefValue = valuationHref(canonicalPath)
  const detailYtd = timeframes?.ytd ?? null
  const detail = timeframes?.monthly ?? null


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
        {financingMix && financingMix.source === 'rpc' && financingMix.totalSales >= 50 ? (
          <V3Instrument
            id="financing"
            level={2}
            eyebrow={v3Text(`${cityName} · Every property type`)}
            headline={v3Text(`How ${cityName} homes get bought`)}
            note={v3Text(
              `Across every property type the MLS closed here: houses, condos, land, commercial. The figures above cover detached homes only.`,
            )}
            /* THE SHARE IS A LENGTH, NOT A TILE (SITE-41). The 2026-09-09 evaluator
               called this the dullest section on the page: four percentages with no
               bar, no hover, and no sentence, closing the page on its most
               template-shaped display. The drawing leads, the four figures keep their
               digits, and each one says in plain words what that way of paying IS —
               which is the thing a buyer reading this page does not already know.
               The label's old "· 21 days to pending · 12 months" was the raw
               methodology jargon TASTE.md names; same fact, said. */
            chartFirst
            chart={buildAmenityShareChart(
              financingMix.rows
                .filter((r) => r.financing !== 'Other')
                .map((r) => ({ name: r.financing, sharePct: r.pctOfSales })),
              `How buyers paid for ${cityName} homes, last 12 months`,
            )}
            figures={
              financingMix.rows
                .filter((r) => r.financing !== 'Other')
                .map((r) => ({
                  value: v3Text(`${r.pctOfSales.toFixed(1)}%`),
                  label: v3Text(
                    r.medianDaysToPending != null
                      ? `${r.financing.toLowerCase()} · typically under contract in ${r.medianDaysToPending} days`
                      : `${r.financing.toLowerCase()} · last 12 months`,
                  ),
                  sentence: v3Text(financingSentence(r.financing)),
                })) as unknown as readonly [V3InstrumentFigure, ...V3InstrumentFigure[]]
            }
            source={v3Text(
              `closed MLS sales through Oregon Data Share, every property type, ${cityName}, rolling 365 days, ${financingMix.totalSales.toLocaleString('en-US')} sales with a recorded financing method, normalised (a dual-format feed field; VA is word-boundary matched)`,
            )}
          />
        ) : null}

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
