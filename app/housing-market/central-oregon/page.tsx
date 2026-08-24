/**
 * /housing-market/central-oregon - the Central Oregon region report, on the
 * components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. Market
 * destinations open on Instrument. Four of the six patterns, no two adjacent alike.
 * The section order, the sections this migration DELETED from the KB page, and the
 * per-section reasoning are the parity contract, not this comment:
 * design_system/ryan-realty/ui_kits/market-report-region/parity.json.
 *
 * THE RHYTHM HOLDS IN THE DEGRADED STATES TOO. A section that disappears when its read
 * comes back empty takes its half of the alternation with it, so the sections that
 * would otherwise leave two of a kind touching are unconditional and each one has a
 * declared empty form: the opening becomes a level-1 Quiet, the cities and closed-sales
 * Ledgers state a zero-row read in their own words, and the FAQ Quiet says it has no
 * answers instead of vanishing. Two sections stay conditional because their neighbours
 * are already unlike each other. The pace Instrument sits between a Quiet and a Ledger,
 * and the guides Ledger between a Quiet and the Sheet.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through pageMetadata,
 * MetadataBlock JSON-LD (BreadcrumbList, WebPage, Dataset, FAQPage), a rendered
 * V3SectionTracker with pageType="market-report", revalidate 300, and the route.
 * MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * The six invariants this file is written to hold, each enforced at its own site:
 *
 *  1. ONE DERIVATION, IT CLASSIFIES THE RAW VALUE, AND IT PRINTS ON THE SAME SIDE OF
 *     THE THRESHOLD IT CLASSIFIED. marketVerdict reads mosRaw, the screen reads mosRaw
 *     through formatMonthsOfSupply, and buildMarketFaq gets mosRaw and repeats those
 *     two steps in that order. Rounding BEFORE classifying is what the ordering
 *     prevents: 4.02 rounds to 4.0, `4.0 <= 4` prints "a seller's market", and
 *     lib/market/classify.ts calls it balanced. Rounding for DISPLAY reopens the same
 *     contradiction from the other end, which is the whole reason
 *     lib/format/months-of-supply.ts exists (design-audit P2). Naive rounding prints
 *     "4.0" beside a headline reading "a balanced market" and, one line below both,
 *     MOS_THRESHOLD_CLAUSE reading "4 months of supply or less is a seller's market":
 *     three surfaces in one viewport, one of them contradicting the other two, on a
 *     licensed-broker page. The formatter prints 4.1 for a stored 4.02 and 5.9 for a
 *     stored 5.97, so the digits never cross a boundary the raw value did not. The KB
 *     page derived the band a third time inside its hero lede with the thresholds
 *     inlined, but both places it PRINTED the figure went through this formatter, and
 *     that half of its discipline is carried across here.
 *  2. ONE GUARD PER FIGURE, SHARED WITH ITS CONSUMER. Every region figure ships on the
 *     condition buildMarketFaq applies to that same figure (`!= null && > 0`, not
 *     merely non-null), so the Instrument can never print a figure the shared builder
 *     declined to answer for and the Dataset carries no variable behind. At a stored 0
 *     that is the difference between "$0 / median list price", linked to the listings
 *     browse path under a live-MLS source line, and no figure at all. The KB lede
 *     guarded only on non-null and would have printed "A seller's market" beside
 *     "0.0 months of supply" with no FAQ answer behind it.
 *  3. ONE TRACE PER POPULATION, ONE STAMP PER TRACE, AND THE TRACE COVERS EVERY FIGURE
 *     ITS SECTION PRINTS AND NOTHING IT DOES NOT. Four populations reach this page and
 *     no section borrows another's figures or another's clock. The region row alone
 *     carries two: an active-inventory median and count beside a pace figure and a
 *     30-day closing count, both computed from homes that CLOSED. The page used to
 *     print all five under one line that named only the active set. It now gives the
 *     closed pair its own Instrument (id="pace"), because splitting the section is the
 *     honest fix and widening the line was not: the widened line ran thirteen lines at
 *     390 and pushed the section's ask below the fold, trading one defect for the one
 *     next to it. The cities Ledger cannot be split the same way, since each row
 *     interleaves both populations, so its source line names both. A trace narrower
 *     than the figures is a figure with no trace at all, and a trace wider than them is
 *     a claim with nothing behind it, so each one is assembled from the figures that
 *     actually rendered.
 *  4. ABSENT IS NOT ZERO (CLAUDE.md section 0). A covered city with no live row is
 *     not printed as "0 active" under a live-MLS source line.
 *  5. THIS PAGE CARRIES ITS OWN VISIBLE PRIMARY (PUBLIC_UI.md section 1). The rule
 *     counts VISIBLE filled controls, and the chrome's CTA counts only where the
 *     chrome actually shows it. The header's filled valuation CTA (`.nav-cta`,
 *     components/site/kb/kb.css) is `display:none` until 880px, and its twin sits in
 *     the closed Menu+ overlay below that, so "the header carries the primary at every
 *     scroll position" is FALSE at 390px. That premise was the stated ground for a
 *     ghost ask here until 2026-08-12, and it shipped a first viewport with no ask at
 *     all. The Instrument's action is therefore `primary`, and it is the only filled
 *     control on the page above the inquiry Sheet. The closing Quiet repeats the
 *     valuation door as a text edge, which is never filled, and V3Footer carries no
 *     button. One visible primary in the first viewport at 390 and at 1280.
 *  6. EVERY VALUATION DOOR CARRIES ITS ORIGIN, AND ONE BUILDER MAKES IT. Both doors
 *     come from `valuationHref(PAGE_PATH)` (lib/site/valuation-href.ts), the one way
 *     to build a valuation link on a content surface. It appends
 *     `?from=/housing-market/central-oregon` and keeps the spine's anchor last. The KB
 *     pages assembled that query string inline, one page at a time, and the first v3
 *     wave dropped it on four routes at once for exactly that reason (2026-07-15
 *     conversion audit, migration-recipe.md addendum 2026-08-11). This page previously
 *     built its own string against /sell/valuation, which ia-lock.md schedules for a
 *     301 into the single intake spine at /sell#get-value, and a 301 drops the query
 *     string with it. Carrying the parameter is this page's half of the contract.
 *     Reading it is the spine's half, and the spine's form posts a hardcoded pagePath
 *     today, which is a defect filed against that unit rather than a claim made here.
 *
 * DATES RENDER IN PACIFIC, a change from the KB page, stated rather than absorbed.
 * The KB guides rail formatted with `timeZone: 'UTC'` and formatDate is pinned to
 * America/Los_Angeles, so a post published between 00:00 and 08:00 UTC now shows the
 * previous calendar day, which is the correct day in the market this page covers.
 * ci:date-format requires the canonical formatter, so the trade is not optional. The
 * KB methodology trace already formatted in Pacific, so that stamp is unchanged.
 */

