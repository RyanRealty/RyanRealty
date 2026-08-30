import Link from 'next/link'
import type { ListingTile } from '@/lib/data/types/listing'
import { listingDetailPath } from '@/lib/slug'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'
import { publishListingShareKind } from '@/lib/listing/publish-listing-share'

type Props = {
  builderName: string
  tiles: ListingTile[]
}

/**
 * Ledger of other active homes by the same MLS builder (not a second card grid).
 */
export function BuilderExploreSection({ builderName, tiles }: Props) {
  if (tiles.length === 0) return null

  return (
    <section className="section" aria-label={`More homes by ${builderName}`}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">Builder</span>
          <h2 className="sec-title">More by {builderName}</h2>
        </div>
        {/* No "see all" link: /builders/:slug permanently redirects to a generic
            new-construction search, and the search field registry has no builder
            key to carry the name across. The rows below already are this
            builder's homes, so a link that discards the builder is worse than
            none. Restore it only alongside a real builder filter. */}
        <ul
          style={{
            listStyle: 'none',
            margin: '1.5rem 0 0',
            padding: 0,
            borderTop: '1px solid color-mix(in srgb, var(--v3-navy) 12%, transparent)',
          }}
        >
          {tiles.map((t) => {
            const street = [t.streetNumber, t.streetName, t.streetSuffix]
              .filter(Boolean)
              .join(' ')
              .trim()
            // A fractional ask never prints unlabeled (the Camp Sherman
            // quarter-share rule): the share label rides beside the price.
            const shareKind = publishListingShareKind({
              propertySubType: t.propertySubType,
              subdivisionName: t.subdivisionName,
              city: t.city,
              listNumber: t.listNumber,
            })
            const href = listingDetailPath(
              t.listingKey,
              {
                streetNumber: t.streetNumber,
                streetName: t.streetName,
                city: t.city,
              },
              { city: t.city, subdivision: t.subdivisionName },
              { mlsNumber: t.listNumber },
            )
            return (
              <li
                key={t.listingKey}
                style={{ borderBottom: '1px solid color-mix(in srgb, var(--v3-navy) 12%, transparent)' }}
              >
                <Link
                  href={href}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: '1rem',
                    padding: '0.9rem 0',
                    color: 'var(--navy)',
                    textDecoration: 'none',
                    fontWeight: 600,
                  }}
                  className="hover:opacity-80"
                >
                  <span>
                    {street || 'Listing'}
                    {t.city ? (
                      <span style={{ fontWeight: 500, color: 'var(--navy-70)', marginLeft: 8 }}>
                        {t.city}
                      </span>
                    ) : null}
                  </span>
                  <span className="mono-num" style={{ color: 'var(--navy-70)', flexShrink: 0 }}>
                    {formatPublishedAsk(t.listPrice) ?? '—'}
                    {shareKind ? (
                      <span style={{ fontWeight: 500, marginLeft: 6 }}>· {shareKind}</span>
                    ) : null}
                  </span>
                </Link>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
