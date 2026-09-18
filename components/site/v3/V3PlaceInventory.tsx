/**
 * PLACE INVENTORY — every active listing on the place page, one section
 * per property type that actually has stock.
 *
 * Matt 2026-09-18: the scrolling search / price scrubber is not the
 * inventory surface. Typed sections stay here. Empty types omit.
 */
import { cn } from '@/lib/utils'
import { V3_LEDGER_CLASS, V3_ROOT_CLASS, V3Heading } from './atoms'
import { V3ListingRow, type V3ListingRowData } from './V3ListingRow'
import { V3Quiet } from './V3Quiet'
import { V3SourceLine } from './V3SourceLine'
import type { PlaceStockSection } from '@/lib/place/place-inventory-stock'
import './tokens.css'
import './V3PlaceInventory.css'

export type V3PlaceInventoryProps = {
  id?: string
  placeName: string
  sections: readonly PlaceStockSection[]
  source: string
  asOf?: string | null
}

export function V3PlaceInventory({
  id = 'homes',
  placeName,
  sections,
  source,
  asOf,
}: V3PlaceInventoryProps) {
  const live = sections.filter((section) => section.rows.length > 0)
  if (live.length === 0) {
    return (
      <V3Quiet
        id={id}
        heading={`Homes in ${placeName}`}
        items={[{ kind: 'prose', body: `Nothing listed in ${placeName} right now.` }]}
      />
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
        </section>
      ))}
      <V3SourceLine source={source} asOf={asOf ?? null} sourceName="Oregon Data Share" />
    </div>
  )
}
