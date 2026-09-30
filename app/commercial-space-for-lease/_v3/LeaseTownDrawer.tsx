/**
 * /commercial-space-for-lease: every town after the lead, as a drawer
 * (2026-09-30, "every town is the same dial block"; "the drawer rows read as
 * one repeated shape").
 *
 * The busiest town leads the page on its own full dial. Every other town is one
 * row here, busiest first, and the rows together are one drawing: each town's
 * rents on ONE shared axis (asking rent per sq ft per month), every lease a dot
 * at its own rent, drawn to its listed size (leaseRentStrips), so Madras's
 * cheap floor, Redmond's cluster and a lone high rent read at a glance and no
 * two rows look alike unless their leases do. Beside the strip: the town's rate
 * line (every lease it counts, one unit to a line, the words its ledger row
 * uses) and its largest listed space, photographed, with its size and street.
 * A row opens, on demand, to that town's leases: its own V3ListingDial when it
 * has LEASE_DIAL_MIN or more, else its leases as V3ListingRow cards, every one
 * in view. The first row stands open, so the drawer shows what it holds.
 *
 * No client code of its own: each town is a <section> named by an <h2> (the
 * town, as the dials named it), its row a <details> (one open at a time where
 * the browser supports `name`), and a link to a town's anchor, from its ledger
 * row or its name on the map, opens that row (the browser reveals a closed
 * <details> holding a fragment's target). The strip is a picture of the rate
 * line beside it (aria-hidden): the words carry every figure. Every lease is an
 * <a href> in the served HTML whether its row is open or not: the dial's doors,
 * or the rows. It renders inside the lead's V3PlaceInventory (`after`), above
 * that block's one source line, so the page's lease listings are one block with
 * one trace.
 */
import type { CSSProperties } from 'react'
import { cn } from '@/lib/utils'
import { formatCount } from '@/lib/format/count'
import {
  V3_LEDGER_CLASS,
  V3_ROOT_CLASS,
  V3Heading,
  V3ListingDial,
  V3ListingRow,
  dialRailPositionAt,
} from '@/components/site/v3'
import {
  LEASE_DIAL_MIN,
  LEASE_STRIP_D_UNSIZED,
  leaseRentStrips,
  leaseTownLargest,
  type LeaseCityGroup,
} from './lease-page'

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
  const strips = leaseRentStrips(groups)
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
          const asDial = group.rows.length >= LEASE_DIAL_MIN
          const townHeadingId = `${group.anchor}-name`
          const dots = strips?.dots[group.slug] ?? []
          const largest = leaseTownLargest(group)
          return (
            <section key={group.slug} className="lease-drawer__town" aria-labelledby={townHeadingId}>
              <details name={`${id}-town`} className="lease-drawer__details" open={i === 0}>
                <summary className="lease-drawer__row">
                  <h2 id={townHeadingId} className="lease-drawer__town-name">
                    {group.label}
                  </h2>
                  <span className="lease-drawer__count">{group.countLabel}</span>
                  {strips ? (
                    <span className="lease-drawer__strip" aria-hidden="true">
                      <span className="lease-drawer__axis" />
                      {strips.ticks.map((tick) => (
                        <span key={tick.value} className="lease-drawer__tick" style={{ left: `${tick.x}%` }}>
                          <span className="lease-drawer__tick-label">{tick.label}</span>
                        </span>
                      ))}
                      {dots.map((dot) => (
                        <span
                          key={dot.key}
                          className={cn('lease-drawer__dot', dot.d == null && 'lease-drawer__dot--ring')}
                          style={
                            {
                              left: `${dot.x}%`,
                              '--lease-dot-d': `${dot.d ?? LEASE_STRIP_D_UNSIZED}rem`,
                            } as CSSProperties
                          }
                        />
                      ))}
                    </span>
                  ) : null}
                  {group.rateSummary ? (
                    <span className="lease-drawer__rates">
                      {group.rateSummary.split(' · ').map((line) => (
                        <span key={line} className="lease-drawer__rate">
                          {line}
                        </span>
                      ))}
                    </span>
                  ) : null}
                  {largest ? (
                    <span className="lease-drawer__largest">
                      {largest.photo ? (
                        // eslint-disable-next-line @next/next/no-img-element -- the ledger rows' own thumbnail source (listingRowPhotoSrc), decorative: the words beside it name the space
                        <img
                          className="lease-drawer__photo"
                          src={largest.photo}
                          alt=""
                          loading="lazy"
                          decoding="async"
                        />
                      ) : null}
                      <span className="lease-drawer__largest-text">
                        <span className="lease-drawer__largest-label">
                          {group.rows.length === 1 ? 'Its one space' : 'Largest space'}
                        </span>
                        <span className="lease-drawer__largest-size">{formatCount(largest.sqft)} sq ft</span>
                        <span className="lease-drawer__largest-street">{largest.row.addressLine}</span>
                      </span>
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
