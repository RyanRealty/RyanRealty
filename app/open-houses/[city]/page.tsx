/**
 * /open-houses/[city] - city-scoped open houses, on the v3 barrel.
 *
 * Same contract as the region page. generateMetadata title still leads with
 * "Open Houses in". dynamicParams stays true so a real city slug that is not
 * in SITE_CITY_SLUGS still resolves through getCityFromSlug.
 *
 * KB-era deletions: KbHero, KbOpenHouses, KbListingMap, KbCommunityAlerts markup,
 * KbSell, KbFooter, SmoothScrollProvider. Capture contract kept on the Sheet.
 */

import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getCityFromSlug } from '@/app/actions/listings'
import {
  getUpcomingOpenHouses,
  getListingTiles,
  getHeroPhotosByListingKeys,
} from '@/lib/data'
import { pageMetadata } from '@/lib/site/page-metadata'
import { homesForSalePath } from '@/lib/slug'
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
import { OpenHouseAlertsSheet } from '../_v3/OpenHouseAlertsSheet.client'
import {
  OH_CITY_SLUGS,
  OH_FIELD_TRACE,
  OH_TRACE,
  addIsoDays,
  cityLabel,
  pacificTodayIso,
} from '../_v3/oh-constants'
import { assembleOpenHouses, medianPositive } from '../_v3/oh-listings'
import { openHouseFieldItems } from '../_v3/oh-field-items'
import { openHouseEventSchemas } from '../_v3/oh-jsonld'

export const dynamicParams = true
export const revalidate = 60

export function generateStaticParams(): Array<{ city: string }> {
  return OH_CITY_SLUGS.map((slug) => ({ city: slug }))
}

type Props = { params: Promise<{ city: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { city: citySlug } = await params
  const cityName = await getCityFromSlug(citySlug)
  if (!cityName) {
    return pageMetadata({
      title: 'Open Houses in Central Oregon',
      description: "This week's open houses across Central Oregon.",
      path: `/open-houses/${citySlug}`,
    })
  }
  return pageMetadata({
    title: `Open Houses in ${cityName}, Oregon`,
    description: `This week's open houses in ${cityName}, Oregon. Times, addresses, and prices from the regional MLS.`,
    path: `/open-houses/${citySlug}`,
  })
}

type SearchParams = {
  dateFrom?: string
  dateTo?: string
  community?: string
  minPrice?: string
  maxPrice?: string
  beds?: string
  baths?: string
}

export default async function OpenHousesCityPage({
  params,
  searchParams,
}: {
  params: Promise<{ city: string }>
  searchParams: Promise<SearchParams>
}) {
  const { city: citySlug } = await params
  const cityName = await getCityFromSlug(citySlug)
  if (!cityName) notFound()

  const sp = await searchParams
  const todayIso = pacificTodayIso()
  const dateFrom = sp.dateFrom?.trim() || todayIso
  const dateTo = sp.dateTo?.trim() || addIsoDays(todayIso, 6)
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
    city: cityName,
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
    city: cityName,
    minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
    maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    beds: Number.isFinite(beds) ? beds : undefined,
    baths: Number.isFinite(baths) ? baths : undefined,
  })

  const count = openHouses.length
  const fieldItems = openHouseFieldItems(openHouses)
  const medianList = medianPositive(openHouses.map((oh) => oh.listPrice))
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://ryan-realty.com').replace(/\/$/, '')
  const path = `/open-houses/${citySlug}`

  const figures: V3InstrumentFigure[] = []
  if (count > 0) {
    figures.push({
      value: v3Text(count.toLocaleString('en-US')),
      label: v3Text(count === 1 ? `open house in ${cityName}` : `open houses in ${cityName}`),
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
        { name: cityName, url: path },
      ],
    },
    ...openHouseEventSchemas(openHouses, siteUrl),
  ]

  const siblingItems: V3QuietItem[] = OH_CITY_SLUGS.filter((slug) => slug !== citySlug).map((slug) => ({
    label: cityLabel(slug),
    href: `/open-houses/${slug}`,
  }))

  const edgeItems: V3QuietItem[] = [
    { kind: 'prose', term: 'The window', body: `Today through six days out, Pacific. Open houses with a ${cityName} address. One soonest open house per listing.` },
    { label: 'All Central Oregon open houses', href: '/open-houses' },
    { label: `Homes for sale in ${cityName}`, href: homesForSalePath(cityName) },
    { label: `Price drops in ${cityName}`, href: `/price-drops/${citySlug}` },
    ...siblingItems,
  ]

  return (
    <>
      <main className={V3_ROOT_CLASS}>
        <V3SectionTracker pageType="open-houses-city" />
        <TrackSearchView city={cityName} resultsCount={count} />
        <MetadataBlock schemas={schemas} />

        <V3Breadcrumb
          trail={[
            { label: 'Home', href: '/' },
            { label: 'Open houses', href: '/open-houses' },
            { label: cityName },
          ]}
        />

        {firstFigure ? (
          <V3Instrument
            id="answer"
            level={1}
            eyebrow={v3Text(`${cityName} · this week`)}
            headline={v3Text(`Open houses in ${cityName}`)}
            figures={[firstFigure, ...restFigures]}
            source={v3Text(OH_TRACE)}
            action={{
              label: v3Text('Value my home'),
              href: valuationHref(path),
              variant: 'primary',
            }}
          />
        ) : (
          <V3Quiet
            id="answer"
            heading={`Open houses in ${cityName}`}
            headingLevel={1}
            items={[
              {
                kind: 'prose',
                term: `Nothing on the calendar in ${cityName} this week`,
                body: `No upcoming open house landed in the live MLS OpenHouses field for ${cityName} in this window.`,
              },
              { label: 'All Central Oregon open houses', href: '/open-houses' },
            ]}
          />
        )}

        <V3Field
          id="calendar"
          ariaLabel={`Open houses in ${cityName} this week`}
          items={fieldItems}
          count={
            fieldItems.length > 0
              ? {
                  value: fieldItems.length.toLocaleString('en-US'),
                  label: fieldItems.length === 1 ? `home in ${cityName}` : `homes in ${cityName}`,
                  source: OH_FIELD_TRACE,
                }
              : undefined
          }
          emptyMessage={`No open house in ${cityName} on this pull has both a street and a list price, so this list has nothing to name.`}
        />

        <OpenHouseAlertsSheet placeLabel={cityName} city={cityName} />

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
