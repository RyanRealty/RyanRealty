/**
 * /zip/[zip] — the ten canonical Central Oregon ZIP nodes, on the
 * components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md §3 (locked 2026-08-11). A
 * ZIP takes the CITY grain: the Field of this ZIP's houses opens the page, and
 * the verdict is a caption inside the market section, never a number hero.
 * Section order is the parity contract, design_system/ryan-realty/ui_kits/zip/
 * parity.json.
 *
 * FOUR PATTERNS, WHICH IS THE CAP. Field (the houses) · Instrument (the market,
 * and once per other property type the ZIP holds) · Ledger (neighborhoods here,
 * then the rest of the service area) · Sheet (alerts, then the seller door). No
 * two adjacent sections share a pattern. The property-type run is ONE logical
 * section under the 2026-08-26 enumeration amendment: one template, the data
 * picks the members, one eyebrow names the run, the member is the only variable.
 *
 * THE PAGE CONTRACT, CARRIED ACROSS UNCHANGED: generateMetadata through
 * pageMetadata (both the canonical and the noindex branch, same strings),
 * generateStaticParams over the same ten ZIPs in the same order,
 * dynamicParams=false, revalidate 60, MetadataBlock JSON-LD (BreadcrumbList +
 * Place + Dataset with the same five variables, same names, same unitText, same
 * order), the section tracker (V3SectionTracker derives pageType from the path,
 * and lib/analytics/page-type.ts maps /zip/ to 'zip', so the analytics pageType
 * is the same string the KB tracker emitted), and the listing-alert capture
 * payload. MetadataBlock stays on the legacy register: JSON-LD is not
 * visual language and ci:ai-structured-data pins this route to it by name.
 *
 * DATA ACCURACY (CLAUDE.md §0) — every rule the KB page held is held here:
 *
 *   1. HUD OVERLAYS MARKET TRUTH ON A HIT. getMetric(geoType 'zip', segment
 *      'detached') supplies active_count, median_list_active, months_of_supply
 *      and market_verdict when the mt-v1 cell is publishable (PostalCode
 *      membership). A miss falls back to live listing_tile_mv tiles from ONE
 *      getZipListings call. UNKNOWN IS NOT ZERO: a degraded read publishes no
 *      figure rather than a zero, and a publishable 0 that contradicts visible
 *      pins is treated as a disagreement, not as an inventory.
 *   2. A SHARE PRICE IS NOT A HOME PRICE. PropertyType 'A' carries the MLS
 *      fractional-interest sub types, whose ListPrice buys a share of a resort
 *      home while the square footage is the whole home's. The median list and
 *      the median price per square foot are computed over whole-home tiles only
 *      (listingIsFractionalInterest reads all three dimensions, because eight
 *      Active quarter shares at Lake Creek Lodge are filed under sub type
 *      "Condominium"). The count and the days-on-market pool keep every active
 *      listing: a fractional interest is real inventory, its price is just not
 *      this median's subject.
 *   3. DAYS ON MARKET IS NOT DAYS TO PENDING. `dom` is how long the homes STILL
 *      for sale have been listed; the fast ones have already left the active
 *      set. It ships under its own label and no other. Median to pending comes
 *      from the leftover HUD's own 90-day cell (ci:days-to-pending-source).
 *   4. ONE TRACE PER POPULATION. The Field, the market Instrument, and the
 *      neighborhood Ledger each print the trace of the query behind them, and
 *      the chart states its own scope when it falls back to the parent city.
 *   5. THE CHART IS LABELED AT ITS OWN GRAIN. getPublicDetachedMonthly at
 *      geoType 'zip' first; the parent city's leftover months only as the
 *      documented fallback, and then the caption says the series is the city's.
 *   6. ONE PRIMARY PER VISIBLE VIEWPORT (PUBLIC_UI.md §1). The layout mounts
 *      V3Chrome, which fills "Value my home" only on Sell, so this page carries
 *      its own ask: the market Instrument's action is the one filled control.
 *      The first viewport is the Field, where the next tap is a house — the
 *      city grain's documented opening, and the rows are doors, not buttons.
 *   7. A DOOR IS PART OF THE FIGURE. Every count that links carries this page's
 *      exact population through zipSearchHref (postalCode + propertyType=A +
 *      view=list). `?keywords=<zip>` is free text and was never this filter.
 *
 * DELETIONS THIS MIGRATION MAKES, AND WHERE THE INFORMATION WENT:
 *   KbHero            — the ZIP's houses open the page instead of a stock
 *                       regional photograph. The count, the median list and the
 *                       days figure it printed are all figures on the market
 *                       Instrument, each under its own trace.
 *   KbMarketHud       — the verdict is the Instrument's caption sentence, the
 *                       KPI grid is its figure set, and the median-close series
 *                       is its chart.
 *   KbFeatured        — the Field lists every active home, not the top 14.
 *   KbListingMap      — the same Google map, in the Field's map slot, bound to
 *                       the list both ways.
 *   KbExploreTowns ×2 — the two Ledgers.
 *   KbCommunityAlerts — ZipAlertsSheet, same server action, same payload.
 *   KbSell            — ZipSellSheet, same ?address=&from= navigation.
 *   PublicProductTypes / PublicPaceStats / PublicMixStats — the barrel's
 *                       V3PlacePropertyTypes for the type run, and the leftover
 *                       pace and mix items as figures on the market Instrument,
 *                       exactly as the migrated /housing-market hub carries them.
 *   MarketSources     — the Oregon Data Share citation is named in words inside
 *                       every trace on the page.
 *   SmoothScrollProvider, KbFooter — chrome. V3Footer, outside <main>.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getZipListings, getPriceHistory } from '@/lib/data'
import { getMetric } from '@/lib/data/market-truth/getMetric'
import { getPublicPlaceSegments } from '@/lib/data/market-truth/public-segments'
import { EMPTY_PUBLIC_PACE, getPublicDetachedPace } from '@/lib/data/market-truth/public-pace'
import {
  getPublicDetachedMonthly,
  leftoverNeighborhoodOrCityMonthly,
} from '@/lib/data/market-truth/public-monthly'
import { EMPTY_PUBLIC_MIX, getPublicDetachedMix } from '@/lib/data/market-truth/public-mix'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { withTimeoutFallback, withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { formatDate, zonedDateKey } from '@/lib/format/date'
import { formatPrice, formatPriceExact } from '@/lib/format/money'
import { formatMonthsOfSupply, monthsOfSupplyVerdict } from '@/lib/format/months-of-supply'
import { MOS_METHODOLOGY_CLAUSE, MOS_THRESHOLD_CLAUSE, publicSupplyVerdictLine } from '@/lib/market/classify'
import { buildYearSeries } from '@/lib/kb/year-series'
import { publicPaceItems } from '@/lib/data/market-truth/public-pace'
import { publishDaysFigure } from '@/lib/market/publish-days-figure'
import { leftoverHudKpis } from '@/lib/market/publish-leftover-hud'
import { listingIsFractionalInterest } from '@/lib/listing/publish-listing-figure'
import { canonicalCityCacheSlug } from '@/lib/market/city-cache-slug'
import { homesForSalePath } from '@/lib/slug'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3PlacePropertyTypes,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
// The one copy of the mix turn the migrated Market family already uses.
// Importing it beats a second implementation that would drift the day one of
// the two was fixed — the same reason lib/kb/place-sections is shared across
// the three place grains. The pace turn is NOT borrowed: that one filters out
// medClose and the year-over-year line because the hub carries them elsewhere,
// and nothing else on this page does.
import { buildPublicMixFigures } from '@/app/housing-market/[...slug]/_v3/geo-figures'
import { ZipAlertsSheet } from './_v3/ZipAlertsSheet.client'
import { ZipHomesField } from './_v3/ZipHomesField'
import { ZipSellSheet } from './_v3/ZipSellSheet.client'
import {
  CANONICAL_ZIPS,
  ZIP_AREA,
  ZIP_CITY_NAME,
  ZIP_CITY_SLUG,
  isFigure,
  median,
  neighborhoodName,
  normalizeZip,
  numeric,
  ZIP_FIELD_PREVIEW,
  zipFieldCaption,
  zipFieldItems,
  zipMedianChart,
  zipSearchHref,
  ZIP_PACE_KEYS_ON_THE_HUD,
} from './_v3/zip-constants'

type Params = { zip: string }

export const dynamicParams = false
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ zip: string }>> {
  return Array.from(CANONICAL_ZIPS).map((zip) => ({ zip }))
}

/** A publishable mt-v1 cell's numeric value, or null. */
function zipMetricValue(metric: Awaited<ReturnType<typeof getMetric>>): number | null {
  if (metric != null && metric.isPublishable && metric.value != null) return metric.value
  return null
}

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  if (!CANONICAL_ZIPS.has(zip)) {
    return pageMetadata({
      title: 'ZIP not found · Ryan Realty',
      description: 'This ZIP code is outside the Ryan Realty service area.',
      path: `/zip/${zip}`,
      noindex: true,
    })
  }
  const area = ZIP_AREA[zip] ?? 'Central Oregon'
  return pageMetadata({
    title: `Homes for sale in ${zip} · ${area}, Oregon`,
    description: `Active single-family homes in ZIP ${zip} (${area}), Central Oregon. Live market snapshot, neighborhood breakdown, and every listing on the map.`,
    path: `/zip/${zip}`,
  })
}

