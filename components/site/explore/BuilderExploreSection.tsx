import Link from 'next/link'
import type { ListingTile } from '@/lib/data/types/listing'
import { listingDetailPath, slugify } from '@/lib/slug'
import { formatPublishedAsk } from '@/lib/listing/publish-listing-ask'

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
          <h2 className="sec-title display">More by {builderName}</h2>
        </div>
        <p className="mt-2 text-sm" style={{ color: 'var(--navy-70)' }}>
          <Link
            href={`/builders/${slugify(builderName)}`}
            className="underline"
            style={{ color: 'var(--navy)' }}
          >
            See all {builderName} homes
          </Link>
        </p>
        <ul
          style={{
            listStyle: 'none',
            margin: '1.5rem 0 0',
            padding: 0,
            borderTop: '1px solid rgba(16,39,66,0.12)',
          }}
        >
          {tiles.map((t) => {
            const street = [t.streetNumber, t.streetName, t.streetSuffix]
              .filter(Boolean)
              .join(' ')
              .trim()
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
                style={{ borderBottom: '1px solid rgba(16,39,66,0.12)' }}
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
