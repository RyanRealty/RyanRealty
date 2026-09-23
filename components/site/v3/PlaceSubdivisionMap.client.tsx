'use client'

/**
 * One map for a community or a neighborhood.
 *
 * The subdivisions sit to the left of the map, no taller than the map.
 * Choosing one zooms the map to that recorded shape and the carousel below
 * shows every publicly active home inside it. The place name at the top of
 * the list shows every home in the place.
 */
import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/format/count'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { SparkSafeImage } from '@/lib/listing/SparkSafeImage'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import type { SubdivisionRailEntry } from '@/lib/place/place-child-stock'
import { firstListedPhoto } from '@/lib/place/rail-photo'
import { V3_ROOT_CLASS, V3Heading } from './atoms'
import { V3Atlas, type V3AtlasProps } from './V3Atlas.client'
import { V3Carousel } from './V3Carousel.client'
import { V3ListingDial } from './V3ListingDial.client'
import { listingPhotoAlt } from './listing-photo-alt'
import type { V3ListingRowData } from './V3ListingRow'
import { V3SourceLine } from './V3SourceLine'
import {
  PLACE_BUYER_GROUP_HEADING,
  PLACE_BUYER_GROUPS,
  placeBuyerGroup,
  type PlaceBuyerGroup,
} from '@/lib/place/place-type-style'
import './tokens.css'
import './PlaceSubdivisionMap.css'

type PlaceMapState = {
  placeName: string
  rail: readonly SubdivisionRailEntry[]
  homes: readonly V3ListingRowData[]
  keysBySlug: Readonly<Record<string, readonly string[]>>
  source: string
  asOf: string | null
  selectedId: string | null
  setSelected: (id: string | null) => void
}

const PlaceMapContext = createContext<PlaceMapState | null>(null)

function usePlaceMap(): PlaceMapState {
  const value = useContext(PlaceMapContext)
  if (!value) throw new Error('Place subdivision map pieces must render inside PlaceSubdivisionMap')
  return value
}

export function PlaceSubdivisionMap({
  placeName,
  rail,
  homes,
  keysBySlug,
  source,
  asOf = null,
  children,
}: {
  placeName: string
  rail: readonly SubdivisionRailEntry[]
  homes: readonly V3ListingRowData[]
  keysBySlug: Readonly<Record<string, readonly string[]>>
  source: string
  asOf?: string | null
  children: ReactNode
}) {
  const [selectedId, setSelected] = useState<string | null>(null)
  const value = useMemo(
    () => ({ placeName, rail, homes, keysBySlug, source, asOf, selectedId, setSelected }),
    [placeName, rail, homes, keysBySlug, source, asOf, selectedId],
  )
  return <PlaceMapContext.Provider value={value}>{children}</PlaceMapContext.Provider>
}

