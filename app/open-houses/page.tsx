/**
 * /open-houses - this week's open houses, on the components/site/v3 barrel.
 *
 * VISUAL LANGUAGE: design_system/public/PUBLIC_UI.md. Homes curated mode.
 * Rhythm: four of six, no two adjacent alike. Order is Breadcrumb, Instrument
 * level 1, Field, Sheet, Quiet, Footer.
 *
 * THE PAGE CONTRACT, carried across unchanged: generateMetadata through
 * pageMetadata, MetadataBlock JSON-LD (BreadcrumbList + Event nodes), a rendered
 * V3SectionTracker with pageType="open-houses", TrackSearchView, revalidate 60,
 * the route, and searchParam filters. MetadataBlock stays on the legacy
 * register (JSON-LD). V3SectionTracker is a v3 island, not a seventh pattern.
 *
 * WINDOW: today through six days out, Pacific, unless the visitor passes
 * dateFrom/dateTo. The KB page said "this week" while getOpenHousesWithListings
 * defaulted to Sat-Sun. The copy and the query now name the same window.
 *
 * DATES RENDER IN PACIFIC. The KB when-label used timeZone UTC.
 *
 * ONE PRIMARY PER VIEWPORT, counting visible filled controls. At 390 the
 * chrome CTA sits in the collapsed menu, so the Instrument ask is primary.
 * Label is Value my home (D11). valuationHref carries ?from=.
 *
 * KB-era deletions: KbHero (search + voice), KbOpenHouses 12-tile cap, KbListingMap,
 * KbCommunityAlerts markup (capture contract kept on the Sheet), KbSell, KbFooter,
 * SmoothScrollProvider, region pulse read that rendered only on KbSell.
 */

import type { Metadata } from 'next'
import {
  getUpcomingOpenHouses,
  getListingTiles,
  getHeroPhotosByListingKeys,
} from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { listingsBrowsePath } from '@/lib/slug'
import { valuationHref } from '@/lib/site/valuation-href'
import { formatPrice } from '@/lib/format/money'
import type { SchemaInput } from '@/lib/site/json-ld'
import {
  V3_ROOT_CLASS,
  v3Text,
  V3Breadcrumb,
  V3Field,
  V3Footer,
  V3_FOOTER_COLUMNS,
  V3Instrument,
  V3Quiet,
  V3SectionTracker,
  type V3InstrumentFigure,
  type V3QuietItem,
} from '@/components/site/v3'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import TrackSearchView from '@/components/tracking/TrackSearchView'
import { OpenHouseAlertsSheet } from './_v3/OpenHouseAlertsSheet.client'
import {
  OH_CITY_SLUGS,
  OH_FIELD_TRACE,
  OH_TRACE,
  addIsoDays,
  cityLabel,
  pacificTodayIso,
} from './_v3/oh-constants'
import { assembleOpenHouses, medianPositive } from './_v3/oh-listings'
import { openHouseFieldItems } from './_v3/oh-field-items'
import { openHouseEventSchemas } from './_v3/oh-jsonld'

export const revalidate = 60

export async function generateMetadata(): Promise<Metadata> {
  return pageMetadata({
    title: 'Open Houses in Central Oregon',
    description:
      "This week's open houses in Bend, Redmond, Sisters, La Pine, and across Central Oregon. Times, addresses, and prices from the regional MLS.",
    path: '/open-houses',
  })
}

type SearchParams = {
  dateFrom?: string
  dateTo?: string
  community?: string
  city?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
}

