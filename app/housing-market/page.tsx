/**
 * /housing-market - the Central Oregon market hub, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. Market
 * destinations open on Instrument. Four of the six patterns, no two adjacent alike.
 * The section order, the sections this migration DELETED from the KB page, and the
 * per-section reasoning are the parity contract, not this comment:
 * design_system/ryan-realty/ui_kits/market-report/parity.json.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through pageMetadata,
 * MetadataBlock JSON-LD (BreadcrumbList, WebPage, Dataset, FAQPage), a rendered
 * V3SectionTracker with pageType="market-report", revalidate 300, and the route.
 * MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * The five invariants this file is written to hold, each enforced at its own site:
 *
 *  1. ONE DERIVATION, IT CLASSIFIES THE RAW VALUE, AND IT PRINTS ON THE SAME SIDE OF
 *     THE THRESHOLD IT CLASSIFIED. marketVerdict reads mosRaw, the screen reads mosRaw
 *     through formatMonthsOfSupply, and buildMarketFaq gets mosRaw and repeats those
 *     two steps in that order. Rounding BEFORE classifying is what the ordering
 *     prevents: 4.02 rounds to 4.0, `4.0 <= 4` prints "a seller's market", and
 *     lib/market/classify.ts calls it balanced. Rounding for DISPLAY reopens the same
 *     contradiction from the other end, which is why lib/format/months-of-supply.ts
 *     exists. Naive rounding prints "4.0" beside a balanced verdict and, one line
 *     below both, MOS_THRESHOLD_CLAUSE reading "4 months of supply or less is a
 *     seller's market". The formatter prints 4.1 for a stored 4.02 and 5.9 for a
 *     stored 5.97, so the digits never cross a boundary the raw value did not.
 *  2. ONE GUARD PER FIGURE, SHARED WITH ITS CONSUMER. mosRaw is null unless the stored
 *     value is above 0, which is buildMarketFaq's own condition, so the H1 cannot
 *     assert a verdict the shared builder declined to answer.
 *  3. ONE TRACE PER QUERY, ONE STAMP PER TRACE. Four population sets sit on this
 *     page (region pulse, city snapshots, closed sales, and the long-view set:
 *     national FRED series + the mart's SFR cube + seller-net quarters) and no
 *     section borrows another's figures or another's clock — each long-view card
 *     carries its own trace inside its Source disclosure.
 *  4. ABSENT IS NOT ZERO (CLAUDE.md section 0). A covered city with no live row is
 *     not printed as "0 active" under a live-MLS source line.
 *  5. ONE ASK ON THE PAGE (2026-08-27 single-ask consolidation, parity.json
 *     market-report openDefects item 3). Neither Instrument carries an action that
 *     solicits contact information: the two figure sections answer the reader's
 *     question, and MarketInquirySheet is the only filled control that asks for one.
 *     The KB-era ghost "Value my home" button on the hero and the "Sell your home"
 *     edge in the closing Quiet were both removed as redundant asks against that
 *     one Sheet. This page previously rendered three (broker form, Value my home,
 *     Sell your home). The sticky public header still carries its own filled
 *     valuation CTA at every scroll position. V3Footer carries no button
 *     (components/site/v3/V3Footer.tsx), unchanged.
 *
 * DATES RENDER IN PACIFIC, a change from the KB page, stated rather than absorbed.
 * The KB guides rail formatted with `timeZone: 'UTC'` and formatDate is pinned to
 * America/Los_Angeles, so a post published between 00:00 and 08:00 UTC now shows the
 * previous calendar day, which is the correct day in the market this page covers.
 * ci:date-format requires the canonical formatter, so the trade is not optional.
 */

