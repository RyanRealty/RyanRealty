/**
 * /housing-market/annual-review — the citable annual Central Oregon market
 * reference, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. Market
 * destinations open on Instrument. Four of the six patterns, no two adjacent
 * alike: Instrument (region now) → Ledger (city inventory) → Instrument (region
 * trailing 12 months) → Ledger (city trailing 12 months) → Quiet (methodology and
 * coverage) → Sheet (ask) → Quiet (questions and edges).
 *
 * THE PARITY CONTRACT BINDING THIS ROUTE:
 * design_system/ryan-realty/ui_kits/market-report-annual/parity.json, authored
 * with this migration, its `route` field naming this file. ci:mockup-parity binds
 * a route only through such a file, so before it existed this route was ungated
 * and every KB-era deletion this migration made was undeclared on disk. The
 * section order, the sections DELETED from the KB page, and where every deleted
 * figure went are that contract, not this comment. The directory holds no
 * index.html on purpose — the visual target is the six closed patterns in
 * PUBLIC_UI.md, not a KB-era mockup — and ci:mockup-coverage fires only on
 * directories that do carry one, so the contract adds a gate to this route
 * without asserting a mockup that does not exist.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata (same title, description, path, keywords), the canonical path,
 * revalidate 300, the route, the MetadataBlock JSON-LD payloads (BreadcrumbList,
 * WebPage, Article, Dataset, FAQPage), a rendered V3SectionTracker with
 * pageType="market-report-annual", and the capture contract
 * (submitMarketPageInquiry, variant 'inquiry', fields name/email/message).
 * ONE CAPTURE AFFORDANCE IS NOT CARRIED ACROSS: KbSell's address-prefill input,
 * with the three proof figures beside it. It is deleted outright, declared in the
 * parity contract's `deletions` block with where each of the three figures went,
 * and it is the reason the two seller doors below still carry `?from=`.
 * MetadataBlock stays on the legacy register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 * FAQPage moved its EMISSION SITE, not its payload — the KB page emitted it from
 * inside FAQBlock, and V3Quiet carries no structured data of its own, so the
 * identical `faqs` array is emitted from MetadataBlock here.
 *
 * DATA ACCURACY (CLAUDE.md section 0). Every figure traces to one of two cache
 * tables per section 7 (never raw listings aggregation). The page holds four
 * populations, so it prints four traces and four stamps and no section borrows
 * another's clock:
 *
 *   regionPulse / citySnapshots — market_pulse_live, single-family. Live inventory
 *     (active count, median list price, months of supply from refresh_market_pulse(),
 *     median days to pending). 10-15 min freshness. Pulse DTP / 30-day stay off
 *     the city year ledger.
 *   regionDetail                — leftover overlay on the region closed instrument
 *     (medianClose / closedCount / yoyMedian). Cache median DOM may stay.
 *   cityDetails                 — leftover overlay on each report-city cache row
 *     (medianClose / closedCount / yoyMedian × 100). Miss omits those three,
 *     never cache fill. Cache median DOM may stay.
 *
 * THE INVARIANTS THIS FILE IS WRITTEN TO HOLD:
 *
 *  1. ONE DERIVATION, AND IT CLASSIFIES THE RAW VALUE. marketVerdict reads the raw
 *     months of supply, the screen rounds only to display, and buildMarketFaq gets
 *     the raw figure and repeats those two steps in that order.
 *  2. ONE GUARD PER FIGURE, SHARED WITH ITS CONSUMER. Every pulse figure uses
 *     buildMarketFaq's own `!= null && > 0` condition, so the headline cannot
 *     assert a verdict the shared builder declined to answer. The KB page printed
 *     the verdict whenever the value was non-null, which at a stored 0 would read
 *     "a seller's market" beside "0.0 months of supply" with no FAQ answer behind it.
 *  3. ABSENT IS NOT ZERO. A report city with no live row, or with a row carrying no
 *     median, keeps its door and states its own reason in the coverage block.
 *  4. THE PAGE CARRIES ITS OWN VISIBLE PRIMARY, AND THE COUNT IS OF VISIBLE
 *     FILLED CONTROLS (PUBLIC_UI.md section 1). The premise this file used to
 *     state, that the sticky header's filled valuation CTA is carried at every
 *     scroll position, is FALSE AT MOBILE and is struck, not qualified:
 *     `.topbar a.nav-cta` (components/site/kb/kb.css) is `display:none` until
 *     880px and below that sits inside the closed Menu+ overlay. Measured on this
 *     route 2026-08-12, at 390 every header element whose text names a valuation
 *     computes 0x0, so demoting the page's own ask to ghost "because the header
 *     carries the primary" shipped a first viewport with no ask at all. The
 *     opening Instrument's action is therefore PRIMARY (V3Instrument's default)
 *     and the chrome's CTA counts only where the chrome shows it. The level-2
 *     ask stays ghost, a second filled control in no viewport, and the page's
 *     conversion ask is the Sheet, whose submit is its own viewport's primary.
 *     The two seller doors are text edges in the closing Quiet, never filled
 *     controls, so they are present at every width and compete with nothing.
 *     When the pulse row is absent the opening section is a Quiet, which by the
 *     barrel's contract carries no action: the degraded read removes the ask.
 *     MEASURED AFTER THE CHANGE, first viewport, scrollY 0: at 390 exactly ONE
 *     visible filled control, this page's own primary at y 758. At 1280 TWO,
 *     because the un-migrated KB header shows its cream nav-cta at y 18. The
 *     second one belongs to the chrome, which this route cannot fix from here
 *     and which the parity contract already carries as this page's mixed-register
 *     debt. It resolves when the header migrates to V3Chrome, whose own contract
 *     is one primary in the chrome. Demoting the page's ask to remove it is the
 *     defect above, and it costs the mobile viewport its only ask.
 *  5. EVERY SELLER DOOR CARRIES ITS ORIGIN. Two, both from the closing Quiet,
 *     both stamped `from=/housing-market/annual-review`: the intake spine through
 *     valuationHref() (lib/site/valuation-href.ts, the one canonical builder) and
 *     the written-CMA surface through WRITTEN_VALUATION_HREF, whose constant
 *     states the measured reason it does not use that builder's base. The Menu+
 *     overlay's bare valuation link belongs to the layout's chrome, so the
 *     measurement that matters here is the one inside <main>. A bare door does
 *     not merely lose attribution: app/home-valuation/actions.ts falls back to
 *     the referer's own path, so the valuation page records itself as the origin
 *     of every seller lead this page produces (the 2026-07-15 conversion audit).
 *     KbSell set `from` to its mounted pathname, and both constants reproduce it.
 *  6. ONE NUMBER PER FACT, ON THE PAGE AND IN THE PAYLOAD. Each figure published
 *     twice, on screen and in the Dataset markup, is rounded ONCE upstream of
 *     both: the trailing-12-month median through formatWholeDollars (never
 *     formatPrice, which rounds to the nearest $1,000), and the region median
 *     list price through medianListDisplay, which applies the brand's list-price
 *     rounding before the figure reaches the Instrument or buildMarketFaq (which
 *     already holds the rule for months of supply, publishing Number(displayMos)).
 *     A variable is the machine-readable copy of a number on the screen, so a
 *     city with no rendered row publishes no variable either.
 *
 * MONTHS OF SUPPLY DISPLAYS THROUGH formatMonthsOfSupply, the one boundary-safe
 * display rule: it refuses to print a rounded figure crossing a threshold the raw
 * value does not cross (raw 4.05 prints 4.1, not the 4.0 that would contradict the
 * verdict beside it and the threshold clause under it). lib/site/market-faq.ts
 * formats the same figure the same way, so the Instrument, the visible FAQ answer,
 * and the Dataset variable are one number and one verdict.
 *
 * DATA ONLY THROUGH @/lib/data (G8). No read is fetched that this page does not
 * render, and no read is wrapped in a catch: every DAL function below is
 * resilient-cached (lib/data/cache/resilient.ts retries uncached, then returns its
 * documented fallback and never throws), so a catch here would be dead code that
 * reads as a swallow.
 *
 * The pure turn from a DAL row into barrel-ready props lives in ./_v3/annual-sections.ts
 * (the ci:file-size-budget split; the gate's instruction is split, not re-baseline).
 */