import type { Metadata } from 'next'
import {
  getMarketPulse,
  getRecentBlogPosts,
  getPriceHistory,
} from '@/lib/data'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import { getCoMarketAnnualSeries } from '@/lib/data/analytics/getCoMarketAnnual'
import {
  getPublicPlaceSegments,
  publicSegmentBrowseHref,
  publicSegmentDisplayBits,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'
import { getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import { getPublicDetachedMix, publicMixItems } from '@/lib/data/market-truth/public-mix'
import { getPublicDetachedMonthly, leftoverOrCacheMonthly } from '@/lib/data/market-truth/public-monthly'
import { PUBLIC_CLOSED_SALES_METHODOLOGY } from '@/lib/market/publish-public-methodology'
import { buildMarketFaq, type MarketFaqInput } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { marketVerdict } from '@/lib/market/classify'
import { publishInstrumentStamp } from '@/lib/market/publish-mixed-instrument-stamp'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { formatDate, zonedDateKey } from '@/lib/format/date'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
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
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { RegionInquirySheet } from './_v3/RegionInquirySheet.client'
import {
  CLOSED_SALES_FROM_YEAR,
  CLOSED_SALES_TO_YEAR,
  HISTORY_PATH,
  MARKET_CONSEQUENCE,
  PAGE_PATH,
} from './_v3/region-constants'
import { buildRegionInstruments, buildRegionLead, withoutMosFigures } from './_v3/region-figures'
import {
  buildCityLedger,
  buildClosedLedger,
  buildExploreItems,
  buildGuideRows,
} from './_v3/region-sections'
import { buildRegionMedianChart, dropInProgressMonth } from '../_v3/market-charts'
import '../_v3/tremor-density.css'

export const revalidate = 300

/**
 * The valuation door's href, both places this page opens one (invariant 6).
 *
 * Built by lib/site/valuation-href.ts, which is the ONE builder for a valuation link
 * on a content surface (migration-recipe.md addendum, 2026-08-11). This page used to
 * assemble the string inline as `${valuationPath()}?from=…`, which is the convention
 * that four routes silently dropped in one wave: an inline query string is invisible
 * to whoever rewrites the section next. It also pointed at /sell/valuation, which
 * ia-lock.md schedules for a 301 into the one intake spine at /sell#get-value, and a
 * 301 drops the query string with it.
 */
const VALUATION_HREF = valuationHref(PAGE_PATH)

// Metadata - unchanged from the KB page.
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

export default async function CentralOregonRegionPage() {
  // Data, all through the DAL (G8). No catch-and-swallow: every function below is
  // resilient-cached and answers a transient failure with its own documented
  // fallback, so a `.catch(() => null)` here would only hide a real outage behind a
  // confident empty page. Nothing is fetched that this page does not render.
  //
  // getRecentBlogPosts keeps offset 3 so this page's guide rail does not repeat the
  // /housing-market hub's three posts.
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [regionPulse, citySnapshots, blogPosts, closedSeries, priceHistory, publicSegments, publicPace, publicMix, leftoverMonthly] =
    await Promise.all([
      getMarketPulse({ geoType: 'region', geoSlug: 'central-oregon' }),
      getMarketPulseAllCitySnapshots(),
      getRecentBlogPosts({ limit: 3, offset: 3 }),
      getCoMarketAnnualSeries({
        fromYear: CLOSED_SALES_FROM_YEAR,
        toYear: CLOSED_SALES_TO_YEAR,
        typeScope: 'all',
      }),
      getPriceHistory('region', 'central-oregon', 'monthly', 60),
      getPublicPlaceSegments({ geoType: 'region', geoSlug: 'central-oregon' }),
      getPublicDetachedPace({ geoType: 'region', geoSlug: 'central-oregon' }),
      getPublicDetachedMix({ geoType: 'region', geoSlug: 'central-oregon' }),
      getPublicDetachedMonthly({
        geoType: 'region',
        geoSlug: 'central-oregon',
        currentMonthKey,
      }),
    ])

  // THE ONE DERIVATION (invariants 1 and 2). Classify the raw value, format only to
  // display it, and hand the RAW value to buildMarketFaq so the shared builder
  // repeats the same two steps in the same order.
  //
  // formatMonthsOfSupply, not Math.round: the naive round is what puts "4.0" under a
  // "balanced market" headline and above a threshold sentence that calls 4.0 or less a
  // seller's market. lib/format/months-of-supply.ts exists for exactly that boundary
  // and the KB market HUD printed the figure through it in both places it showed it.
  const mosRaw =
    regionPulse?.monthsOfSupply != null && regionPulse.monthsOfSupply > 0
      ? regionPulse.monthsOfSupply
      : null
  const mosText = mosRaw == null ? null : formatMonthsOfSupply(mosRaw)
  const verdict = marketVerdict(mosRaw)
  const chartMonths = leftoverOrCacheMonthly(
    leftoverMonthly,
    dropInProgressMonth(priceHistory, currentMonthKey),
  )
  const regionChart = buildRegionMedianChart(chartMonths.months, chartMonths.leftoverUsed)

  // buildMarketFaq - the single source for the visible FAQ, the FAQPage JSON-LD, and
  // the Dataset variableMeasured. The pulse-or-fallback input is the timeout fallback
  // the page contract requires (G52): the structured data survives a slow or missing
  // region row instead of vanishing. A null field produces no question and no
  // variable, never a fabricated one.
  const pulse: MarketFaqInput | null = regionPulse
    ? {
        grain: 'region',
        activeCount: regionPulse.activeCount,
        medianListPrice: regionPulse.medianListPrice,
        monthsOfSupply: mosRaw,
        medianDaysToPending: regionPulse.medianDaysToPending,
        refreshedAt: regionPulse.refreshedAt,
      }
    : null
  const { faqs, datasetVariables, asOfIso, asOfLabel } = buildMarketFaq(
    'Central Oregon',
    pulse ?? { grain: 'region', activeCount: null, medianListPrice: null, refreshedAt: null },
  )
  const refreshedAt = regionPulse?.refreshedAt ?? null

  // The region row's TWO Instruments, built in ./_v3/region-figures.ts. Every figure is
  // a door where a node behind it shows that figure's window (PUBLIC-PRODUCT-OS calls
  // dead text naming a linkable thing a defect), every one ships on the guard
  // buildMarketFaq applies to the same figure (invariant 2), and each section's trace is
  // assembled from the figures that section actually rendered (invariant 3). Split out
  // under ci:file-size-budget's own instruction, alongside the Ledger builders.
  const region = buildRegionInstruments(regionPulse, mosText)
  const lead = buildRegionLead(closedSeries, mosText)
  const [firstLeadFigure, ...restLeadFigures] = lead.figures
  const extraLive: V3InstrumentFigure[] = []
  for (const row of publicSegments) {
    if (row.activeCount == null || row.activeCount <= 0) continue
    const bits = publicSegmentDisplayBits(row)
    extraLive.push({
      value: v3Text(row.activeCount.toLocaleString('en-US')),
      label: v3Text(
        [`${publicSegmentNoun(row.segment, row.activeCount)} for sale`, ...bits].join(' · '),
      ),
      href: publicSegmentBrowseHref(null, row.segment),
    })
  }
  for (const item of publicPaceItems(publicPace)) {
    extraLive.push({
      value: v3Text(item.value),
      label: v3Text(item.label),
    })
  }
  for (const item of publicMixItems(publicMix)) {
    extraLive.push({
      value: v3Text(item.value),
      label: v3Text(item.label),
    })
  }
  const [firstLiveFigure, ...restLiveFigures] = [
    ...withoutMosFigures(region.live.figures),
    ...extraLive,
  ]
  const liveTrace =
    region.live.trace +
    (extraLive.length > 0
      ? ' Extra product-type inventory and 12-month pace are Market Truth, sample-gated.'
      : '')
  const [firstPaceFigure, ...restPaceFigures] = region.pace.figures
  const cityLedger = buildCityLedger(citySnapshots, {
    regionActive: regionPulse?.activeCount ?? null,
  })
  const [firstCityRow, ...restCityRows] = cityLedger.rows
  const closedLedger = buildClosedLedger(closedSeries)
  const [firstClosedRow, ...restClosedRows] = closedLedger.rows
  const [firstGuideRow, ...restGuideRows] = buildGuideRows(blogPosts)

  // The market summary, carried over from the KB ContentSection. The verdict itself
  // is the Instrument headline and the formula and thresholds are in that section's
  // trace, both from lib/market/classify.ts, so what is left here is the consequence
  // of the verdict and the page's provenance. This block also guarantees the two
  // Ledgers around it are never adjacent, which is why its outbound edge ships
  // unconditionally.
  const summaryItems: V3QuietItem[] = []
  const consequence = MARKET_CONSEQUENCE[verdict.kind]
  if (consequence) {
    summaryItems.push({
      kind: 'prose',
      term: 'What the supply number means',
      body: consequence,
    })
  }
  summaryItems.push({
    kind: 'prose',
    term: 'Methodology',
    body: [
      `Live single-family listings for the Central Oregon region${
        refreshedAt ? `, refreshed ${formatDate(refreshedAt)}` : ''
      }. City comparisons use the same live single-family inventory for each city, and each city's pace figure is the median list-to-pending time of its own single-family sales closed in the last 90 days.`,
      'Closed-sales dollar volume and units come from closed MLS sales across the Central Oregon service area, all property types, not from active list inventory.',
      'Source: Oregon Data Share via Ryan Realty.',
    ],
  })
  summaryItems.push({ label: 'Months of supply, defined', href: '/months-of-supply' })

  // The FAQ block's own outbound edges. PUBLIC_UI.md section 3 pattern 6 defines
  // Quiet as the block that "carries the graph's outbound edges", and answers naming
  // the region, months of supply, active inventory, and city pace while linking
  // nowhere are the dead-text defect one pattern up. Each edge ships only when the
  // answers above it actually made that claim.
  const faqEdges: V3QuietItem[] = [
    { label: 'Central Oregon housing market hub', href: '/housing-market' },
  ]
  if (region.activeCount != null) {
    faqEdges.push({ label: 'Browse homes for sale', href: listingsBrowsePath() })
  }
  if (mosText != null) {
    faqEdges.push({ label: 'Months of supply, defined', href: '/months-of-supply' })
  }
  if (firstClosedRow) {
    faqEdges.push({ label: 'Closed sales explorer', href: HISTORY_PATH })
  }

  // The closing edges, built in ./_v3/region-sections.ts: every internal link the KB
  // region page carried through its footer rail, the outbound MLS citation MarketSources
  // used to render, the page's second valuation door, and any covered city with no live
  // row. That second door is a text edge, never a filled control, so it repeats the ask
  // for a reader who scrolled past the Instrument without adding a competing primary to
  // any viewport, and it is the same VALUATION_HREF so the two cannot drift.
  const exploreItems = buildExploreItems(VALUATION_HREF, cityLedger.footnotes)

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
    // The description names the metrics the payload actually carries, read off
    // datasetVariables rather than typed alongside it. The KB sentence hardcoded four
    // metric names while the variable list is derived one figure at a time, so a null
    // column left the payload describing a measurement it did not contain - a claim
    // outrunning its payload, which is the same defect class as a wrong number.
    const metricNames = datasetVariables.map((variable) => variable.name.toLowerCase())
    const metricList =
      metricNames.length === 1
        ? metricNames[0]
        : `${metricNames.slice(0, -1).join(', ')}, and ${metricNames[metricNames.length - 1]}`
    schemas.push({
      type: 'dataset',
      name: `Central Oregon, Oregon real estate market statistics${asOfLabel ? `, ${asOfLabel}` : ''}`,
      description:
        'Live single-family home market data for Central Oregon. ' +
        `Includes ${metricList}. ` +
        'Sourced from Oregon Data Share via Ryan Realty.',
      url: '/housing-market/central-oregon',
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

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Housing market', href: '/housing-market' },
            { label: 'Central Oregon' },
          ]}
        />

        {firstLeadFigure ? (
          <V3Instrument
            id="market"
            level={1}
            className="hm-tremor"
            eyebrow={v3Text('Central Oregon, Oregon')}
            headline={v3Text(
              `Central Oregon market report${verdict.kind === 'unknown' ? '' : `: a ${verdict.label}`}`,
            )}
            figures={[firstLeadFigure, ...restLeadFigures]}
            source={v3Text(lead.source)}
            updated={(() => {
              const stamp = publishInstrumentStamp([
                lead.latest?.computedAt,
                mosText ? refreshedAt : null,
              ])
              return stamp ? v3Text(formatDate(stamp)) : undefined
            })()}
            action={{
              label: v3Text('Value my home'),
              href: VALUATION_HREF,
              variant: 'primary',
            }}
            chart={lead.chart}
            chartSecondary={lead.chartSecondary}
          />
        ) : (
          <V3Quiet
            id="market"
            heading="Central Oregon market report"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No ALL-TYPE volume on this refresh',
                body: lead.source,
              },
            ]}
          />
        )}

        {firstCityRow ? (
          <V3Ledger
            id="cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Cities and towns')}
            rows={[firstCityRow, ...restCityRows]}
            // The trace covers BOTH populations the row prints (invariant 3). The
            // count and the median are active single-family inventory; days to
            // pending is not an attribute of an active listing at all, it is the
            // median list-to-pending time of single-family homes that CLOSED in the
            // last 90 days, computed per city by refresh_market_pulse(). The KB tiles
            // this Ledger replaces printed only the count and the median, so the
            // inherited source line was never written to cover a pace figure.
            source={v3Text(
              'live MLS through Oregon Data Share, one row per city. The count and the median list price are active single-family listings. Days to pending is the median list-to-pending time of single-family homes that closed in the last 90 days',
            )}
            updated={cityLedger.stamp ? v3Text(formatDate(cityLedger.stamp)) : undefined}
            action={{ label: v3Text('Every Central Oregon city'), href: '/cities' }}
          />
        ) : (
          <V3Ledger
            id="cities"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Cities and towns')}
            rows={[]}
            emptyMessage={v3Text(
              'No city returned a live single-family market row on this refresh.',
            )}
          />
        )}

        {firstLiveFigure ? (
          <V3Instrument
            id="sfr-pulse"
            level={2}
            className="hm-tremor"
            eyebrow={v3Text('Single-family')}
            headline={v3Text('Single-family list inventory')}
            figures={[firstLiveFigure, ...restLiveFigures]}
            source={v3Text(liveTrace)}
            updated={refreshedAt ? v3Text(formatDate(refreshedAt)) : undefined}
            chart={regionChart}
          />
        ) : null}

        <V3Quiet
          id="summary"
          eyebrow="Market data"
          heading="Central Oregon market summary"
          items={summaryItems}
        />

        {/* THE SECOND POPULATION GETS ITS OWN SECTION (invariant 3). Days to pending
            and the 30-day closing count come off the same market_pulse_live row as the
            figures above, but they are measured on homes that CLOSED, so they get their
            own heading, their own source line, and no share of the active-inventory
            trace. Level 2, no action: the page's one filled ask belongs to the section
            that opens it. It sits between the summary Quiet and the closed-sales Ledger
            because both are closed-sales facts, and Quiet-Instrument-Ledger keeps the
            rhythm. When it has no figures the neighbours are Quiet and Ledger, which is
            a legal pair, so its absence breaks nothing. */}
        {firstPaceFigure ? (
          <V3Instrument
            id="pace"
            level={2}
            eyebrow={v3Text('Closed sales')}
            headline={v3Text('The pace of the Central Oregon market')}
            figures={[firstPaceFigure, ...restPaceFigures]}
            source={v3Text(region.pace.trace)}
            updated={refreshedAt ? v3Text(formatDate(refreshedAt)) : undefined}
          />
        ) : null}

        {firstClosedRow ? (
          <V3Ledger
            id="closed-sales"
            eyebrow={v3Text('Closed sales')}
            heading={v3Text('Size of the market')}
            note={v3Text(
              'Dollar volume and units of closed sales, all property types, not only active list inventory.',
            )}
            rows={[firstClosedRow, ...restClosedRows]}
            source={v3Text(
              `Closed MLS sales through Oregon Data Share, Central Oregon service-area cities, all property types, calendar years ${CLOSED_SALES_FROM_YEAR} through ${CLOSED_SALES_TO_YEAR}. ${PUBLIC_CLOSED_SALES_METHODOLOGY}`,
            )}
            updated={closedLedger.stamp ? v3Text(formatDate(closedLedger.stamp)) : undefined}
            action={{
              label: v3Text('Closed sales explorer'),
              href: HISTORY_PATH,
            }}
          />
        ) : (
          // The declared degraded form, and it is why this section is unconditional.
          // Rhythm is part of the contract ("no two adjacent alike"), and a section
          // that vanishes takes its half of the alternation with it: without this
          // branch a closed-sales series that returns nothing puts the summary Quiet
          // directly against the FAQ Quiet. It also keeps the page honest about a
          // zero-row read — absent is not zero, and the message states what the query
          // did rather than implying the market had no closings.
          <V3Ledger
            id="closed-sales"
            eyebrow={v3Text('Closed sales')}
            heading={v3Text('Size of the market')}
            rows={[]}
            emptyMessage={v3Text(
              `No calendar year between ${CLOSED_SALES_FROM_YEAR} and ${CLOSED_SALES_TO_YEAR} returned closed-sales volume on this refresh.`,
            )}
            action={{
              label: v3Text('Closed sales explorer'),
              href: HISTORY_PATH,
            }}
          />
        )}

        {/* Unconditional for the same reason as the section above: when the region
            row does not return, buildMarketFaq answers nothing, and a vanishing FAQ
            would put the closed-sales Ledger directly against the guides Ledger. The
            degraded form states why there are no answers instead of asserting them,
            and it still carries the block's outbound edges, which is what pattern 6
            is for. */}
        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading="Central Oregon real estate questions"
          items={
            faqs.length > 0
              ? [
                  ...faqs.map((item) => ({
                    kind: 'prose' as const,
                    term: item.question,
                    body: item.answer,
                  })),
                  ...faqEdges,
                ]
              : [
                  {
                    kind: 'prose' as const,
                    term: 'No answers on this refresh',
                    body: 'These answers are read from the live Central Oregon market row, which did not return, so this page is not stating a median, an inventory count, or a verdict in question form either.',
                  },
                  ...faqEdges,
                ]
          }
        />

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

        <RegionInquirySheet />

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