export default async function OpenHousesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const sp = await searchParams
  const todayIso = pacificTodayIso()
  const dateFrom = sp.dateFrom?.trim() || todayIso
  const dateTo = sp.dateTo?.trim() || addIsoDays(todayIso, 6)
  const cityFilter = sp.city?.trim()
  const community = sp.community
    ? sp.community.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined
  const minPrice = sp.minPrice ? Number(sp.minPrice) : undefined
  const maxPrice = sp.maxPrice ? Number(sp.maxPrice) : undefined
  const beds = sp.beds ? Number(sp.beds) : undefined
  const baths = sp.baths ? Number(sp.baths) : undefined

  const rows = await getUpcomingOpenHouses({
    dateFromIso: dateFrom,
    dateToIso: dateTo,
    todayIso,
    city: cityFilter,
  })
  const listingKeys = [...new Set(rows.map((r) => r.listing_key))]
  const [tiles, heroes] =
    listingKeys.length > 0
      ? await Promise.all([
          getListingTiles({ listingKeys: listingKeys.slice(0, 5000), status: 'all', limit: 500 }),
          getHeroPhotosByListingKeys(listingKeys),
        ])
      : [[], new Map<string, string>()]

  const openHouses = assembleOpenHouses(rows, tiles, heroes, {
    community,
    city: cityFilter,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    beds: Number.isFinite(beds) ? beds : undefined,
    baths: Number.isFinite(baths) ? baths : undefined,
  })

  const count = openHouses.length
  const fieldItems = openHouseFieldItems(openHouses)
  const medianList = medianPositive(openHouses.map((oh) => oh.listPrice))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')

  const figures: V3InstrumentFigure[] = []
  if (count > 0) {
    figures.push({
      value: v3Text(count.toLocaleString('en-US')),
      label: v3Text(count === 1 ? 'open house this week' : 'open houses this week'),
      href: '#calendar',
    })
  }
  if (medianList != null) {
    figures.push({
      value: v3Text(formatPrice(medianList)),
      label: v3Text('median list price on this calendar'),
      href: '#calendar',
    })
  }
  const [firstFigure, ...restFigures] = figures

  const schemas: SchemaInput[] = [
    {
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Open houses', url: '/open-houses' },
      ],
    },
    ...openHouseEventSchemas(openHouses, siteUrl),
  ]

  const cityItems: V3QuietItem[] = OH_CITY_SLUGS.map((slug) => ({
    label: cityLabel(slug),
    href: `/open-houses/${slug}`,
  }))

  const edgeItems: V3QuietItem[] = [
    { kind: 'prose', term: 'The window', body: 'Today through six days out, Pacific, unless you pass dates on the URL. One soonest open house per listing. Builder spec and model homes stay off this list.' },
    { label: 'All Central Oregon homes for sale', href: listingsBrowsePath() },
    { label: 'Price drops this week', href: '/price-drops' },
    ...cityItems,
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="open-houses" />
        <TrackSearchView resultsCount={count} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb trail={[{ label: 'Home', href: '/' }, { label: 'Open houses' }]} />

        {firstFigure ? (
          <V3Instrument
            id="answer"
            level={1}
            eyebrow={v3Text('Central Oregon · this week')}
            headline={v3Text('Open houses in Central Oregon')}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(OH_TRACE)}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref('/open-houses'),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="answer"
            heading="Open houses in Central Oregon"
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: 'Nothing on the calendar this week',
                body: 'No upcoming open house landed in the live MLS OpenHouses field for the Central Oregon service area in this window. The homes-for-sale list is still live.',
              },
              { label: 'All Central Oregon homes for sale', href: listingsBrowsePath() },
            ]}
          />
        )}

        <V3Field
          id="calendar"
          ariaLabel="Open houses on the calendar this week"
          items={fieldItems}
          count={
            fieldItems.length > 0
              ? {
                  value: fieldItems.length.toLocaleString('en-US'),
                  label: fieldItems.length === 1 ? 'home on this list' : 'homes on this list',
                  source: OH_FIELD_TRACE,
                }
              : undefined
          }
          emptyMessage="No open house on this pull has both a street and a list price, so this list has nothing to name."
        />

        <OpenHouseAlertsSheet
          placeLabel="Central Oregon"
          city=""
          extraFilters={{ propertyType: 'A' }}
        />

        <V3Quiet id="edges" heading="Keep looking" items={edgeItems} />
      </main>

      {/* Outside <main> on purpose. HTML-AAM maps <footer> to role=contentinfo only
          when it is NOT nested in sectioning content, and <main> is sectioning
          content, so inside it the element is a generic and the page ships no
          contentinfo landmark. ci:default-chrome-footer counts footers without
          checking placement. */}
      <V3Footer columns={V3_FOOTER_COLUMNS} />
    </>
  )
}