import type { Metadata } from 'next'
import { marketVerdict, MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE } from '@/lib/market/classify'
import { getCityMarketDetail, getPriceHistory } from '@/lib/data'
import { getMarketPulseAllCitySnapshots } from '@/lib/data/market/getMarketPulseSnapshot'
import {
  getPublicPlaceSegments,
  publicSegmentBrowseHref,
  publicSegmentNoun,
} from '@/lib/data/market-truth/public-segments'
import { getPublicDetachedPace, publicPaceItems } from '@/lib/data/market-truth/public-pace'
import { getPublicDetachedMonthly, leftoverOrCacheMonthly, dropCurrentMonth } from '@/lib/data/market-truth/public-monthly'
import { getDetachedOverlays } from '@/lib/data/market-truth/getSellBendMarket'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { formatMonthsOfSupply } from '@/lib/format/months-of-supply'
import { REPORT_CITIES, NON_MLS_CITY_EXEMPTIONS } from '@/lib/data/geo/report-cities'
import { buildMarketFaq } from '@/lib/site/market-faq'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput, StatValue } from '@/lib/site/json-ld'
import { formatDate, zonedDateKey } from '@/lib/format/date'
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
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { AnnualInquirySheet } from './_v3/AnnualInquirySheet.client'
import {
  CANONICAL_PATH,
  PERIOD_TYPE,
  REGION_GEO_SLUG,
  REGION_LABEL,
  SELL_SPINE_HREF,
  WRITTEN_VALUATION_HREF,
  dbGeoSlug,
} from './_v3/annual-constants'
import {
  CITY_REPORTS_PATH,
  REGION_REPORT_PATH,
  buildClosedInstrument,
  buildInventoryLedger,
  buildRegionFigures,
  buildYearLedger,
  buildAnnualCharts,
  overlayYearDetailWithLeftover,
  type MissingCity,
} from './_v3/annual-sections'

