'use client'

/**
 * One map for a city, a community or a neighborhood.
 *
 * The subdivisions sit to the left of the map, no taller than the map.
 * Choosing one zooms the map to that recorded shape and the listing dials
 * below it hold every publicly active home inside it. The place name at the
 * top of the list shows every home in the place.
 *
 * Commercial leases (MLS 'G') are never in `homes`: a lease is not for sale,
 * so it is not counted "for sale" and it is not a pin. They arrive as their
 * own `leases` list and PlaceSubdivisionHomes shows them last, under
 * "Commercial space for lease", filtered by the same map selection.
 *
 * `layout="rails"` HOLDS THE CAROUSEL (Matt 2026-09-25, "fix first, then
 * ship"): the map block exactly as it shipped before the listing dial, one
 * card carousel per buyer group and a rail of names with no count bars. A
 * page passes it while its class is below its taste mark with the dial
 * (/communities/[slug]); the default is the dial.
 */
import { createContext, useContext, useId, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/format/count'
import { formatPublishedSaleAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'
import { publishListingLeaseFigure } from '@/lib/listing/publish-lease-rate'
import { placeHomesCountLabel } from '@/lib/place/place-count-label'
import {
  COMMERCIAL_LEASE_ALL_LABEL,
  COMMERCIAL_LEASE_PATH,
  PLACE_LEASE_HEADING,
} from '@/lib/place/place-lease-heading'
import { SparkSafeImage } from '@/lib/listing/SparkSafeImage'
import { LISTING_FIELD_LEAD_PHOTO_SIZE, listingRowPhotoSrc } from '@/lib/listing/row-photo'
import type { SubdivisionRailEntry } from '@/lib/place/place-child-stock'
import { firstListedPhoto } from '@/lib/place/rail-photo'
import { V3_ROOT_CLASS, V3Button, V3Heading } from './atoms'
import { V3Atlas, type V3AtlasProps } from './V3Atlas.client'
import { V3Carousel } from './V3Carousel.client'
import { V3ListingDial } from './V3ListingDial.client'
import { dialRailPositionAt } from './V3ListingDial.logic'
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

/** 'dial' (default): the listing dials. 'rails': the held carousel (see the header). */
export type PlaceSubdivisionMapLayout = 'dial' | 'rails'

type PlaceMapState = {
  layout: PlaceSubdivisionMapLayout
  placeName: string
  rail: readonly SubdivisionRailEntry[]
  homes: readonly V3ListingRowData[]
  /** Commercial leases in the place, apart from `homes` (never for sale). */
  leases: readonly V3ListingRowData[]
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

const NO_LEASES: readonly V3ListingRowData[] = []

export function PlaceSubdivisionMap({
  placeName,
  rail,
  homes,
  leases = NO_LEASES,
  keysBySlug,
  source,
  asOf = null,
  layout = 'dial',
  children,
}: {
  placeName: string
  rail: readonly SubdivisionRailEntry[]
  homes: readonly V3ListingRowData[]
  /** Commercial leases (placeLeaseSectionFromTiles rows). Shown last, never counted for sale. */
  leases?: readonly V3ListingRowData[]
  keysBySlug: Readonly<Record<string, readonly string[]>>
  source: string
  asOf?: string | null
  /** 'rails' holds the carousel-era map block (header); omit for the dial. */
  layout?: PlaceSubdivisionMapLayout
  children: ReactNode
}) {
  const [selectedId, setSelected] = useState<string | null>(null)
  const value = useMemo(
    () => ({ layout, placeName, rail, homes, leases, keysBySlug, source, asOf, selectedId, setSelected }),
    [layout, placeName, rail, homes, leases, keysBySlug, source, asOf, selectedId],
  )
  return <PlaceMapContext.Provider value={value}>{children}</PlaceMapContext.Provider>
}

/** Rows the rail shows before "Show all" (Matt 2026-10-04). Exported for tests. */
export const RAIL_FOLD_AT = 10

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
  const { layout, placeName, rail, homes, keysBySlug, selectedId, setSelected } = usePlaceMap()
  // The held carousel layout keeps the rail it shipped with: names, no bars.
  const bars = layout !== 'rails'
  const railMost = Math.max(1, ...rail.map((entry) => keysBySlug[entry.id]?.length ?? 0))
  const detailBase = useId()
  const listId = useId()
  // Matt 2026-10-04: the Sunriver rail ran 7,759px down the desktop fold and
  // pushed the homes several screens away. Past RAIL_FOLD_AT the rows stay in
  // the served HTML (every place name and its page link is still crawlable)
  // but carry `hidden` until "Show all" opens them. A row the map selected
  // always shows, so a polygon click never selects an invisible row.
  const [railOpen, setRailOpen] = useState(false)
  const folds = rail.length > RAIL_FOLD_AT
  return (
    <nav
      id={id}
      className={cn(
        'place-subdiv-rail',
        nameOnly && 'place-subdiv-rail--names',
        !bars && 'place-subdiv-rail--held',
      )}
      aria-label={label ?? `${placeName} subdivisions`}
    >
      {bars && railMost > 1 ? (
        // The key to the rows' bars, so the mark reads as a count.
        <p className="place-subdiv-rail__key">
          <span className="place-subdiv-rail__key-mark" aria-hidden="true" />
          Bar: homes for sale in each, on one scale
        </p>
      ) : null}
      <ul id={listId} className="place-subdiv-rail__list">
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
        {rail.map((entry, index) => {
          const photo = firstListedPhoto(homes, keysBySlug[entry.id])
          const listed = keysBySlug[entry.id]?.length ?? 0
          const folded = folds && !railOpen && index >= RAIL_FOLD_AT && selectedId !== entry.id
          return (
            <li key={entry.id} hidden={folded} className={cn(entry.href && 'place-subdiv-rail__item--linked')}>
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
                  {/* How many of the map's homes are in this place, as a bar
                      on one scale down the rail (2026-09-25: a column of names
                      and captions with nothing to compare). The figure is the
                      detail line's; the bar only draws it. */}
                  {bars && listed > 0 ? (
                    <span className="place-subdiv-rail__bar" aria-hidden="true">
                      <span style={{ width: `${((listed / railMost) * 100).toFixed(1)}%` }} />
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
      {folds ? (
        <button
          type="button"
          className="place-subdiv-rail__more"
          aria-expanded={railOpen}
          aria-controls={listId}
          onClick={() => setRailOpen((open) => !open)}
        >
          {railOpen ? 'Show fewer' : `Show all ${formatCount(rail.length)}`}
        </button>
      ) : null}
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
         its dials by (childListingKeys), so the map's focused homes and the
         dials below it can never disagree about who belongs to the
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

/** The held carousel's card (layout="rails"), as it shipped before the dial. */
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
  // A commercial lease prints its rent with the unit (or "Lease rate not
  // published") where a sale prints its ask, and "For lease" as its kind.
  const lease = publishListingLeaseFigure({
    price: listing.price,
    propertyType: listing.propertyType,
    leaseRateOption: listing.leaseRateOption ?? null,
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
      {lease ? (
        <span className={cn('place-home-card__price', !lease.rate && 'place-home-card__price--none')}>
          {lease.text}
        </span>
      ) : ask ? (
        <span className="place-home-card__price">{ask}</span>
      ) : null}
      {lease ? (
        <span className="place-home-card__share">{lease.label}</span>
      ) : share ? (
        <span className="place-home-card__share">{share}</span>
      ) : null}
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
 * The homes under the map. Every place page draws them as listing dials
 * (Matt 2026-09-23 on neighborhood pages; 2026-09-24 on city and community
 * pages, so every place page shows listings the same way): each buyer group
 * in the map's selection is one V3ListingDial, one home large and the rest of
 * the group as thumbnails on the dial beside it. The map decides what is in
 * the dials: choosing a subdivision re-keys every dial, so it opens on the
 * first home of the new selection with the readout counting that selection.
 * The carousel this replaced is gone (PUBLIC_UI.md bans carousels as a
 * default).
 *
 * THE RAIL MOVES FROM DIAL TO DIAL (Matt 2026-09-24: not every dial is the
 * same interaction). Each dial takes dialRailPositionAt(its order in this
 * block): the for-sale dials in buyer-group order, then the lease dial, so
 * two dials one above the other never stand their rails the same way.
 *
 * Under the map's `layout="rails"` (a class held below its taste mark) each
 * buyer group is instead the card carousel it shipped as, counted "N for
 * sale" as it was.
 */
export function PlaceSubdivisionHomes({
  id,
  countScope,
}: {
  id: string
  /**
   * Names the whole place's count ("on the map") where the page prints other
   * counts of the same place (Matt 2026-10-04). Only on a page whose map and
   * homes block share one population (lib/place/place-count-label.test.tsx);
   * dropped while a subdivision is selected, which the map does not count alone.
   */
  countScope?: string
}) {
  const { layout, placeName, rail, homes, leases, keysBySlug, source, asOf, selectedId } = usePlaceMap()
  const selected = rail.find((entry) => entry.id === selectedId) ?? null
  const title = selected?.name ?? placeName
  const visible = useMemo(() => {
    if (!selectedId) return homes
    const keys = new Set(keysBySlug[selectedId] ?? [])
    return homes.filter((home) => keys.has(home.listingKey))
  }, [homes, keysBySlug, selectedId])
  // The same selection filter, the same membership (childListingKeys), so the
  // leases below a chosen subdivision are the leases inside it.
  const visibleLeases = useMemo(() => {
    if (!selectedId) return leases
    const keys = new Set(keysBySlug[selectedId] ?? [])
    return leases.filter((lease) => keys.has(lease.listingKey))
  }, [leases, keysBySlug, selectedId])
  const leaseCount =
    visibleLeases.length > 0 ? `${formatCount(visibleLeases.length)} for lease` : null
  const typeSections = useMemo(() => homesByBuyerGroup(visible), [visible])
  // For sale is Active, under contract is Active Under Contract: the buckets
  // the map above draws its marks in (placeHomesCountLabel, SITE-193).
  const countLabel = placeHomesCountLabel(visible, selectedId ? null : countScope)
  const typed = typeSections.length > 1
  const dialKey = selectedId ?? 'all'
  // The lease dial comes after every for-sale dial drawn above it.
  const leaseDialOrder = typed ? typeSections.length : visible.length > 0 ? 1 : 0

  if (layout === 'rails') {
    return (
      <section
        id={id}
        className={cn(V3_ROOT_CLASS, 'place-homes', 'place-homes--rails')}
        aria-labelledby={`${id}-heading`}
      >
        <V3Heading level={2} size="field" id={`${id}-heading`}>
          {title}
        </V3Heading>
        {visible.length > 0 ? (
          <p className="place-homes__count">{`${formatCount(visible.length)} for sale`}</p>
        ) : null}
        {visible.length > 0 ? (
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
        ) : visibleLeases.length > 0 ? (
          <p className="place-homes__empty">Nothing for sale in {title} right now.</p>
        ) : (
          <p className="place-homes__empty">Nothing listed in {title} right now.</p>
        )}
        {/* COMMERCIAL SPACE FOR LEASE, last, apart from every for-sale count
            above. Same selection, same card, the rent with its unit. */}
        {leaseCount ? (
          <div id={`${id}-lease`} className="place-homes__type place-homes__type--lease">
            <p className="place-homes__type-heading" id={`${id}-lease-heading`}>
              {PLACE_LEASE_HEADING}
            </p>
            <p className="place-homes__type-count">{leaseCount}</p>
            <V3Carousel mode="rail" label={`${PLACE_LEASE_HEADING} in ${title}`}>
              {visibleLeases.map((listing) => (
                <PlaceHomeCard key={listing.listingKey} listing={listing} />
              ))}
            </V3Carousel>
          </div>
        ) : null}
        {leaseCount ? (
          <p className="place-homes__more">
            <V3Button href={COMMERCIAL_LEASE_PATH} variant="ghost">
              {COMMERCIAL_LEASE_ALL_LABEL}
            </V3Button>
          </p>
        ) : null}
        <V3SourceLine source={source} asOf={asOf} sourceName="Oregon Data Share" />
      </section>
    )
  }

  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'place-homes')} aria-labelledby={`${id}-heading`}>
      <V3Heading level={2} size="field" id={`${id}-heading`}>
        {title}
      </V3Heading>
      {countLabel ? <p className="place-homes__count">{countLabel}</p> : null}
      {visible.length > 0 ? (
        typed ? (
          typeSections.map((section, order) => (
            <V3ListingDial
              key={`${dialKey}-${section.key}`}
              id={`${id}-${section.key}`}
              className="place-homes__dial"
              railPosition={dialRailPositionAt(order)}
              heading={section.heading}
              headingLevel={3}
              countLabel={placeHomesCountLabel(section.rows)}
              label={`${section.heading} in ${title}`}
              listings={section.rows}
            />
          ))
        ) : (
          <V3ListingDial
            key={dialKey}
            id={`${id}-all`}
            className="place-homes__dial"
            railPosition={dialRailPositionAt(0)}
            label={`Homes in ${title}`}
            listings={visible}
          />
        )
      ) : visibleLeases.length > 0 ? (
        <p className="place-homes__empty">Nothing for sale in {title} right now.</p>
      ) : (
        <p className="place-homes__empty">Nothing listed in {title} right now.</p>
      )}
      {/* COMMERCIAL SPACE FOR LEASE, last, apart from every for-sale count
          above. Same selection, same dial, the rent with its unit. */}
      {leaseCount ? (
        <V3ListingDial
          key={`${dialKey}-lease`}
          id={`${id}-lease`}
          className="place-homes__dial"
          railPosition={dialRailPositionAt(leaseDialOrder)}
          heading={PLACE_LEASE_HEADING}
          headingLevel={3}
          countLabel={leaseCount}
          label={`${PLACE_LEASE_HEADING} in ${title}`}
          listings={visibleLeases}
        />
      ) : null}
      {leaseCount ? (
        <p className="place-homes__more">
          <V3Button href={COMMERCIAL_LEASE_PATH} variant="ghost">
            {COMMERCIAL_LEASE_ALL_LABEL}
          </V3Button>
        </p>
      ) : null}
      <V3SourceLine source={source} asOf={asOf} sourceName="Oregon Data Share" />
    </section>
  )
}
