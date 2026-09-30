/**
 * /commercial-space-for-lease: every town after the lead, as a drawer
 * (2026-09-30, "every town is the same dial block").
 *
 * The busiest town leads the page on its own full dial. Every other town is one
 * row here, busiest first: its name, its count, its rate line (one unit to a
 * line, the same words as its ledger row) and a strip of its own photographs.
 * A row opens, on demand, to that town's leases: its own V3ListingDial when it
 * has LEASE_DIAL_MIN or more, else its leases as V3ListingRow cards, every one
 * in view. The first row stands open, so the drawer shows what it holds.
 *
 * No client code of its own: each town is a <section> named by an <h2> (the
 * town, as the dials named it), its row a <details> (one open at a time where
 * the browser supports `name`), and a link to a town's anchor, from its ledger
 * row or its name on the map, opens that row (the browser reveals a closed
 * <details> holding a fragment's target). Every lease is an <a href> in the
 * served HTML whether its row is open or not: the dial's doors, or the rows.
 * It renders inside the lead's V3PlaceInventory (`after`), above that block's
 * one source line, so the page's lease listings are one block with one trace.
 */
import { cn } from '@/lib/utils'
import {
  V3_LEDGER_CLASS,
  V3_ROOT_CLASS,
  V3Heading,
  V3ListingDial,
  V3ListingRow,
  dialRailPositionAt,
} from '@/components/site/v3'
import { LEASE_DIAL_MIN, leaseTownThumbs, type LeaseCityGroup } from './lease-page'

export function LeaseTownDrawer({
  id,
  heading,
  note,
  groups,
}: {
  id: string
  heading: string
  note: string
  groups: readonly LeaseCityGroup[]
}) {
  if (groups.length === 0) return null
  const headingId = `${id}-heading`
  return (
    <section id={id} className={cn(V3_ROOT_CLASS, 'lease-drawer')} aria-labelledby={headingId}>
      <div className="lease-drawer__head">
        <V3Heading level={2} id={headingId}>
          {heading}
        </V3Heading>
        <p className="lease-drawer__note">{note}</p>
      </div>
      <div className="lease-drawer__towns">
        {groups.map((group, i) => {
          const thumbs = leaseTownThumbs(group)
          const asDial = group.rows.length >= LEASE_DIAL_MIN
          const townHeadingId = `${group.anchor}-name`
          return (
            <section key={group.slug} className="lease-drawer__town" aria-labelledby={townHeadingId}>
            <details name={`${id}-town`} className="lease-drawer__details" open={i === 0}>
              <summary className="lease-drawer__row">
                <h2 id={townHeadingId} className="lease-drawer__town-name">
                  {group.label}
                </h2>
                <span className="lease-drawer__count">{group.countLabel}</span>
                {group.rateSummary ? (
                  <span className="lease-drawer__rates">
                    {group.rateSummary.split(' · ').map((line) => (
                      <span key={line} className="lease-drawer__rate">
                        {line}
                      </span>
                    ))}
                  </span>
                ) : null}
                {thumbs.length > 0 ? (
                  <span className="lease-drawer__thumbs" aria-hidden="true">
                    {thumbs.map((thumb) => (
                      // eslint-disable-next-line @next/next/no-img-element -- the ledger rows' own thumbnail source (listingRowPhotoSrc), decorative
                      <img key={thumb.key} className="lease-drawer__thumb" src={thumb.src} alt="" loading="lazy" decoding="async" />
                    ))}
                  </span>
                ) : null}
                <span className="lease-drawer__toggle" aria-hidden="true" />
              </summary>
              <div className="lease-drawer__body">
                {asDial ? (
                  <V3ListingDial
                    id={group.anchor}
                    railPosition={dialRailPositionAt(i + 1)}
                    label={`Commercial space for lease in ${group.label}`}
                    listings={group.rows}
                  />
                ) : (
                  <div id={group.anchor} className={cn(V3_LEDGER_CLASS, 'v3-lrow-list', 'lease-drawer__rows')}>
                    {group.rows.map((listing) => (
                      <V3ListingRow key={listing.listingKey} listing={listing} />
                    ))}
                  </div>
                )}
              </div>
            </details>
            </section>
          )
        })}
      </div>
    </section>
  )
}