import type { Metadata } from 'next'
import {
  getRecentBlogPosts,
  getPriceHistory,
} from '@/lib/data'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import {
  getPublicPlaceSegments,
  publicSegmentBrowseHref,
  publicSegmentDisplayBits,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'
import {
  getPublicDetachedPace,
  publicPaceHasRow,
  publicPaceItems,
} from '@/lib/data/market-truth/public-pace'
import { getPublicDetachedMix, publicMixHasRow, publicMixItems } from '@/lib/data/market-truth/public-mix'
import { getPublicDetachedMonthly, leftoverOrCacheMonthly } from '@/lib/data/market-truth/public-monthly'
import { getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { publishInstrumentStamp } from '@/lib/market/publish-mixed-instrument-stamp'
import {
  getCoMarketAnnual,
  getCoMarketAnnualSeries,
  MART_FLOOR_YEAR,
} from '@/lib/data/analytics/getCoMarketAnnual'
import {
  annualAverages,
  getNationalIndexSeries,
  getRateChartSeries,
} from '@/lib/data/stats/statsChartSeries'
import {
  dropInProgressQuarter,
  getConcessionsQuarterly,
} from '@/lib/data/pricing/getConcessionsQuarterly'
import { labelPropertyType } from '@/lib/data/analytics/property-type-labels'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { formatDate, zonedDateKey } from '@/lib/format/date'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { listingsBrowsePath } from '@/lib/slug'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  V3SectionTracker,
  type V3LedgerPlainRow,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { MarketInquirySheet } from './_v3/MarketInquirySheet.client'
import { CITY_SLUG, CLOSED_SALES_YEAR, HISTORY_PATH } from './_v3/hub-constants'
import { buildCityLedger, buildHubLead, buildSfrFollowFigures } from './_v3/hub-sections'
import { buildRegionMedianChart, dropInProgressMonth } from './_v3/market-charts'
import { buildLongViewSection } from './_v3/region-charts'
import './_v3/tremor-density.css'

export const revalidate = 300

// Metadata - unchanged from the KB page.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Central Oregon Housing Market',
    description:
      'Central Oregon housing market hub. Live single-family market data by city, with the full Central Oregon region report and per-city market pages. ' +
      'Updated every 15 minutes from Oregon Data Share.',
    path: '/housing-market',
    keywords: [
      'Central Oregon housing market',
      'Central Oregon real estate',
      'Bend housing market',
      'Redmond housing market',
      'Central Oregon market by city',
      'Ryan Realty',
    ],
  })
}