export default async function ZipPage({ params }: { params: Promise<Params> }) {
  const { zip: rawZip } = await params
  const zip = normalizeZip(rawZip)
  if (!CANONICAL_ZIPS.has(zip)) notFound()

  const area = ZIP_AREA[zip] ?? 'Central Oregon'
  const citySlug = ZIP_CITY_SLUG[zip] ?? 'bend'
  const cityName = ZIP_CITY_NAME[zip] ?? 'Bend'
  const zipPageUrl = `/zip/${zip}`
  const cacheCitySlug = canonicalCityCacheSlug(citySlug)

  const zipMt = (stat: string) =>
    withTimeoutFallback(
      getMetric({ stat, geoType: 'zip', geoSlug: zip, segment: 'detached' }),
      null,
      3000,
      `zip:mt:${stat}`,
    )

  const currentMonthKey = zonedDateKey(new Date()).slice(0, 7)
  const [
    tilesRead,
    cityPriceHist,
    mtActiveCell,
    mtMedianCell,
    mtMosCell,
    mtVerdictCell,
    publicSegments,
    publicPace,
    leftoverCityMonthly,
    leftoverZipMonthly,
    publicMix,
  ] = await Promise.all([
    // ONE tile fetch feeds the Field, its map, the neighborhood Ledger, and the
    // miss-path figures. limit=5000 captures the complete ZIP; no ZIP in this
    // service area is within an order of magnitude of that cap, and per §0 a
    // fetch cap is never reported as if it were the inventory count.
    withTimeoutFallbackResult(
      getZipListings(zip, { status: 'active', propertyType: 'A', limit: 5000 }),
      [] as Awaited<ReturnType<typeof getZipListings>>,
      5000,
      'zip:tiles',
    ),
    withTimeoutFallback(
      getPriceHistory('city', cacheCitySlug, 'monthly', 60),
      [] as Awaited<ReturnType<typeof getPriceHistory>>,
      4500,
      'zip:cityPriceHistory',
    ),
    zipMt('active_count'),
    zipMt('median_list_active'),
    zipMt('months_of_supply'),
    zipMt('market_verdict'),
    withTimeoutFallback(getPublicPlaceSegments({ geoType: 'zip', geoSlug: zip }), [], 3000, 'zip:publicSegments'),
    withTimeoutFallback(getPublicDetachedPace({ geoType: 'zip', geoSlug: zip }), EMPTY_PUBLIC_PACE, 3000, 'zip:publicPace'),
    withTimeoutFallback(
      getPublicDetachedMonthly({ geoType: 'city', geoSlug: citySlug, currentMonthKey }),
      [],
      4500,
      'zip:leftoverCityMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMonthly({ geoType: 'zip', geoSlug: zip, currentMonthKey }),
      [],
      4500,
      'zip:leftoverZipMonthly',
    ),
    withTimeoutFallback(
      getPublicDetachedMix({ geoType: 'zip', geoSlug: zip }),
      EMPTY_PUBLIC_MIX,
      3000,
      'zip:publicMix',
    ),
  ])
  const chartMonths = leftoverNeighborhoodOrCityMonthly({
    leftoverNeighborhood: leftoverZipMonthly,
    leftoverCity: leftoverCityMonthly,
    neighborhoodCache: [],
    cityCache: cityPriceHist,
    currentMonthKey,
    neighborhoodCacheSparse: true,
  })

  // ── LIVE TILE STATS ───────────────────────────────────────────────────────
  // §0 UNKNOWN IS NOT ZERO: the `[]` fallback is indistinguishable from a ZIP
  // with no inventory, so every tile-derived figure is null when the read
  // failed, and null renders as no figure rather than as a zero.
  const tiles = tilesRead.value
  const tileActiveCount: number | null = tilesRead.ok ? tiles.length : null

  // §0 A SHARE PRICE IS NOT A HOME PRICE. Live counts 2026-08-19: 33 of the 257
  // Active 'A' rows in 97707 are fractional, and including them published a
  // median list of $775,000 against a whole-home median of $812,500 (4.6% low)
  // and $407/sq ft against $429 (5.0% low). 97756 16 of 387, 97702 12 of 374.
  const wholeHomeTiles = tilesRead.ok ? tiles.filter((t) => !listingIsFractionalInterest(t)) : []
  const medianListPrice = tilesRead.ok
    ? median(numeric(wholeHomeTiles.map((t) => t.listPrice), 1))
    : null
  const medianPricePerSqft = tilesRead.ok
    ? median(numeric(wholeHomeTiles.map((t) => t.pricePerSqft), 1))
    : null
  // The days pool keeps every active listing, fractional included: a fractional
  // interest is real inventory and its time on market is its own.
  const medianDom = tilesRead.ok ? median(numeric(tiles.map((t) => t.dom))) : null

  // Headline HIT: publishable active_count + median_list_active. A publishable
  // 0 that contradicts visible pins is a disagree — keep tiles, never print 0.
  const mtActiveVal = zipMetricValue(mtActiveCell)
  const mtMedianVal = zipMetricValue(mtMedianCell)
  const mtMosVal = zipMetricValue(mtMosCell)
  const mtActiveRounded = mtActiveVal != null ? Math.round(mtActiveVal) : null
  const mtHit =
    mtActiveRounded != null &&
    mtMedianVal != null &&
    !(mtActiveRounded === 0 && tiles.length > 0)
  const activeCount: number | null = mtHit ? mtActiveRounded : tileActiveCount
  const publishedMedianList: number | null = mtHit ? mtMedianVal : medianListPrice
  const hudAsOf = mtHit
    ? (mtActiveCell?.provenance.computedAt ?? mtVerdictCell?.provenance.computedAt)
    : undefined

  // ── THE MARKET SECTION ───────────────────────────────────────────────────
  // Leftover membership only (D19). A miss omits the tile. Do not invent
  // daysToPending from active DOM. New · 30 days stays omitted until leftover
  // carries a 30-day new-listings cell; the tile-derived count below is
  // published only as its own Dataset variable, under its own name.
  const hud = leftoverHudKpis({
    grain: 'zip',
    headlines:
      mtHit && mtActiveRounded != null && mtMosVal != null
        ? {
            activeCount: mtActiveRounded,
            monthsOfSupply: mtMosVal,
            medianListPrice: mtMedianVal,
          }
        : null,
    inventory:
      mtHit && mtActiveRounded != null
        ? { activeCount: mtActiveRounded, medianListPrice: mtMedianVal }
        : null,
    pace: publicPace,
  })

  // THE ONE VERDICT DERIVATION, and it is the one the KB HUD used on this same
  // page: monthsOfSupplyVerdict over the published months-of-supply value,
  // formatMonthsOfSupply to display it. The raw value is classified and only
  // then rounded, so a rounded digit cannot walk the verdict across a threshold.
  const mosPublished = hud.monthsSupply
  const verdict = monthsOfSupplyVerdict(mosPublished)
  const mosText = mosPublished != null ? formatMonthsOfSupply(mosPublished) : null

  const listingNoun = mtHit ? 'detached single-family' : 'single-family'
  const marketFigures: V3InstrumentFigure[] = []
  if (publishedMedianList != null) {
    marketFigures.push({
      value: v3Text(formatPriceExact(publishedMedianList)),
      label: v3Text('median list price'),
      href: zipSearchHref(zip),
    })
  }
  if (activeCount != null && activeCount > 0) {
    marketFigures.push({
      value: v3Text(activeCount.toLocaleString('en-US')),
      label: v3Text(mtHit ? 'detached homes for sale' : 'homes for sale'),
      href: zipSearchHref(zip),
    })
  }
  if (hud.pending != null && hud.pending > 0) {
    marketFigures.push({
      value: v3Text(hud.pending.toLocaleString('en-US')),
      label: v3Text('pending · now'),
    })
  }
  if (hud.closed30 != null && hud.closed30 > 0) {
    marketFigures.push({
      value: v3Text(hud.closed30.toLocaleString('en-US')),
      label: v3Text('closed · 30 days'),
    })
  }
  if (hud.new30 != null && hud.new30 > 0) {
    marketFigures.push({
      value: v3Text(hud.new30.toLocaleString('en-US')),
      label: v3Text('new · 30 days'),
    })
  }
  if (hud.saleToList != null) {
    marketFigures.push({
      value: v3Text(`${hud.saleToList.toFixed(1)}%`),
      // pace.saleToOriginal, a 12-month statistic; bare-labelled until the
      // 2026-08-27 audit.
      label: v3Text('sale to original list · 12 months'),
    })
  }
  if (hud.daysToPending != null && hud.daysToPending > 0) {
    marketFigures.push({
      value: v3Text(String(hud.daysToPending)),
      label: v3Text('median to pending · 90 days'),
    })
  }
  if (mosText != null) {
    marketFigures.push({
      value: v3Text(mosText),
      label: v3Text('months of supply'),
      href: '/months-of-supply',
    })
  }
  if (hud.sold12mo != null && hud.sold12mo > 0) {
    marketFigures.push({
      value: v3Text(hud.sold12mo.toLocaleString('en-US')),
      label: v3Text('sold · 12 months'),
    })
  }
  // §0 rule 3: time on market for the homes STILL for sale, under its own label
  // and never under a days-to-pending one. Tenths, through publishDaysFigure:
  // the medians land on half-days and integer-rounding one published days
  // figure beside another page's tenths is the Black Butte 40-vs-39.5 defect.
  const medianDomLabel = publishDaysFigure(medianDom)
  if (medianDomLabel != null) {
    marketFigures.push({
      value: v3Text(medianDomLabel),
      label: v3Text('median days on market, active listings'),
    })
  }
  if (medianPricePerSqft != null) {
    marketFigures.push({
      // Whole dollars, not formatPrice: formatPrice rounds to the nearest
      // $1,000 (lib/format/money.ts), which would erase a three-digit figure.
      value: v3Text(formatPriceExact(Math.round(medianPricePerSqft))),
      label: v3Text('median price per sq ft, active listings'),
    })
  }
  // The 12-month leftover pace and the detached mix, each item carrying its own
  // window on its label. The three pace keys the HUD tiles above already print
  // are skipped: printing 97.6% twice under two labels reads as two findings.
  for (const item of publicPaceItems(publicPace)) {
    if (ZIP_PACE_KEYS_ON_THE_HUD.has(item.key)) continue
    marketFigures.push({ value: v3Text(item.value), label: v3Text(item.label) })
  }
  for (const figure of buildPublicMixFigures(publicMix)) marketFigures.push(figure)
  const [firstMarketFigure, ...restMarketFigures] = marketFigures

  // §0 rule 5: the caption states the scope. When the series is the parent
  // city's leftover months rather than the ZIP's own, it says so, so a city
  // trend can never read as this ZIP's.
  const chartScope = chartMonths.cityFallback
    ? `${cityName} at city scope, not ${zip}`
    : `ZIP ${zip}`
  const scopedChart = zipMedianChart(
    buildYearSeries(chartMonths.months, 5),
    `Median close by month, single-family, ${chartScope}`,
  )

  const marketTrace =
    (mtHit
      ? `regional MLS through Oregon Data Share: detached single-family houses inside ZIP ${zip} (${area}). `
      : `live MLS through Oregon Data Share, every active single-family listing in ZIP ${zip} (${area}). `) +
    'Medians over list price exclude fractional-interest listings, whose price buys a share rather than the home. ' +
    'Every figure names its own window. A withheld figure is absent, not estimated.' +
    (mosText != null ? ` ${MOS_METHODOLOGY_CLAUSE} ${MOS_THRESHOLD_CLAUSE}` : '')

  const verdictSentence =
    verdict && mosText != null
      ? `ZIP ${zip} is a ${verdict.label.toLowerCase()} at ${mosText} months of supply.`
      : activeCount != null && activeCount > 0
        ? `${activeCount.toLocaleString('en-US')} active ${listingNoun} ${activeCount === 1 ? 'listing' : 'listings'} in ${zip}.`
        : null

  // THE QUESTION HEADING STAYS ON EVERY PLACE GRAIN (Matt, 2026-08-26). The
  // KB HUD templated `Is ${geoName} a buyer's or seller's market?` here with
  // geoName `ZIP ${zip}`, and the v3 migration kept only the answer — which
  // made this the one grain whose market section no longer led with the
  // question a reader actually types. In v3 idiom the question IS the market
  // Instrument's headline, and the verdict sentence directly beneath it is
  // the answer. A question with no answer under it is worse than a label
  // (§0), so when no verdict is publishable the headline falls back to the
  // homes-for-sale form. Family consistency is gated: ci:market-question.
  const marketHeadline =
    verdict && mosText != null
      ? publicSupplyVerdictLine(`ZIP ${zip}`, verdict.label.toLowerCase())
      : `Homes for sale in ${zip}`

  // ── THE FIELD ────────────────────────────────────────────────────────────
  const fieldItemsAll = zipFieldItems(tiles, zip)
  // The phone-usable slice: rows and pins are ONE set (the Field contract),
  // and that set is the preview, with the caption stating total + cap.
  const fieldItems = fieldItemsAll.slice(0, ZIP_FIELD_PREVIEW)
  const fieldCaption = zipFieldCaption(zip, fieldItemsAll.length, fieldItems.length)
  const fieldTrace =
    `live MLS through Oregon Data Share, every active single-family listing in ZIP ${zip} (${area}) ` +
    'that reports a list price. The map and the list are the same set'
  // §0: this list and the Instrument's "detached homes for sale" figure below
  // are two different populations of the same MLS PropertyType='A' bucket —
  // this list is every sub type in it, the Instrument figure is the Market
  // Truth detached-only subset. Only stated when the two counts genuinely
  // come from different queries (mtHit); when the Instrument falls back to
  // the same tile count, there is nothing to reconcile.
  const populationNote =
    mtHit && activeCount != null && fieldItemsAll.length > 0
      ? `The listed set of ${fieldItemsAll.length.toLocaleString('en-US')} counts every property type. The ${activeCount.toLocaleString('en-US')} single-family figure below is the detached subset the market figures measure.`
      : undefined

  // ── NEIGHBOURHOODS IN THIS ZIP ───────────────────────────────────────────
  // Grouped from the same tiles. THE KEY IS THE RAW FEED VALUE AND THE LABEL IS
  // THE NAME: grouping by the raw value keeps a row's door exact, because
  // `subdivision=` filters on the string the MLS stored.
  const groups = new Map<string, { label: string; count: number; prices: number[] }>()
  let unnamed = 0
  for (const tile of tiles) {
    const raw = (tile.subdivisionName ?? '').trim()
    const label = neighborhoodName(raw)
    if (!label) {
      unnamed += 1
      continue
    }
    const group = groups.get(raw) ?? { label, count: 0, prices: [] }
    group.count += 1
    if (isFigure(tile.listPrice, 1)) group.prices.push(tile.listPrice)
    groups.set(raw, group)
  }
  const shownGroups = [...groups.entries()]
    .map(([raw, group]) => ({ raw, label: group.label, count: group.count, med: median(group.prices) }))
    .filter(
      (g): g is { raw: string; label: string; count: number; med: number } =>
        g.med != null && g.count > 0,
    )
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8)
  const renamed = shownGroups.some((g) => g.label !== g.raw)
  const neighborhoodRows: V3LedgerFigureRow[] = shownGroups.map((g) => ({
    href: zipSearchHref(zip, g.raw),
    when: v3Text(`${g.count} for sale`),
    what: v3Text(g.label),
    value: v3Text(formatPrice(g.med)),
    id: g.raw,
  }))
  const [firstNeighborhood, ...restNeighborhoods] = neighborhoodRows

  // ── THE REST OF THE SERVICE AREA ─────────────────────────────────────────
  // No counts beside them: this page has not queried those places, and a
  // hardcoded zero under a live-MLS heading is the §0 defect. The KB page
  // rendered all nine as "0 Active" for exactly that reason.
  const nearbyRows: V3LedgerPlainRow[] = [
    {
      href: homesForSalePath(cityName),
      when: v3Text('Whole city'),
      what: v3Text(`Every ${cityName} home for sale`),
      id: `city-${cityName}`,
    },
    ...[...CANONICAL_ZIPS]
      .filter((other) => other !== zip)
      .map((other) => ({
        href: `/zip/${other}`,
        when: v3Text(ZIP_AREA[other] ?? 'Central Oregon'),
        what: v3Text(other),
        id: other,
      })),
  ]
  const [firstNearby, ...restNearby] = nearbyRows

  // ── STRUCTURED DATA ──────────────────────────────────────────────────────
  // The same five Dataset variables, same names, same unitText, same order.
  type StatValue = { name: string; value: string | number; unitText?: string }
  const datasetStats: StatValue[] = []
  if (activeCount != null) {
    datasetStats.push({
      name: mtHit ? 'Active detached single-family listings' : 'Active single-family listings',
      value: activeCount,
      unitText: 'listings',
    })
  }
  if (publishedMedianList != null) {
    datasetStats.push({ name: 'Median list price', value: publishedMedianList, unitText: 'USD' })
  }
  if (medianPricePerSqft != null) {
    datasetStats.push({ name: 'Median price per sq ft', value: Math.round(medianPricePerSqft), unitText: 'USD' })
  }
  if (medianDom != null) {
    // THE SAME GRAIN THE PAGE PRINTS. publishDaysFigure renders tenths, so
    // Math.round here published 60 into the payload beside a visible 59.5 — the
    // one defect the migration recipe's §3.5 names: a crawler reading a number
    // the page does not show is two derivations, whatever the code looks like.
    datasetStats.push({
      name: 'Median days on market',
      value: Math.round(medianDom * 10) / 10,
      unitText: 'days',
    })
  }
  if (hud.new30 != null && hud.new30 > 0) {
    // THE SAME POPULATION THE PAGE PRINTS. The KB page counted this from the
    // tiles (59 on 97701) while its HUD showed the leftover 30-day cell (67),
    // so one page published two different answers to "new in the last 30 days",
    // one visible and one machine-readable. The leftover cell is the one on
    // screen, so it is the one in the payload, and the tile derivation is gone
    // rather than left computing a number nothing renders.
    datasetStats.push({ name: 'New listings last 30 days', value: hud.new30, unitText: 'listings' })
  }

  const datasetLede =
    verdictSentence ??
    `Active ${listingNoun} listings in ${zip}.`

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Homes for sale', url: '/homes-for-sale' },
        { name: zip, url: zipPageUrl },
      ],
    },
    {
      type: 'place',
      name: `ZIP ${zip} · ${area}`,
      description: `Browse active single-family listings in ZIP code ${zip}, ${area}, Central Oregon.`,
      url: zipPageUrl,
      address: { postalCode: zip, state: 'OR', country: 'US' },
    },
    {
      type: 'dataset',
      name: mtHit
        ? `Detached single-family market snapshot for ZIP ${zip}`
        : `Active single-family market snapshot for ZIP ${zip}`,
      description: mtHit
        ? `${datasetLede} Source: market_metric mt-v1 detached ZIP PostalCode.`
        : `${datasetLede} Derived from the Oregon RMLS feed via Ryan Realty.`,
      url: zipPageUrl,
      // The same stamp the Instrument prints as "updated {date}" — a crawler
      // reading this Dataset payload sees the identical freshness the page
      // itself shows (§0: never omit dateModified next to a visible stamp).
      dateModified: hudAsOf ?? undefined,
      spatialCoverageName: `ZIP ${zip} · ${area}`,
      variableMeasured: datasetStats,
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />
        <V3SectionTracker />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Homes for sale', href: '/homes-for-sale?view=list' },
            { label: zip },
          ]}
        />

        {/* Pattern 2, Field. Houses fill the fold; the count is a caption and
            the H1 is the money head term. */}
        <ZipHomesField
          zip={zip}
          headline={v3Text(`Homes for sale in ${zip}`)}
          fieldItems={fieldItems}
          caption={fieldCaption}
          source={fieldTrace}
          populationNote={populationNote}
          emptyMessage={
            tilesRead.ok
              ? `No active single-family listing in ${zip} reports a list price right now.`
              : 'The listing feed did not answer on this refresh, so this frame is not claiming an inventory.'
          }
        />

        {/* Pattern 1, Instrument. The verdict is the caption sentence, the KPI
            row is the figure set, and the median-close series is the chart. */}
        {firstMarketFigure ? (
          <V3Instrument
            id="market-report"
            level={2}
            eyebrow={v3Text(`${zip} · ${area} · Oregon`)}
            headline={v3Text(marketHeadline)}
            note={verdictSentence ? v3Text(verdictSentence) : undefined}
            figures={[firstMarketFigure, ...restMarketFigures]}
            chart={scopedChart}
            source={v3Text(marketTrace)}
            updated={hudAsOf ? v3Text(formatDate(hudAsOf)) : undefined}
            action={{
              label: v3Text('See the full market report'),
              href: `/housing-market/${cacheCitySlug}`,
            }}
          />
        ) : (
          <V3Quiet
            id="market-report"
            heading={`Homes for sale in ${zip}`}
            headingLevel={2}
            items={[
              {
                kind: 'prose',
                term: 'No live figures right now',
                body: `The market reads did not answer on this refresh, so this page is not printing a median or a verdict for ${zip}. The other ZIP codes below carry their own live reads.`,
              },
            ]}
          />
        )}

        {/* Pattern 3, Ledger. Every row is a door, and the door carries this
            page's exact population. */}
        {firstNeighborhood ? (
          <V3Ledger
            id="subdivisions"
            eyebrow={v3Text(`${zip} · Neighborhoods`)}
            heading={v3Text('Neighborhoods in this ZIP')}
            rows={[firstNeighborhood, ...restNeighborhoods]}
            note={
              unnamed > 0
                ? v3Text(
                    `${unnamed.toLocaleString('en-US')} of these listings carry no spelled neighborhood name in the feed. They are inside the count above and outside these rows.`,
                  )
                : undefined
            }
            source={v3Text(
              `live MLS through Oregon Data Share, active single-family listings in ZIP ${zip}, grouped by the subdivision name on each listing. The value column is that group's median list price` +
                (renamed
                  ? '. The feed writes Crooked River Ranch as Crr, so the rows print the community name and the links carry the feed value'
                  : ''),
            )}
            action={{ label: v3Text(`All homes in ${zip}`), href: zipSearchHref(zip) }}
          />
        ) : (
          <V3Ledger
            id="subdivisions"
            eyebrow={v3Text(`${zip} · Neighborhoods`)}
            heading={v3Text('Neighborhoods in this ZIP')}
            rows={[]}
            emptyMessage={v3Text(
              tilesRead.ok
                ? `No active listing in ${zip} names a neighborhood the MLS records by name.`
                : 'The listing feed did not answer on this refresh, so this page is not grouping neighborhoods.',
            )}
          />
        )}

        {/* Pattern 1 again, as ONE enumeration: one section per other product
            type this ZIP holds. A type with nothing publishable is absent, never
            an empty section and never a zero. */}
        <V3PlacePropertyTypes
          placeName={`ZIP ${zip}`}
          citySlug={cacheCitySlug}
          postalCode={zip}
          rows={publicSegments}
        />

        {/* Pattern 5, Sheet. Same server action, same payload, same honeypot. */}
        <ZipAlertsSheet zip={zip} area={area} city={cityName} />

        {/* Pattern 3, Ledger. */}
        {firstNearby ? (
          <V3Ledger
            id="other-zips"
            eyebrow={v3Text('Central Oregon ZIPs')}
            heading={v3Text('Other ZIP codes we cover')}
            note={v3Text('The rest of the service area. Each ZIP page carries its own live inventory.')}
            rows={[firstNearby, ...restNearby]}
            action={{ label: v3Text('Open map search'), href: '/search' }}
          />
        ) : null}

        {/* Pattern 5, Sheet. Same ?address=&from= navigation KbSell carried. */}
        <ZipSellSheet zip={zip} area={area} />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo
          only when it is NOT nested in sectioning content, and <main> is
          sectioning content, so inside it the element is a generic and the page
          ships no contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
