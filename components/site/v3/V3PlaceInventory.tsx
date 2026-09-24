/**
 * PLACE INVENTORY — every active listing on the place page, one section
 * per property type that actually has stock.
 *
 * Matt 2026-09-18: the scrolling search / price scrubber is not the
 * inventory surface. Typed sections stay here. Empty types omit.
 *
 * `layout="rails"` (Matt 2026-09-23, subdivision pages: "carousels of all
 * available property types"): each type is the homepage's card carousel
 * instead of a ledger. Same sections, same rows, same source line: every
 * listing the ledger would list is a card, a type with one listing still
 * gets its carousel, and the count stays under the heading.
 *
 * `layout="dial"` (Matt 2026-09-23, "an alternative to a carousel ... a
 * primary card ... a smaller dial with thumbnails"): each type is one
 * V3ListingDial, one listing large with the rest of that type as thumbnails
 * on its left and "03 / 12" at their head. Same sections, same rows, same source
 * line, and every listing is still an <a href> in the served HTML.
 *
 * COMMERCIAL SPACE FOR LEASE (Matt 2026-09-23). `lease` is the place's active
 * commercial leases (MLS 'G'), built by placeLeaseSectionFromTiles apart from
 * every for-sale section, because a lease is not for sale. It renders LAST,
 * after "Commercial property", in whichever layout the page chose, with the
 * same card: the rent with its unit (or "Lease rate not published") where a
 * sale prints its ask, labelled "For lease", counted "N for lease". Every lease
 * is an <a href> in the served HTML like every other row.
 */
import { cn } from '@/lib/utils'
import { Fragment } from 'react'
import { V3_LEDGER_CLASS, V3_ROOT_CLASS, V3Button, V3Heading } from './atoms'
import { V3ListingRow, type V3ListingRowData } from './V3ListingRow'
import { V3Quiet } from './V3Quiet'
import { V3SourceLine } from './V3SourceLine'
import type { PlaceStockSection } from '@/lib/place/place-inventory-stock'
import type { PlaceLeaseSection } from '@/lib/place/place-lease-stock'
import { COMMERCIAL_LEASE_ALL_LABEL, COMMERCIAL_LEASE_PATH } from '@/lib/place/place-lease-heading'
import { HomeListingRail } from '@/app/_v3/HomeListingRail.client'
import { railCardFromListingRow } from '@/app/_v3/home-rail-items'
import { V3ListingDial } from './V3ListingDial.client'
import './tokens.css'
import './V3PlaceInventory.css'

export type V3PlaceInventoryProps = {
  id?: string
  placeName: string
  /**
   * The for-sale type sections (placeStockSectionsFromTiles), or any list of
   * the same shape: /commercial-space-for-lease passes one per town.
   */
  sections: readonly V3PlaceInventorySection[]
  source: string
  asOf?: string | null
  /**
   * 'rows' (default): the ledger. 'rails': one card carousel per type.
   * 'dial': one V3ListingDial per type.
   */
  layout?: 'rows' | 'rails' | 'dial'
  /** Commercial space for lease: the final section, never counted for sale. */
  lease?: PlaceLeaseSection | null
}

/** One section the inventory renders: a for-sale type, a town, or the leases. */
export type V3PlaceInventorySection = {
  key: string
  heading: string
  countLabel: string
  rows: readonly V3ListingRowData[]
  /** The dial's or rail's accessible name. Defaults to "{heading} in {placeName}". */
  label?: string
}

/** A section as rendered, with the one door the lease section adds. */
type InventorySection = V3PlaceInventorySection & {
  more?: { href: string; label: string }
}


export function V3PlaceInventory({
  id = 'homes',
  placeName,
  sections,
  source,
  asOf,
  layout = 'rows',
  lease = null,
}: V3PlaceInventoryProps) {
  const forSale: InventorySection[] = sections.filter((section) => section.rows.length > 0)
  // The lease section goes last, after "Commercial property".
  // The lease section goes last and carries the door to every lease in
  // Central Oregon (/commercial-space-for-lease).
  const live: InventorySection[] =
    lease && lease.rows.length > 0
      ? [...forSale, { ...lease, more: { href: COMMERCIAL_LEASE_PATH, label: COMMERCIAL_LEASE_ALL_LABEL } }]
      : forSale
  if (live.length === 0) {
    return (
      <V3Quiet
        id={id}
        heading={`Homes in ${placeName}`}
        items={[{ kind: 'prose', body: `Nothing listed in ${placeName} right now.` }]}
      />
    )
  }

  if (layout === 'dial') {
    return (
      <div id={id} className={cn(V3_ROOT_CLASS, 'v3-place-stock', 'v3-place-stock--dial')}>
        {live.map((section) => (
          <Fragment key={section.key}>
            <V3ListingDial
              id={`${id}-${section.key}`}
              heading={section.heading}
              headingLevel={2}
              countLabel={section.countLabel}
              label={section.label ?? `${section.heading} in ${placeName}`}
              listings={section.rows}
            />
            {section.more ? (
              <p className="v3-place-stock__more">
                <V3Button href={section.more.href} variant="ghost">
                  {section.more.label}
                </V3Button>
              </p>
            ) : null}
          </Fragment>
        ))}
        <V3SourceLine source={source} asOf={asOf ?? null} sourceName="Oregon Data Share" />
      </div>
    )
  }

  if (layout === 'rails') {
    return (
      <div id={id} className={cn(V3_ROOT_CLASS, 'v3-place-stock', 'v3-place-stock--rails')}>
        {live.map((section) => (
          <HomeListingRail
            key={section.key}
            row={{
              id: `${id}-${section.key}`,
              heading: section.heading,
              countLabel: section.countLabel,
              ...(section.more ? { seeAll: section.more } : {}),
              // The inventory sits well below the fold on every place page.
              priorityCount: 0,
              cards: section.rows.map(railCardFromListingRow),
            }}
          />
        ))}
        <div className="v3-place-stock__source">
          <V3SourceLine source={source} asOf={asOf ?? null} sourceName="Oregon Data Share" />
        </div>
      </div>
    )
  }

  return (
    <div id={id} className={cn(V3_ROOT_CLASS, 'v3-place-stock')}>
      {live.map((section, sectionIndex) => (
        <section
          key={section.key}
          className="v3-place-stock__section"
          aria-labelledby={`${id}-${section.key}`}
        >
          <div className="v3-place-stock__head">
            <V3Heading id={`${id}-${section.key}`} level={2}>
              {section.heading}
            </V3Heading>
            <p className="v3-place-stock__count">{section.countLabel}</p>
          </div>
          <div className={cn(V3_LEDGER_CLASS, 'v3-lrow-list', 'v3-place-stock__rows')}>
            {section.rows.map((listing: V3ListingRowData, index) => (
              <V3ListingRow
                key={listing.listingKey}
                listing={listing}
                priority={sectionIndex === 0 && index < 3}
              />
            ))}
          </div>
          {section.more ? (
            <p className="v3-place-stock__more">
              <V3Button href={section.more.href} variant="ghost">
                {section.more.label}
              </V3Button>
            </p>
          ) : null}
        </section>
      ))}
      <V3SourceLine source={source} asOf={asOf ?? null} sourceName="Oregon Data Share" />
    </div>
  )
}