export const revalidate = 300

/** Report cities with a real, queryable MLS City. Tumalo is named separately below. */
// THE GRID IS THE REPORT SET, NOT ONLY THE CORE (2026-08-27 audit: Prineville
// has a hub row, its own /housing-market/prineville report, and 176 actives —
// and appeared on this page only as a remainder sentence, against the page's
// own claim of "every report city"). The outer-county report cities join the
// core here; a city whose snapshot cannot source a figure still drops to the
// coverage notes with its reason, exactly as before.
const GRID_CITIES = [
  ...REPORT_CITIES.filter((c) => !(c.label in NON_MLS_CITY_EXEMPTIONS)),
  { slug: 'prineville', label: 'Prineville' },
  { slug: 'madras', label: 'Madras' },
  { slug: 'powell-butte', label: 'Powell Butte' },
]
const NAMED_EXEMPTIONS = REPORT_CITIES.filter((c) => c.label in NON_MLS_CITY_EXEMPTIONS)

// Metadata — unchanged from the KB page.
export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Central Oregon housing market annual review',
    description:
      'The citable Central Oregon market reference: active inventory, months of supply, and the trailing 12 months of closed sales against the same window a year earlier, for the region and every report city. Live from Oregon Data Share.',
    path: CANONICAL_PATH,
    keywords: [
      'Central Oregon housing market annual review',
      'Central Oregon real estate market report',
      'Bend Redmond Sisters home sales year over year',
      'Central Oregon months of supply',
      'Oregon real estate market data',
      'Ryan Realty',
    ],
  })
}