export default async function HousingMarketHubPage() {
  // Data, all through the DAL (G8). No catch-and-swallow: every function below is
  // resilient-cached and answers a transient failure with its own documented
  // fallback, so a `.catch(() => null)` here would only hide a real outage behind a
  // confident empty page. Nothing is fetched that this page does not render.
  const todayKey = zonedDateKey(new Date())
  const lastFullYear = Number(todayKey.slice(0, 4)) - 1
  const [
    citySnapshots,
    blogPosts,
    closedYear,
    priceHistory,
    rateSeries,
    nationalSeries,
    coAnnualSfr,
    concessionQuarters,
    publicSegments,
    publicPace,
    publicMix,
    leftoverMonthly,
    regionOverlays,
  ] = await Promise.all([
    getMarketPulseAllCitySnapshots(),
    getRecentBlogPosts({ limit: 3 }),
    getCoMarketAnnual({ year: CLOSED_SALES_YEAR, typeScope: 'all' }),
    getPriceHistory('region', 'central-oregon', 'monthly', 60),
    getRateChartSeries(),
    getNationalIndexSeries(),
    getCoMarketAnnualSeries({ fromYear: MART_FLOOR_YEAR, toYear: lastFullYear, typeScope: 'sfr' }),
    getConcessionsQuarterly(),
    getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }),
    getPublicDetachedPace({ geoType: 'region', geoSlug: 'central-oregon' }),
    getPublicDetachedMix({ geoType: 'region', geoSlug: 'central-oregon' }),
    getPublicDetachedMonthly({
      geoType: 'region',
      geoSlug: 'central-oregon',
      currentMonthKey: todayKey.slice(0, 7),
    }),
    getDetachedOverlays([{ geoType: 'region', geoSlug: 'central-oregon' }]),
  ])
  const regionMt = regionOverlays.get('region:central-oregon')
  const hud = leftoverHudKpis({
    grain: 'region',
    headlines: regionMt?.headlines ?? null,
    inventory: regionMt?.inventory ?? null,
    pace: publicPace,
  })

  // THE ONE DERIVATION (invariants 1 and 2). Classify the raw value, format only to
  // display it, and hand the RAW value to buildMarketFaq so the shared builder
  // repeats the same two steps in the same order.
  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const mosText = mosRaw == null ? null : formatMonthsOfSupply(mosRaw)
  const verdict = marketVerdict(mosRaw)
  const chartMonths = leftoverOrCacheMonthly(
    leftoverMonthly,
    dropInProgressMonth(priceHistory, todayKey.slice(0, 7)),
  )
  const regionChart = buildRegionMedianChart(chartMonths.months, chartMonths.leftoverUsed)

  // The long view: the approved chart-room forms wired live. A fourth
  // population set (national FRED series, the mart's SFR cube, the seller-net
  // quarters) — each card carries its own trace and its own clock inside its
  // Source disclosure, so no section borrows another's stamp (invariant 3).
  const longView = buildLongViewSection({
    m30: rateSeries?.m30 ?? [],
    spread: rateSeries?.spread ?? [],
    norm: rateSeries?.norm ?? null,
    coAnnual: coAnnualSfr,
    csAnnualAvg: nationalSeries ? annualAverages(nationalSeries.caseShiller) : new Map(),
    cpiAnnualAvg: nationalSeries ? annualAverages(nationalSeries.cpi) : new Map(),
    concessionQuarters: dropInProgressQuarter(concessionQuarters, todayKey),
  })
  const [firstLongViewFigure, ...restLongViewFigures] = longView?.figures ?? []

  // buildMarketFaq - the single source for the visible FAQ, the FAQPage JSON-LD, and
  // the Dataset variableMeasured. The pulse-or-fallback input is the timeout fallback
  // the page contract requires (G52): the structured data survives a slow or missing
  // region row instead of vanishing. A null field produces no question and no
  // variable, never a fabricated one.
  // Two market-truth rows feed this section's figures. One stamp only when
  // both rows carry one clock; a mismatch withholds the stamp rather than
  // aging the fresher row (publishInstrumentStamp contract).
  const leftoverStamp = publishInstrumentStamp([
    regionMt?.headlines?.computedAt,
    regionMt?.inventory?.computedAt,
  ])
  const pulse: MarketFaqInput | null = {
    grain: 'region',
    source: 'market-truth',
    activeCount: hud.active,
    medianListPrice: hud.medianList,
    monthsOfSupply: mosRaw,
    medianDaysToPending: hud.daysToPending,
    soldCount12mo: publicPace.closedCount ?? null,
    pulseActiveCount: hud.active,
    refreshedAt: leftoverStamp,
  }
  const marketFaq = buildMarketFaq(
    'Central Oregon',
    pulse ?? { grain: 'region', activeCount: null, medianListPrice: null, refreshedAt: null },
  )
  const { datasetVariables, asOfIso, asOfLabel } = marketFaq
  const refreshedAt = leftoverStamp

  // ALL-TYPE closed year from the mart. source === 'missing' is empty, not a
  // printed zero. 2026-08-27 hero-reorder fix (parity.json market-report
  // openDefects): this is now the LEVEL-2 section, not the hero. It no longer
  // carries months of supply, which is a different clock than closed.computedAt
  // and is why the hero used to print no stamp at all (publishInstrumentStamp
  // only agrees when every clock it is handed is identical).
  const lead = buildHubLead(closedYear)
  const closed = lead.closed
  const historyPath = lead.historyPath
  const [firstLeadFigure, ...restLeadFigures] = lead.figures

  // Live single-family figures for the LEVEL-1 hero (the page's answer): median
  // list price, homes for sale, months of supply, median to pending, then the
  // extra leftover segments/pace/mix figures. One population, one clock
  // (refreshedAt), so this section's stamp is never dropped by a clock mismatch.
  const sfrFollow = buildSfrFollowFigures(hud, mosText)
  for (const row of publicSegments) {
    if (row.activeCount == null || row.activeCount <= 0) continue
    // Mobile audit 2026-08-27 (group-c): the full bit list (up to 9 stats)
    // ran on as one gray run-on paragraph under each tile at 390px — a wall
    // of text with no hierarchy. The first 3 bits are price, months of
    // supply, and the buyer's/seller's verdict — the segment's headline
    // read. The rest (pending, closed, days to contract, sale-to-original,
    // YoY, price-cut share) stay one tap away behind the tile's existing
    // href rather than crammed inline; nothing is removed from the site.
    const bits = publicSegmentDisplayBits(row).slice(0, 3)
    sfrFollow.push({
      value: v3Text(row.activeCount.toLocaleString('en-US')),
      label: v3Text(
        [`${publicSegmentNoun(row.segment, row.activeCount)} for sale`, ...bits].join(' · '),
      ),
      href: publicSegmentBrowseHref(null, row.segment),
    })
  }
  for (const item of publicPaceItems(publicPace)) {
    sfrFollow.push({
      value: v3Text(item.value),
      label: v3Text(item.label),
    })
  }
  for (const item of publicMixItems(publicMix)) {
    sfrFollow.push({
      value: v3Text(item.value),
      label: v3Text(item.label),
    })
  }
  const [firstSfrFigure, ...restSfrFigures] = sfrFollow

  // M1 AEO: the mart-backed size and composition questions, appended to the same FAQ
  // array that feeds the FAQPage JSON-LD. Both read the strings computed above.
  const faqs = [...marketFaq.faqs]
  if (closed && lead.volumeSentence) {
    const medianBit = lead.medianLabel ? ` Median close price was ${lead.medianLabel}.` : ''
    faqs.push({
      question: `How large was the Central Oregon housing market in ${closed.year}?`,
      answer: `In ${closed.year}, closed sales across Central Oregon service-area cities totaled ${lead.volumeSentence} across ${closed.soldCount.toLocaleString('en-US')} transactions (all property types).${medianBit} Figures come from closed MLS sales, not active list inventory.`,
    })
    if (lead.leadType && lead.leadTypePct) {
      faqs.push({
        question: `What property types made up Central Oregon sales in ${closed.year}?`,
        answer: `Of ${closed.soldCount.toLocaleString('en-US')} closed sales in ${closed.year}, ${labelPropertyType(lead.leadType.code)} led at ${lead.leadType.n.toLocaleString('en-US')} closes (${lead.leadTypePct}% of units). Composition is by closed units, not active inventory.`,
      })
    }
  }

  // City rows. D9 leftover lives on the builder: each city is a door, and a
  // line through cities invents a sequence V3Chart is not for.
  const cityLedger = buildCityLedger(citySnapshots, {
    regionActive: hud.active,
  })
  const [firstCityRow, ...restCityRows] = cityLedger.rows
  const cityFootnotes = cityLedger.footnotes
  const cityRefreshedAt = cityLedger.stamp

  // Guides. Plain rows, no value column, so the Ledger carries no source line: a blog
  // post is not a figure. A row with no title is DROPPED rather than handed to
  // v3Text, which throws by design on an empty string. `title` is the one DB-sourced
  // string on this page that reaches the barrel, getRecentBlogPosts filters only on
  // status and published_at, and one blank title would otherwise take the whole
  // /housing-market render down.
  const guideRows: V3LedgerPlainRow[] = []
  for (const post of blogPosts) {
    const title = post.title?.trim()
    const slug = post.slug?.trim()
    if (!title || !slug) continue
    const excerpt = post.excerpt?.trim()
    guideRows.push({
      href: `/blog/${slug}`,
      when: v3Text(post.publishedAt ? formatDate(post.publishedAt) : 'Guide'),
      what: v3Text(title),
      detail: excerpt ? v3Text(excerpt) : undefined,
      id: slug,
    })
  }
  const [firstGuideRow, ...restGuideRows] = guideRows

  // The FAQ block's own outbound edges. PUBLIC_UI.md section 3 pattern 6 defines
  // Quiet as the block that "carries the graph's outbound edges", and answers naming
  // the region, months of supply, active inventory, and a closed-sales year while
  // linking nowhere are the dead-text defect one pattern up. Each edge ships only
  // when the answers above it actually made that claim.
  const faqEdges: V3QuietItem[] = [
    { label: 'Central Oregon region report', href: '/housing-market/central-oregon' },
  ]
  if (hud.active != null) {
    faqEdges.push({ label: 'Browse homes for sale', href: listingsBrowsePath() })
  }
  if (mosText != null) {
    faqEdges.push({ label: 'Months of supply, defined', href: '/months-of-supply' })
  }
  if (closed) {
    faqEdges.push({ label: `Closed sales explorer, ${closed.year}`, href: historyPath })
  }

  // The closing edges. Every internal link the KB hub carried, plus the outbound MLS
  // citation MarketSources used to render, plus any city with no live row.
  const exploreItems: V3QuietItem[] = [
    { label: 'Central Oregon region report', href: '/housing-market/central-oregon' },
    { label: 'Closed sales explorer', href: HISTORY_PATH },
    { label: 'Market report index', href: '/housing-market/reports' },
    { label: 'All Central Oregon cities', href: '/cities' },
    { label: 'Communities and neighborhoods', href: '/communities' },
    { label: 'Browse homes for sale', href: listingsBrowsePath() },
    { label: 'Open houses this week', href: '/open-houses' },
    { label: 'Recent price drops', href: '/price-drops' },
    { label: 'Buying and selling guides', href: '/blog' },
    { label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' },
  ]
  if (cityFootnotes.length > 0) {
    exploreItems.push({
      kind: 'prose',
      term: 'Cities not in the table above',
      body: `${cityFootnotes.map((c) => c.fact).join('. ')}.`,
    })
    for (const city of cityFootnotes) {
      const slug = city.slug ?? CITY_SLUG[city.label]
      if (!slug) continue
      exploreItems.push({
        label: `${city.label} market report`,
        href: `/housing-market/${slug}`,
      })
    }
  }

  // JSON-LD. BreadcrumbList + WebPage + Dataset + FAQPage, all from MetadataBlock.
  // The KB page emitted FAQPage from inside FAQBlock. V3Breadcrumb and V3Quiet carry
  // no structured data of their own, so the same payloads are emitted here from the
  // same arrays the sections render. dateModified is the real refreshedAt from
  // market_pulse_live, never now().
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Housing market', url: '/housing-market' },
      ],
    },
    {
      type: 'webPage',
      name: 'Central Oregon housing market',
      description:
        'Central Oregon housing market hub: live single-family market data by city, the region report, and per-city market pages.',
      url: '/housing-market',
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
      url: '/housing-market',
      dateModified: asOfIso ?? undefined,
      spatialCoverageName: 'Central Oregon, OR',
      variableMeasured: datasetVariables,
    })
  }

  if (faqs.length > 0) {
    schemas.push({ type: 'faqPage', items: faqs })
  }

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />

        <V3SectionTracker />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Housing market' }]} />

        {/* LEVEL 1, THE PAGE'S ANSWER (2026-08-27 hero-reorder fix, parity.json
            market-report openDefects item 1): live single-family figures lead,
            under ONE clock (refreshedAt), so this section's stamp is never
            dropped the way the old mixed-clock hero's was (item 2's twin defect
            on the sibling region report). The ALL-TYPE closed-year figures that
            used to open this page now follow as id="closed-year" below.
            No action: the single-ask consolidation (item 3) keeps MarketInquirySheet
            as the page's one ask and removes the ghost Value My Home button that
            used to sit here and the Sell Your Home edge that used to sit in the
            closing Quiet. */}
        {firstSfrFigure ? (
          <V3Instrument
            id="market"
            level={1}
            className="hm-tremor"
            eyebrow={v3Text('Central Oregon, Oregon')}
            headline={v3Text(
              `Central Oregon housing market${verdict.kind === 'unknown' ? '' : `: a ${verdict.label}`}`,
            )}
            figures={[firstSfrFigure, ...restSfrFigures]}
            /* First viewport is the verdict + chart, not the leftover KPI wall.
               Pace, mix, and extra-type tiles fold behind "All N figures" the
               way city pages fold the long tail. */
            foldAfter={2}
            source={v3Text(
              `${
                publicSegments.length > 0 || publicPaceHasRow(publicPace) || publicMixHasRow(publicMix)
                  ? 'Single-family figures, extra product types, and 12-month pace cover the Central Oregon region beyond the city rows. A miss omits. Not closed sales of every type'
                  : 'Single-family houses across the Central Oregon region beyond the city rows. Not closed sales of every type'
              }.${mosText != null ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : ''}`,
            )}
            updated={refreshedAt ? v3Text(formatDate(refreshedAt)) : undefined}
            chart={regionChart}
          />
        ) : (
          <V3Quiet
            id="market"
            heading="Central Oregon housing market"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No live figures right now',
                body:
                  'The Central Oregon market row did not return on this refresh, so this page is not printing a median, an inventory count, or a verdict. The city reports below carry their own live rows.',
              },
            ]}
          />
        )}

        {firstCityRow ? (
          <V3Ledger
            id="cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Market by city')}
            rows={[firstCityRow, ...restCityRows]}
            source={v3Text(
              'live MLS through Oregon Data Share, active single-family houses, one row per city',
            )}
            updated={cityRefreshedAt ? v3Text(formatDate(cityRefreshedAt)) : undefined}
            action={{ label: v3Text('All Central Oregon cities'), href: '/cities' }}
          />
        ) : (
          <V3Ledger
            id="cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Market by city')}
            rows={[]}
            emptyMessage={v3Text(
              'No city returned a live single-family market row on this refresh.',
            )}
          />
        )}

        {/* LEVEL 2, THE LAST FULL CALENDAR YEAR OF CLOSED SALES. ONE POPULATION,
            ONE CLOCK: closed.computedAt only, never mixed with the live
            refreshedAt above, so this stamp cannot go missing the way the old
            combined hero's did. Conditional, no Quiet fallback: its neighbours
            (the cities Ledger above, the guides Ledger below) are already
            unlike each other, same reasoning the region report's "pace"
            Instrument already relies on. */}
        {firstLeadFigure ? (
          <V3Instrument
            id="closed-year"
            level={2}
            className="hm-tremor"
            eyebrow={v3Text('Closed sales')}
            headline={v3Text(closed ? `Central Oregon closed sales, ${closed.year}` : 'Central Oregon closed sales')}
            figures={[firstLeadFigure, ...restLeadFigures]}
            source={v3Text(lead.source)}
            updated={
              closed?.source === 'mart' ? v3Text(formatDate(closed.computedAt)) : undefined
            }
            action={{
              label: v3Text('Closed sales explorer'),
              href: HISTORY_PATH,
              variant: 'ghost',
            }}
            chart={lead.chart}
          />
        ) : null}

        {firstGuideRow ? (
          <V3Ledger
            id="guides"
            eyebrow={v3Text('Guides and insights')}
            heading={v3Text('Central Oregon real estate, explained')}
            note={v3Text(
              'Local housing data, neighborhood deep dives, and buyer and seller guides for Central Oregon.',
            )}
            rows={[firstGuideRow, ...restGuideRows]}
            action={{ label: v3Text('All guides'), href: '/blog' }}
          />
        ) : null}

        {longView && firstLongViewFigure ? (
          <V3Instrument
            id="long-view"
            level={2}
            className="hm-tremor"
            eyebrow={v3Text('Rates and the long view')}
            headline={v3Text(longView.headline)}
            figures={[firstLongViewFigure, ...restLongViewFigures]}
            source={v3Text(longView.source)}
            cards={longView.cards}
          />
        ) : null}

        {faqs.length > 0 ? (
          <V3Quiet
            id="faq"
            eyebrow="Common questions"
            heading="Central Oregon real estate questions"
            items={[
              ...faqs.map((item) => ({
                kind: 'prose' as const,
                term: item.question,
                body: item.answer,
              })),
              ...faqEdges,
            ]}
          />
        ) : null}

        <MarketInquirySheet />

        <V3Quiet
          id="explore"
          eyebrow="More resources"
          heading="Explore Central Oregon real estate"
          items={exploreItems}
        />
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