export function PlaceSubdivisionRail({
  id,
  nameOnly = true,
  label,
}: {
  id: string
  /** Name and property-type line. No sales bar. */
  nameOnly?: boolean
  /** Accessible name for the list. Defaults to "{place} subdivisions". */
  label?: string
}) {
  const { placeName, rail, homes, keysBySlug, selectedId, setSelected } = usePlaceMap()
  const detailBase = useId()
  return (
    <nav
      id={id}
      className={cn('place-subdiv-rail', nameOnly && 'place-subdiv-rail--names')}
      aria-label={label ?? `${placeName} subdivisions`}
    >
      <ul className="place-subdiv-rail__list">
        <li>
          <button
            type="button"
            className={cn('place-subdiv-rail__button', selectedId == null && 'is-selected')}
            aria-pressed={selectedId == null}
            onClick={() => setSelected(null)}
          >
            <span className="place-subdiv-rail__copy">
              <span className="place-subdiv-rail__name">{placeName}</span>
            </span>
          </button>
        </li>
        {rail.map((entry) => {
          const photo = firstListedPhoto(homes, keysBySlug[entry.id])
          return (
            <li key={entry.id} className={cn(entry.href && 'place-subdiv-rail__item--linked')}>
              <button
                type="button"
                className={cn('place-subdiv-rail__button', selectedId === entry.id && 'is-selected')}
                aria-pressed={selectedId === entry.id}
                /* The button's name is the place's name, exactly as the map
                   polygon's: that is how WCAG 2.5.8 Equivalent pairs a small
                   polygon with this full-size control. With the detail line in
                   the name, /cities/bend "Old Bend" (39x31 on the map) had no
                   partner and failed ci:tap-targets (visibility audit
                   2026-09-22, PR #352). The detail stays as a description. */
                aria-label={entry.name}
                aria-describedby={nameOnly && entry.detail ? `${detailBase}-${entry.id}` : undefined}
                onClick={() => setSelected(entry.id)}
              >
                {photo ? (
                  <span className="place-subdiv-rail__photo">
                    <SparkSafeImage
                      src={listingRowPhotoSrc(photo)}
                      alt=""
                      fill
                      sizes="96px"
                    />
                  </span>
                ) : null}
                <span className="place-subdiv-rail__copy">
                  <span className="place-subdiv-rail__name">{entry.name}</span>
                  {nameOnly && entry.detail ? (
                    <span id={`${detailBase}-${entry.id}`} className="place-subdiv-rail__detail">
                      {entry.detail}
                    </span>
                  ) : null}
                </span>
              </button>
              {/* THE DOOR (visibility audit 2026-09-22, EXP-3). The row's button
                  selects the place on the map; this anchor opens the place's
                  own page, and it is a real <a href> in the served HTML, which
                  the button can never be. The name is the anchor text. */}
              {entry.href ? (
                <Link className="place-subdiv-rail__open" href={entry.href}>
                  <span className="place-subdiv-rail__open-label">{`${entry.name} page`}</span>
                  <span aria-hidden="true">›</span>
                </Link>
              ) : null}
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

export function PlaceSubdivisionAtlas(props: V3AtlasProps) {
  const { selectedId, setSelected, keysBySlug } = usePlaceMap()
  return (
    <V3Atlas
      {...props}
      selectedSubdivisionId={selectedId}
      onSubdivisionSelect={setSelected}
      /* Matt 2026-09-23: the SAME membership PlaceSubdivisionHomes filters
         its carousel by (childListingKeys), so the map's focused homes and
         the carousel below it can never disagree about who belongs to the
         selected district. */
      memberKeysBySlug={keysBySlug}
    />
  )
}

function homeMeta(listing: V3ListingRowData): string {
  const parts: string[] = []
  if (listing.beds != null) parts.push(`${Math.round(listing.beds).toLocaleString('en-US')} bd`)
  if (listing.baths != null) parts.push(`${Math.round(listing.baths).toLocaleString('en-US')} ba`)
  if (listing.sqft != null) parts.push(`${Math.round(listing.sqft).toLocaleString('en-US')} sqft`)
  return parts.join(' · ')
}

function PlaceHomeCard({ listing }: { listing: V3ListingRowData }) {
  const ask = formatPublishedSaleAsk({
    price: listing.price,
    propertyType: listing.propertyType,
  })
  const share = publishListingShareKind({
    propertySubType: listing.propertySubType,
    subdivisionName: listing.subdivisionName,
    city: listing.city,
    listNumber: listing.listNumber,
  })
  const meta = homeMeta(listing)
  return (
    <Link href={listing.href} className="place-home-card">
      <span className="place-home-card__media">
        {listing.photoUrl ? (
          <SparkSafeImage
            src={listingRowPhotoSrc(listing.photoUrl, LISTING_FIELD_LEAD_PHOTO_SIZE)}
            alt={listingPhotoAlt(listing)}
            fill
            sizes="(max-width: 48rem) 100vw, 280px"
          />
        ) : null}
      </span>
      {ask ? <span className="place-home-card__price">{ask}</span> : null}
      {share ? <span className="place-home-card__share">{share}</span> : null}
      <span className="place-home-card__addr">{listing.addressLine}</span>
      {meta ? <span className="place-home-card__meta">{meta}</span> : null}
    </Link>
  )
}

function homesByBuyerGroup(listings: readonly V3ListingRowData[]): Array<{
  key: PlaceBuyerGroup
  heading: string
  rows: V3ListingRowData[]
}> {
  const buckets: Record<PlaceBuyerGroup, V3ListingRowData[]> = {
    homes: [],
    cabins: [],
    attached: [],
    multifamily: [],
    lots: [],
    other: [],
  }
  for (const listing of listings) {
    buckets[placeBuyerGroup(listing.propertyType, listing.propertySubType)].push(listing)
  }
  return PLACE_BUYER_GROUPS.flatMap((key) => {
    const rows = buckets[key]
    if (rows.length === 0) return []
    return [{ key, heading: PLACE_BUYER_GROUP_HEADING[key], rows }]
  })
}

/**
 * `layout="dial"` (Matt 2026-09-23, neighborhood pages): each buyer group is a
 * V3ListingDial instead of a carousel. The map still decides what is in it:
 * choosing a subdivision re-keys every dial, so it opens on the first home of
 * the new selection with the readout counting that selection.
 */
export function PlaceSubdivisionHomes({
  id,
  layout = 'rails',
}: {
  id: string
  layout?: 'rails' | 'dial'
}) {
  const { placeName, rail, homes, keysBySlug, source, asOf, selectedId } = usePlaceMap()
  const selected = rail.find((entry) => entry.id === selectedId) ?? null
  const title = selected?.name ?? placeName
  const visible = useMemo(() => {
    if (!selectedId) return homes
    const keys = new Set(keysBySlug[selectedId] ?? [])
    return homes.filter((home) => keys.has(home.listingKey))
  }, [homes, keysBySlug, selectedId])
  const typeSections = useMemo(() => homesByBuyerGroup(visible), [visible])
  const countLabel = visible.length > 0 ? `${formatCount(visible.length)} for sale` : null
  const typed = typeSections.length > 1
  const dialKey = selectedId ?? 'all'

  return (
    <section
      id={id}
      className={cn(V3_ROOT_CLASS, 'place-homes', layout === 'dial' && 'place-homes--dial')}
      aria-labelledby={`${id}-heading`}
    >
      <V3Heading level={2} size="field" id={`${id}-heading`}>
        {title}
      </V3Heading>
      {countLabel ? <p className="place-homes__count">{countLabel}</p> : null}
      {visible.length > 0 && layout === 'dial' ? (
        typed ? (
          typeSections.map((section) => (
            <V3ListingDial
              key={`${dialKey}-${section.key}`}
              id={`${id}-${section.key}`}
              className="place-homes__dial"
              heading={section.heading}
              headingLevel={3}
              countLabel={`${formatCount(section.rows.length)} for sale`}
              label={`${section.heading} in ${title}`}
              listings={section.rows}
            />
          ))
        ) : (
          <V3ListingDial
            key={dialKey}
            id={`${id}-all`}
            className="place-homes__dial"
            label={`Homes in ${title}`}
            listings={visible}
          />
        )
      ) : visible.length > 0 ? (
        typed ? (
          typeSections.map((section) => (
            <div key={section.key} id={`${id}-${section.key}`} className="place-homes__type">
              <p className="place-homes__type-heading" id={`${id}-${section.key}-heading`}>
                {section.heading}
              </p>
              <p className="place-homes__type-count">{`${formatCount(section.rows.length)} for sale`}</p>
              <V3Carousel mode="rail" label={`${section.heading} in ${title}`}>
                {section.rows.map((listing) => (
                  <PlaceHomeCard key={listing.listingKey} listing={listing} />
                ))}
              </V3Carousel>
            </div>
          ))
        ) : (
          <V3Carousel mode="rail" label={`Homes in ${title}`}>
            {visible.map((listing) => (
              <PlaceHomeCard key={listing.listingKey} listing={listing} />
            ))}
          </V3Carousel>
        )
      ) : (
        <p className="place-homes__empty">Nothing listed in {title} right now.</p>
      )}
      <V3SourceLine source={source} asOf={asOf} sourceName="Oregon Data Share" />
    </section>
  )
}