export default async function AnnualReviewPage() {
  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [regionDetail, citySnapshots, cityDetailRows, priceHistory, publicSegments, publicPace, cityPaces, leftoverMonthly, regionOverlays] =
    await Promise.all([
    getCityMarketDetail({ geoType: 'region', geoSlug: REGION_GEO_SLUG, periodType: PERIOD_TYPE }),
    getMarketPulseAllCitySnapshots(),
    Promise.all(
      GRID_CITIES.map((c) =>
        getCityMarketDetail({ geoType: 'city', geoSlug: dbGeoSlug(c.slug), periodType: PERIOD_TYPE }),
      ),
    ),
    getPriceHistory('region', REGION_GEO_SLUG, 'monthly', 60),
    getPublicPlaceSegments({ geoType: 'region', geoSlug: REGION_GEO_SLUG }),
    getPublicDetachedPace({ geoType: 'region', geoSlug: REGION_GEO_SLUG }),
    Promise.all(GRID_CITIES.map((c) => getPublicDetachedPace({ geoType: 'city', geoSlug: c.slug }))),
    getPublicDetachedMonthly({
      geoType: 'region',
      geoSlug: REGION_GEO_SLUG,
      currentMonthKey,
    }),
    getDetachedOverlays([{ geoType: 'region', geoSlug: REGION_GEO_SLUG }]),
  ])
  const regionMt = regionOverlays.get(`region:${REGION_GEO_SLUG}`)
  const hud = leftoverHudKpis({
    grain: 'region',
    headlines: regionMt?.headlines ?? null,
    inventory: regionMt?.inventory ?? null,
    pace: publicPace,
  })
  const chartMonths = leftoverOrCacheMonthly(
    leftoverMonthly,
    dropCurrentMonth(priceHistory, currentMonthKey),
  )
  const cityDetails = cityDetailRows.map((detail, i) =>
    overlayYearDetailWithLeftover(detail, cityPaces[i], GRID_CITIES[i]),
  )

  // Stamps are the REAL refresh timestamps off the rows, never now(). The region
  // pulse row stamps the live-inventory tier and the region detail row stamps the
  // closed-sales tier; each city Ledger computes its own stamp from its own rows.
  const leftoverStamp = regionMt?.headlines?.computedAt ?? regionMt?.inventory?.computedAt ?? null
  const inventoryAsOf = leftoverStamp
  const salesAsOf = regionDetail?.updatedAt ?? null
  const periodStart = regionDetail?.periodStart ?? null
  const periodEnd = regionDetail?.periodEnd ?? null

  // THE ONE DERIVATION (invariants 1 and 2). Classify the raw value, round only to
  // display it, and hand the RAW value to buildMarketFaq so the shared builder
  // repeats the same two steps in the same order.
  const mosRaw = hud.monthsSupply != null && hud.monthsSupply > 0 ? hud.monthsSupply : null
  const verdict = marketVerdict(mosRaw)

  // THE OTHER DERIVATION (invariant 6). formatPrice rounds a list price to the
  // nearest $1,000, which is the brand display rule and is why the Instrument
  // printed $730,000 while the Dataset variable published the raw 729900 off the
  // same column. Rounding ONCE here and handing the rounded figure to both the
  // Instrument and buildMarketFaq makes the figure, the FAQ sentence, and the
  // variableMeasured entry one number. Guarded on both ends: a median under $500
  // would round to 0, and a zero under a live-MLS source line is the synthesized
  // figure invariant 3 refuses, so it publishes no figure instead.
  const medianListDisplay =
    hud.medianList != null && hud.medianList > 0
      ? Math.round(hud.medianList / 1000) * 1000 || null
      : null

  // buildMarketFaq — the single source for the visible FAQ, the FAQPage JSON-LD,
  // and the region's Dataset variableMeasured. The pulse-or-fallback input is the
  // timeout fallback the page contract requires (G52): the structured data survives
  // a slow or missing region row instead of vanishing. A null field produces no
  // question and no variable, never a fabricated one.
  // `pulse` is the pulse-only slice of the input and `pulse ?? {...}` is the honest
  // null-shaped fallback, the same idiom app/housing-market/central-oregon/page.tsx
  // and app/housing-market/[...slug]/page.tsx carry. The regionDetail-sourced fields
  // below are passed either way, so a slow or missing market_pulse_live row costs the
  // page its pulse questions, not its whole structured-data block.
  const pulse = {
    grain: 'region' as const,
    source: 'market-truth' as const,
    activeCount: hud.active,
    medianDaysToPending: hud.daysToPending,
    pulseActiveCount: hud.active,
  }
  const { faqs, datasetVariables: regionFaqVariables, asOfIso } = buildMarketFaq(REGION_LABEL, {
    grain: 'region',
    source: 'market-truth',
    activeCount: pulse.activeCount,
    medianListPrice: medianListDisplay,
    monthsOfSupply: mosRaw,
    medianDaysToPending: pulse.medianDaysToPending,
    pulseActiveCount: pulse.pulseActiveCount,
    refreshedAt: inventoryAsOf,
    soldCount12mo: publicPace.closedCount ?? null,
  })

  // Sections, built from the rows (./_v3/annual-sections.ts). Built BEFORE the
  // Dataset payload because the payload is derived from what actually rendered.
  const extraFigures: Array<{ value: ReturnType<typeof v3Text>; label: ReturnType<typeof v3Text>; href?: string }> = []
  for (const row of publicSegments) {
    if (row.monthsOfSupply == null || row.activeCount == null || row.activeCount <= 0) continue
    extraFigures.push({
      value: v3Text(formatMonthsOfSupply(row.monthsOfSupply)),
      label: v3Text(`${publicSegmentNoun(row.segment, row.activeCount)} · months of supply`),
      href: publicSegmentBrowseHref(null, row.segment),
    })
  }
  const paceItems = publicPaceItems(publicPace)
  for (const item of paceItems) {
    if (item.key === 'medClose' || item.key === 'closed' || item.key === 'yoy') continue
    extraFigures.push({
      value: v3Text(item.value),
      label: v3Text(item.label),
    })
  }
  const [firstRegionFigure, ...restRegionFigures] = [
    ...buildRegionFigures(hud, mosRaw, medianListDisplay),
    ...extraFigures,
  ]
  const inventory = buildInventoryLedger(GRID_CITIES, citySnapshots, {
    regionActive: hud.active,
  })
  const [firstInventoryRow, ...restInventoryRows] = inventory.rows
  const closed = buildClosedInstrument(
    regionDetail
      ? {
          ...regionDetail,
          medianSalePrice: publicPace.medianClose,
          soldCount: publicPace.closedCount,
          yoyMedianPriceDeltaPct:
            publicPace.yoyMedian != null ? publicPace.yoyMedian * 100 : null,
        }
      : null,
  )
  if (publicPace.medianClose != null || publicPace.closedCount != null || publicPace.yoyMedian != null) {
    closed.source =
      '12-month leftover figures are Market Truth mt-v1, labeled by window, not the cache rolling row. ' +
      closed.source.replace(/^closed/, 'Closed')
  }
  const [firstClosedFigure, ...restClosedFigures] = closed.figures
  const year = buildYearLedger(GRID_CITIES, cityDetails)
  const [firstYearRow, ...restYearRows] = year.rows
  const annualCharts = buildAnnualCharts(chartMonths.months, currentMonthKey, chartMonths.leftoverUsed)

  // Dataset variableMeasured — region core stats (from buildMarketFaq, so the FAQ
  // and the Dataset never disagree) plus one YoY price-change variable per report
  // city that actually has a live figure. A null yoyMedianPriceDeltaPct emits
  // nothing, never a fabricated 0 percent. The city set is narrowed to the cities
  // that EARNED A ROW above: a variable for a city the page prints no figure for
  // is a machine-readable claim with nothing on screen to check it against, which
  // is the same defect class as a number the page cannot source.
  const yearMissing = new Set(year.missing.map((c) => c.slug))
  const cityDatasetVariables: StatValue[] = GRID_CITIES.filter((c) => !yearMissing.has(c.slug))
    .map((c) => ({
      label: c.label,
      yoy: cityDetails[GRID_CITIES.indexOf(c)]?.yoyMedianPriceDeltaPct ?? null,
    }))
    .filter((r): r is { label: string; yoy: number } => r.yoy != null)
    .map((r) => ({
      name: `${r.label} median sale price, year over year change`,
      value: Math.round(r.yoy * 10) / 10,
      unitText: 'percent',
    }))
  // Both region closed-sales variables ride the SAME on-screen figure — the
  // trailing-12-month median, whose label carries the year-over-year change — so
  // both ship on that figure's own condition and neither can outlive it.
  if (publicPace.medianClose != null && publicPace.medianClose > 0) {
    regionFaqVariables.push({
      name: 'Central Oregon median sale price, trailing 12 months',
      value: Math.round(publicPace.medianClose),
      unitText: 'USD',
    })
    if (publicPace.yoyMedian != null) {
      regionFaqVariables.push({
        name: 'Central Oregon median sale price, year over year change',
        value: Math.round(publicPace.yoyMedian * 1000) / 10,
        unitText: 'percent',
      })
    }
  }
  const datasetVariables = [...regionFaqVariables, ...cityDatasetVariables]

  const regionTrace =
    'live MLS through Oregon Data Share, single-family homes across the Central Oregon region. ' +
    MOS_METHODOLOGY_CLAUSE +
    ' ' +
    MOS_THRESHOLD_CLAUSE
  const inventoryTrace =
    'live MLS through Oregon Data Share, active single-family listings, one row per report city. ' +
    MOS_METHODOLOGY_CLAUSE +
    ' ' +
    MOS_THRESHOLD_CLAUSE
  const yearTrace =
    '12-month leftover figures are Market Truth mt-v1, labeled by window, not the cache rolling row. ' +
    'Closed MLS sales through Oregon Data Share, single-family homes, the trailing 12 months against ' +
    'the same 12-month window one year earlier, one row per report city. Not active inventory. Cache median days on market may remain on the row.'

  // Methodology and coverage: every claim the KB page made in its Methodology
  // section and its exemption caption, the Oregon Data Share citation MarketSources
  // used to render, and an honest reason for every report city that earned no row
  // above, each keeping its door (invariant 3).
  const coverage: V3QuietItem[] = [
    {
      kind: 'prose',
      term: 'What these figures cover',
      body: [
        "Single-family homes only (MLS PropertyType 'A'). Year-over-year figures compare the trailing 12 months against the same 12-month window one year earlier, never a partial-year or quarter-versus-year comparison. Report-city year-ledger median, sold count, and YoY are leftover Market Truth cells; a leftover miss omits those three rather than filling from cache.",
        'Active inventory and closed sales are two tiers on two clocks: inventory refreshes every 10 to 15 minutes, closed-sales figures every 6 hours. Each section above prints the refresh timestamp of the query behind it, never a render-time clock.',
      ],
    },
  ]
  for (const city of NAMED_EXEMPTIONS) {
    const exemption = NON_MLS_CITY_EXEMPTIONS[city.label]
    if (!exemption) continue
    coverage.push({
      kind: 'prose',
      term: `${city.label} has no row of its own`,
      body: `${exemption.reason} Its market activity is counted in ${exemption.mlsCity}, so a ${city.label} row here would be a structural stub rather than a measured figure.`,
    })
    coverage.push({
      label: `${exemption.mlsCity}, where ${city.label} listings file`,
      href: exemption.servedAt,
    })
  }
  if (inventory.missing.length > 0) {
    coverage.push({
      kind: 'prose',
      // The facts under this heading STATE a figure for most cities ("Madras
      // has 74 active..."), so a heading claiming "no live inventory figure"
      // contradicted its own body (2026-08-27 audit). The hub's wording is the
      // honest one.
      term: 'Cities not in the tables above',
      body: `${inventory.missing.map((c) => c.fact).join('. ')}.`,
    })
  }
  if (year.missing.length > 0) {
    coverage.push({
      kind: 'prose',
      term: 'Cities with no trailing-12-month figure',
      body: `${year.missing.map((c) => c.fact).join('. ')}.`,
    })
  }
  const doored = new Set<string>()
  for (const city of [...inventory.missing, ...year.missing] as MissingCity[]) {
    if (!city.slug || doored.has(city.slug)) continue
    doored.add(city.slug)
    coverage.push({ label: `${city.label} market report`, href: `/housing-market/${city.slug}` })
  }
  coverage.push({ label: 'Oregon Data Share', href: 'https://www.oregondatashare.com' })

  // The questions, and the outbound edges this page owes the graph. Each edge ships
  // only when the answers above it actually made that claim.
  const questions: V3QuietItem[] = faqs.map((item) => ({
    kind: 'prose' as const,
    term: item.question,
    body: item.answer,
  }))
  const edges: V3QuietItem[] = [
    { label: 'Live Central Oregon market report', href: REGION_REPORT_PATH },
    { label: 'Weekly market reports by city', href: CITY_REPORTS_PATH },
    { label: 'Central Oregon housing market hub', href: '/housing-market' },
  ]
  if (mosRaw != null) {
    edges.push({ label: 'Months of supply, defined', href: '/months-of-supply' })
  }
  if (hud.active != null && hud.active > 0) {
    edges.push({ label: 'Browse homes for sale', href: listingsBrowsePath() })
  }
  // The two seller doors, the only surviving descendants of the KB page's KbSell
  // block. Both carry this page as their origin (invariant 5). Text edges, so
  // neither adds a second filled control to the viewport the Sheet's primary owns.
  edges.push({ label: 'Sell your home in Central Oregon', href: SELL_SPINE_HREF })
  edges.push({ label: 'Value my home', href: WRITTEN_VALUATION_HREF })

  // JSON-LD — BreadcrumbList + WebPage + Article + Dataset + FAQPage, all from
  // MetadataBlock. dateModified is the real refreshedAt from market_pulse_live.
  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Housing market', url: '/housing-market' },
        { name: 'Annual review', url: CANONICAL_PATH },
      ],
    },
    {
      type: 'webPage',
      name: 'Central Oregon housing market annual review',
      description:
        'The citable Central Oregon market reference: active inventory, months of supply, and the trailing 12 months of closed sales against the same window a year earlier, for the region and every report city.',
      url: CANONICAL_PATH,
    },
    {
      type: 'article',
      headline: 'Central Oregon housing market annual review',
      description:
        'Active inventory, months of supply, and trailing-12-month closed sales year over year, for Central Oregon and every report city, sourced live from Oregon Data Share.',
      url: CANONICAL_PATH,
      datePublished: '2026-08-03',
      dateModified: inventoryAsOf ?? undefined,
      authorName: 'Ryan Realty',
    },
  ]

  if (datasetVariables.length > 0 && asOfIso) {
    schemas.push({
      type: 'dataset',
      name: `Central Oregon housing market annual review, ${asOfIso}`,
      description:
        'Live single-family home market data for Central Oregon and its report cities. Includes active inventory, median list price, months of supply, and trailing-12-month closed-sales figures with year-over-year change against the same window a year earlier. Sourced from Oregon Data Share via Ryan Realty.',
      url: CANONICAL_PATH,
      dateModified: asOfIso,
      temporalCoverage: periodStart && periodEnd ? `${periodStart}/${periodEnd}` : undefined,
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
            { label: 'Annual review' },
          ]}
        />

        {firstRegionFigure ? (
          <V3Instrument
            id="market"
            level={1}
            eyebrow={v3Text('Central Oregon annual review')}
            headline={v3Text(
              verdict.kind === 'unknown'
                ? 'Central Oregon housing market annual review'
                : `Central Oregon housing market annual review: a ${verdict.label}`,
            )}
            figures={[firstRegionFigure, ...restRegionFigures]}
            source={v3Text(regionTrace)}
            updated={inventoryAsOf ? v3Text(formatDate(inventoryAsOf)) : undefined}
            action={{ label: v3Text('Live Central Oregon market report'), href: REGION_REPORT_PATH }}
            chart={annualCharts.region}
          />
        ) : (
          <V3Quiet
            id="market"
            heading="Central Oregon housing market annual review"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No live inventory figures right now',
                body: 'The Central Oregon live market row did not return on this refresh, so this page is not printing an active count, a median list price, or a market verdict. The closed-sales figures below come from a separate cache and carry their own timestamp.',
              },
            ]}
          />
        )}

        {firstInventoryRow ? (
          <V3Ledger
            id="cities-now"
            eyebrow={v3Text('Report cities')}
            heading={v3Text('Active inventory by city')}
            rows={[firstInventoryRow, ...restInventoryRows]}
            source={v3Text(inventoryTrace)}
            updated={inventory.stamp ? v3Text(formatDate(inventory.stamp)) : undefined}
          />
        ) : (
          <V3Ledger
            id="cities-now"
            eyebrow={v3Text('Report cities')}
            heading={v3Text('Active inventory by city')}
            rows={[]}
            emptyMessage={v3Text(
              'No report city returned a live single-family market row with a published median list price on this refresh.',
            )}
            source={v3Text(inventoryTrace)}
          />
        )}

        {firstClosedFigure ? (
          <V3Instrument
            id="closed-sales"
            level={2}
            eyebrow={v3Text('Trailing 12 months')}
            headline={v3Text(closed.headline)}
            figures={[firstClosedFigure, ...restClosedFigures]}
            source={v3Text(closed.source)}
            updated={salesAsOf ? v3Text(formatDate(salesAsOf)) : undefined}
            action={{
              label: v3Text('Weekly market reports by city'),
              href: CITY_REPORTS_PATH,
              variant: 'ghost',
            }}
            chart={annualCharts.trailing}
          />
        ) : (
          <V3Quiet
            id="closed-sales"
            eyebrow="Trailing 12 months"
            heading="Central Oregon closed sales, trailing 12 months"
            items={[
              { kind: 'prose', term: closed.absence.term, body: closed.absence.body },
              { label: 'Weekly market reports by city', href: CITY_REPORTS_PATH },
            ]}
          />
        )}

        {firstYearRow ? (
          <V3Ledger
            id="cities-year"
            eyebrow={v3Text('Report cities')}
            heading={v3Text('Closed sales by city, year over year')}
            note={v3Text(
              'Every figure below is the trailing 12 months measured against the same 12-month window one year earlier.',
            )}
            rows={[firstYearRow, ...restYearRows]}
            source={v3Text(yearTrace)}
            updated={year.stamp ? v3Text(formatDate(year.stamp)) : undefined}
          />
        ) : (
          <V3Ledger
            id="cities-year"
            eyebrow={v3Text('Report cities')}
            heading={v3Text('Closed sales by city, year over year')}
            rows={[]}
            emptyMessage={v3Text(
              'No report city returned a trailing-12-month closed-sales row with a published median sale price.',
            )}
            source={v3Text(yearTrace)}
          />
        )}

        <V3Quiet id="methodology" eyebrow="Sources" heading="Methodology and coverage" items={coverage} />

        <AnnualInquirySheet />

        <V3Quiet
          id="faq"
          eyebrow="Common questions"
          heading="Central Oregon real estate questions"
          items={[...questions, ...edges]}
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
