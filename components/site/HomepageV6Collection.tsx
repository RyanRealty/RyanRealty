/**
 * HomepageV6Collection — top of the market, Linear finish.
 * SFR-only, core-city, photo-required (filtered in the page). Hairline cards,
 * tabular price. Hides when fewer than 3 photographed listings resolve.
 */

import Image from 'next/image'
import Link from 'next/link'
import type { ListingTile } from '@/lib/data/types/listing'

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

export default function HomepageV6Collection({ tiles }: { tiles: ListingTile[] }) {
  const cards = tiles
    .filter(
      (t) =>
        t.photoUrl &&
        t.listPrice != null &&
        t.propertySubType === 'Single Family Residence' &&
        t.streetNumber != null &&
        t.streetNumber !== '0',
    )
    .slice(0, 3)
  if (cards.length < 3) return null

  return (
    <section className="v6-section" aria-label="Top of the market">
      <div className="v6-section-wrap">
        <div className="v6-section-head">
          {/* heading-display-ok */}
          <h2>The top of the market, right now</h2>
          <Link href="/homes-for-sale">View every listing →</Link>
        </div>
        <div className="v6-cards">
          {cards.map((t) => {
            const address = [t.streetNumber, t.streetName].filter(Boolean).join(' ')
            const meta = [
              t.beds != null ? `${t.beds} bd` : null,
              t.baths != null ? `${t.baths} ba` : null,
              t.sqft != null ? `${t.sqft.toLocaleString('en-US')} sqft` : null,
            ].filter(Boolean)
            return (
              <Link key={t.listingKey} href={`/listing/${t.listingKey}`} className="v6-card">
                <div className="v6-card-media">
                  <Image
                    src={t.photoUrl as string}
                    alt={address ? `${address}, ${t.city ?? 'Central Oregon'}` : 'Listing photo'}
                    fill
                    sizes="(max-width: 960px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="v6-card-body v6-tnum">
                  <span className="v6-card-price">{fmtPrice(t.listPrice as number)}</span>
                  <span className="v6-card-addr">
                    {address}
                    {t.city ? ` · ${t.city}` : ''}
                  </span>
                  {meta.length > 0 && <span className="v6-card-meta">{meta.join(' · ')}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
