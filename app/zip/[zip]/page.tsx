/**
 * /zip/[zip] - the ten canonical Central Oregon ZIP nodes, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md, locked 2026-08-11. A ZIP is a
 * place node, so it opens on the answer (Instrument) and then hands the visitor the
 * inventory as a spatial surface (Field), which is the locked opening for Homes.
 * FOUR of the six patterns, no two adjacent alike, chrome exempt. The section order,
 * the sections this migration DELETED, and the per-section reasoning are the parity
 * contract, not this comment:
 * design_system/ryan-realty/ui_kits/zip/parity.json.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through pageMetadata
 * (both the canonical and the noindex branch), MetadataBlock JSON-LD (BreadcrumbList,
 * Place, Dataset with the same five variables), a rendered KbSectionTracker with
 * pageType="zip", revalidate 60, dynamicParams false, generateStaticParams over the
 * same ten ZIPs in the same order, and the listing-alert capture payload.
 * MetadataBlock and KbSectionTracker stay on the KB register deliberately: both are
 * wiring, neither is visual language, and the barrel ships no equivalent.
 *
 * THE DATA ACCURACY RULES THIS FILE IS WRITTEN TO HOLD (CLAUDE.md section 0):
 *
 *  1. ONE QUERY, ONE TRACE, ONE POPULATION. A ZIP has no market_pulse_live and no
 *     market_stats_cache row (those are keyed by city and region), so every figure on
 *     this page is derived from ONE getZipListings call over active single-family
 *     tiles. The trace under each section describes that query, and no section
 *     borrows another population's figures. The KB page also drew a price-history
 *     chart from the PARENT CITY and relabeled it; that read is deleted rather than
 *     relabeled, because a city trend is a different population from this page's.
 *  2. ABSENT IS NOT ZERO. `tilesRead.ok === false` means the feed did not answer, and
 *     a failed read returns the same empty array a genuinely empty ZIP does. Every
 *     figure is therefore gated on `ok`, including the new-listing count: the KB page
 *     published `New listings last 30 days: 0` into the Dataset JSON-LD on a degraded
 *     read, which is a count of an empty array presented as a fact about the market.
 *     Same rule for the other ZIPs in the closing Ledger: the KB page rendered all
 *     nine as "0 Active" because their cards carried a hardcoded zero, so this page
 *     prints no count beside them at all. It has not queried them.
 *  3. NO STAMP THIS PAGE CANNOT SOURCE. listing_tile_mv gives no refresh timestamp
 *     through this read, so no section claims one. A borrowed clock is worse than
 *     none.
 *  4. NO MONTHS-OF-SUPPLY ANYTHING. There is no closed-sales denominator at ZIP
 *     scope, so there is no verdict, and the threshold sentence never appears. The KB
 *     market HUD printed the full months-of-supply methodology and thresholds in its
 *     footnote on a page whose monthsSupply was null.
 *  5. DAYS ON MARKET IS NOT DAYS TO PENDING. `dom` is how long the homes STILL for
 *     sale have been listed. The homes that sell fast leave the active set, so the
 *     active median runs several times the real median-to-pending (97703 printed
 *     "Pending in 62 days" against a real 15 before ci:days-to-pending-source). The
 *     figure ships under its own label and no other.
 *  6. A DOOR IS PART OF THE FIGURE, AND SO IS AN INSTRUCTION. A count that links
 *     somewhere claims that somewhere holds it, and a note that says "select a
 *     pin" claims a pin. Both are checked here the way a number is: every door
 *     out of a figure goes through `zipSearchHref`, which carries this page's
 *     exact population, and the map note is bound to the plotted set instead of
 *     written unconditionally. The KB page failed both — `?keywords=<zip>` is
 *     free text that resolves to Bend, and the pin instruction rendered in the
 *     same frame that disclaimed an inventory.
 *  7. ONE PRIMARY PER VISIBLE VIEWPORT (PUBLIC_UI.md section 1). The rule counts
 *     VISIBLE filled controls. An earlier version of this file demoted the
 *     Instrument's ask to a ghost on the premise that "the sticky public header
 *     carries a filled valuation CTA at every scroll position." That premise is
 *     false at 390. The header's `a.nav-cta` is display:none below 880px
 *     (components/site/kb/kb.css) and its twin sits in the closed menu overlay, so
 *     the visible header is the wordmark, Search, and Menu. The first viewport
 *     shipped no ask at all on the width most visitors arrive at. The Instrument's
 *     action is therefore FILLED. The page carries its own primary, and the alert
 *     Sheet's submit, four sections down, is never in the same viewport as it.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getZipListings } from '@/lib/data'
import type { ListingTile } from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import type { SchemaInput } from '@/lib/site/json-ld'
import { withTimeoutFallbackResult } from '@/lib/with-timeout-fallback'
import { formatPrice, formatPriceExact } from '@/lib/format/money'
import { homesForSalePath, listingTileHref } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Ledger,
  V3Quiet,
  type V3FieldItem,
  type V3InstrumentFigure,
  type V3LedgerFigureRow,
  type V3LedgerPlainRow,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import { KbSectionTracker } from '@/components/site/kb/KbSectionTracker.client'
import { ZipAlertsSheet } from './_v3/ZipAlertsSheet.client'
import { ZipFieldMap } from './_v3/ZipFieldMap.client'
import {
  CANONICAL_ZIPS,
  ZIP_AREA,
  ZIP_CITY_NAME,
  isFigure,
  median,
  neighborhoodName,
  normalizeZip,
  numeric,
  tileMeta,
  tileTitle,
  zipSearchHref,
} from './_v3/zip-constants'

type Params = { zip: string }

export const dynamicParams = false
export const revalidate = 60

export async function generateStaticParams(): Promise<Array<{ zip: string }>> {
  return Array.from(CANONICAL_ZIPS).map((zip) => ({ zip }))
}

// Metadata, unchanged from the KB page, both branches.
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
  const cityName = ZIP_CITY_NAME[zip] ?? 'Bend'
  const zipPageUrl = `/zip/${zip}`

  // THE ONE READ. It feeds the Instrument, the Field and its map, the neighborhood
  // Ledger, and the Dataset JSON-LD. limit 5000 captures the complete ZIP: no ZIP in
  // this service area is within an order of magnitude of that cap, and per section 0
  // a fetch cap is never reported as if it were the inventory count. No other read
  // happens here, because nothing else on this page renders one.
  const tilesRead = await withTimeoutFallbackResult(
    getZipListings(zip, { status: 'active', propertyType: 'A', limit: 5000 }),
    [] as ListingTile[],
    5000,
    'zip:tiles',
  )

  // Section 0, rule 2. `ok` is the difference between "this ZIP has nothing for sale"
  // and "the feed did not answer", and the two produce the same empty array. Every
  // figure below is null when the read failed, and null renders as no figure rather
  // than as a zero.
  const live = tilesRead.ok
  const tiles = tilesRead.value
  const activeCount: number | null = live ? tiles.length : null

  // The same three medians the KB page computed, over the same filters: a list
  // price and a price per square foot must be above zero to be a figure, and days
  // on market may legitimately be zero on a home listed today.
  const medianListPrice = live ? median(numeric(tiles.map((t) => t.listPrice), 1)) : null
  const medianPricePerSqft = live ? median(numeric(tiles.map((t) => t.pricePerSqft), 1)) : null
  const medianDom = live ? median(numeric(tiles.map((t) => t.dom))) : null

  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000
  const now = Date.now()
  const newLast30Days = live
    ? tiles.filter((t) => {
        if (!t.onMarketDate) return false
        const d = Date.parse(t.onMarketDate)
        return Number.isFinite(d) && now - d >= 0 && now - d <= THIRTY_DAYS_MS
      }).length
    : null

  // THE TRACE, written once and printed under every section that shows a figure,
  // because every one of them reads the same query and the same population. The
  // Instrument, the Field's count, and the neighborhood Ledger cannot describe
  // different data while sharing this line.
  const traceBase =
    `live MLS through Oregon Data Share, every active single-family listing in ZIP ${zip} (${area}). ` +
    'Counts and medians are computed from those active listings, never from closed sales'

  const figures: V3InstrumentFigure[] = []
  if (activeCount != null) {
    figures.push({
      value: v3Text(activeCount.toLocaleString('en-US')),
      label: v3Text('active single-family listings'),
      // The lead figure is the page's loudest claim, so its door is the one that
      // has to answer with the same number. See zipSearchHref.
      href: zipSearchHref(zip),
    })
  }
  if (medianListPrice != null) {
    figures.push({
      value: v3Text(formatPrice(medianListPrice)),
      label: v3Text('median list price'),
    })
  }
  if (medianPricePerSqft != null) {
    figures.push({
      // Whole dollars, not formatPrice: formatPrice rounds to the nearest $1,000
      // (lib/format/money.ts), which is right for a list price and would erase a
      // three-digit price per square foot entirely.
      value: v3Text(formatPriceExact(Math.round(medianPricePerSqft))),
      label: v3Text('median price per sq ft'),
    })
  }
  if (medianDom != null) {
    figures.push({
      // Section 0, rule 5. This is time on market for homes STILL for sale. It is not
      // days to pending and it never carries that label.
      value: v3Text(String(Math.round(medianDom))),
      label: v3Text('median days on market, active listings'),
    })
  }
  if (newLast30Days != null) {
    figures.push({
      value: v3Text(newLast30Days.toLocaleString('en-US')),
      label: v3Text('new in the last 30 days'),
    })
  }
  const [firstFigure, ...restFigures] = figures

  // The Field. Every active tile is a row, and every row is a door, so the list and
  // the count describe the same set. Ordered by price, which is the order the KB
  // featured rail used, so the strongest inventory still leads.
  const fieldItems: V3FieldItem[] = [...tiles]
    .sort((a, b) => (b.listPrice ?? 0) - (a.listPrice ?? 0))
    .map((tile) => ({
      id: tile.listingKey,
      href: listingTileHref(tile),
      priceLabel: formatPrice(tile.listPrice),
      title: tileTitle(tile, `ZIP ${zip}`),
      meta: tileMeta(tile),
      lat: tile.lat,
      lng: tile.lng,
    }))

  // Section 0, rule 2, applied to an INSTRUCTION rather than to a figure. "Select
  // a pin" is a claim that a pin exists, and it was written unconditionally while
  // every figure beside it was gated on the read. On a degraded read `fieldItems`
  // is empty and the map plots nothing, so the same frame disclaimed an inventory
  // in its empty message and told the reader to select a pin in its map note. The
  // note is therefore bound to the PLOTTED set, which is the only set a pin can
  // come from, and the reason a frame is empty is stated once — by `emptyMessage`,
  // which already separates a feed that did not answer from a ZIP with nothing for
  // sale. The middle branch covers the third case the unconditional string also got
  // wrong: listings that exist and report no coordinates.
  const plottedCount = fieldItems.filter((item) => item.lat != null && item.lng != null).length
  const mapNote: string | undefined =
    plottedCount > 0
      ? `Every listing in ${zip} that reports coordinates. Select a pin to open that home.`
      : fieldItems.length > 0
        ? `No active listing in ${zip} reports coordinates, so this map plots nothing.`
        : undefined

  // Neighborhoods, grouped from the same tiles. A group earns a row when it has both
  // a NAME — decided in one place, by neighborhoodName — AND a median list price,
  // because the Ledger's value column is a figure and a figure this page cannot
  // source is a figure it does not print. Top eight by count, as the KB grid showed.
  // `count` is every listing in the group, which is what "for sale" says. `prices`
  // is the subset that published one, which is what the median is of. They are kept
  // apart rather than merged so neither claims the other's population.
  //
  // THE KEY IS THE RAW FEED VALUE AND THE LABEL IS THE NAME. Grouping by the raw
  // value is what keeps a row's door exact: `subdivision=` filters on the string
  // the MLS stored, so a row that merged two feed values would link to a count
  // smaller than the one it prints. The label is only what the row READS as, and
  // it is the reason this section stopped publishing `Crr3_C` as a neighborhood
  // with a median beside it.
  const groups = new Map<string, { label: string; count: number; prices: number[] }>()
  // Listings whose subdivision field holds no spelled name: blank, a masked
  // private value, or a plat code. They are in the ZIP count above; saying so is
  // cheaper than letting a reader add the rows up and find them missing.
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
    .map(([raw, group]) => ({
      raw,
      label: group.label,
      count: group.count,
      med: median(group.prices),
    }))
    .filter(
      (g): g is { raw: string; label: string; count: number; med: number } =>
        g.med != null && g.count > 0,
    )
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8)
  // True only when a row READS differently from the value the feed stored, which
  // on this ZIP set means the Crr abbreviation was written out. The source line
  // says so where it happened and stays silent on the nine ZIPs where it did not.
  const renamed = shownGroups.some((g) => g.label !== g.raw)
  const neighborhoodRows: V3LedgerFigureRow[] = shownGroups
    .map((g) => ({
      // The row prints this group's count and its median, so its door carries
      // the group AND the ZIP. The KB page's `?keywords=<name>` carried neither
      // as a filter: on 97703 it answered 42 under a row that reads 16, because
      // a text match over the whole service area is not this group.
      href: zipSearchHref(zip, g.raw),
      when: v3Text(`${g.count} for sale`),
      what: v3Text(g.label),
      value: v3Text(formatPrice(g.med)),
      id: g.raw,
    }))
  const [firstNeighborhood, ...restNeighborhoods] = neighborhoodRows

  // The closing edges. The parent city's inventory page (the KB featured rail's
  // "see every home" link) and the other nine canonical ZIPs, in the order the KB
  // page listed them. No counts: this page has not queried those places, and a
  // hardcoded zero under a live-MLS heading is the defect rule 2 names.
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

  // JSON-LD. BreadcrumbList + Place + Dataset, from MetadataBlock, exactly as the KB
  // page emitted them. The Dataset's five variables are the same five, in the same
  // order, with the same names and unitText, computed the same way. The only change
  // is rule 2: a degraded read now publishes no variable at all rather than a zero.
  type StatValue = { name: string; value: string | number; unitText?: string }
  const datasetStats: StatValue[] = []
  if (activeCount != null) {
    datasetStats.push({ name: 'Active single-family listings', value: activeCount, unitText: 'listings' })
  }
  if (medianListPrice != null) {
    datasetStats.push({ name: 'Median list price', value: medianListPrice, unitText: 'USD' })
  }
  if (medianPricePerSqft != null) {
    datasetStats.push({ name: 'Median price per sq ft', value: Math.round(medianPricePerSqft), unitText: 'USD' })
  }
  if (medianDom != null) {
    datasetStats.push({ name: 'Median days on market', value: Math.round(medianDom), unitText: 'days' })
  }
  if (newLast30Days != null) {
    datasetStats.push({ name: 'New listings last 30 days', value: newLast30Days, unitText: 'listings' })
  }

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
      name: `Active single-family market snapshot for ZIP ${zip}`,
      description: `Live market statistics for active SFR listings in ${zip}, ${area}, Central Oregon. Derived from the Oregon RMLS feed via Ryan Realty.`,
      url: zipPageUrl,
      spatialCoverageName: `ZIP ${zip} · ${area}`,
      variableMeasured: datasetStats,
    },
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <MetadataBlock schemas={schemas} />

        <KbSectionTracker pageType="zip" />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Homes for sale', href: '/homes-for-sale' },
            { label: zip },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="market"
            level={1}
            eyebrow={v3Text(`${zip} · ${area} · Oregon`)}
            // The head term this page ranks for, and the subject of the node. The
            // count sits under it as the lead figure rather than inside it, so the
            // H1 is the same string whatever the market did overnight.
            headline={v3Text(`Homes for sale in ${zip}`)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(traceBase)}
            // FILLED, by rule 7. This is the page's own ask, in the page's own
            // first viewport, and it is built by the one helper that carries
            // `?from=` (lib/site/valuation-href.ts) rather than by a string
            // assembled here. An inline convention is invisible to whoever
            // rewrites the section next, which is how four routes dropped the
            // parameter at once (migration-recipe.md, 2026-08-11 addendum 1).
            //
            // WHAT `from` REACHES TODAY, stated because a link is a claim: the
            // helper's destination is VALUATION_FORM.href, `/sell#get-value`,
            // and app/sell/page.tsx hands its form a hardcoded
            // `pagePath={ROUTE_PATH}`, so `?from=` arrives and is not read there.
            // The written-valuation surface `/sell/valuation` IS the one that
            // reads it (app/home-valuation/actions.ts resolves source_url from
            // the referer's `from`). Closing that is one line on the /sell route
            // and it fixes every migrated page at once, which is the reason this
            // link goes through the shared helper instead of naming a
            // destination of its own.
            action={{
              label: v3Text('Get a written valuation'),
              href: valuationHref(zipPageUrl),
            }}
          />
        ) : (
          <V3Quiet
            id="market"
            heading={`Homes for sale in ${zip}`}
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'No live figures right now',
                body: `The listing feed did not answer on this refresh, so this page is not printing an inventory count, a median, or a neighborhood breakdown for ${zip}. The other ZIP codes below carry their own live reads.`,
              },
            ]}
          />
        )}

        <V3Field
          id="homes"
          ariaLabel={`Active single-family listings in ${zip}`}
          items={fieldItems}
          // The real Google map, in the slot the pattern reserves for it. It reads
          // the same items this list renders, through the Field's own binding, so a
          // pin and a row cannot disagree about what is for sale.
          mapSlot={<ZipFieldMap />}
          count={
            activeCount != null
              ? {
                  value: activeCount.toLocaleString('en-US'),
                  label: 'active single-family listings',
                  source: traceBase,
                }
              : undefined
          }
          mapNote={mapNote}
          emptyMessage={
            live
              ? `No active single-family listings in ${zip} right now.`
              : 'The listing feed did not answer on this refresh, so this frame is not claiming an inventory.'
          }
        />

        {firstNeighborhood ? (
          <V3Ledger
            id="neighborhoods"
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
              `${traceBase}, grouped by the subdivision name on each listing. The value column is that group's median list price` +
                (renamed
                  ? '. The feed writes Crooked River Ranch as Crr, so the rows print the community name and the links carry the feed value'
                  : ''),
            )}
            action={{ label: v3Text(`All homes in ${zip}`), href: zipSearchHref(zip) }}
          />
        ) : (
          <V3Ledger
            id="neighborhoods"
            eyebrow={v3Text(`${zip} · Neighborhoods`)}
            heading={v3Text('Neighborhoods in this ZIP')}
            rows={[]}
            emptyMessage={v3Text(
              live
                ? `No active listing in ${zip} names a neighborhood the MLS records by name.`
                : 'The listing feed did not answer on this refresh, so this page is not grouping neighborhoods.',
            )}
          />
        )}

        <ZipAlertsSheet zip={zip} area={area} city={cityName} />

        {firstNearby ? (
          <V3Ledger
            id="nearby"
            eyebrow={v3Text('Central Oregon')}
            heading={v3Text('Homes for sale nearby')}
            note={v3Text(
              'The rest of the service area. Each ZIP page carries its own live inventory.',
            )}
            rows={[firstNearby, ...restNearby]}
            action={{ label: v3Text('Open map search'), href: '/search' }}
          />
        ) : null}
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
