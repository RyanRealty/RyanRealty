/**
 * HomepageCineCollection — the top of the current market, three live
 * listings from listing_tile_mv (price-desc, service-area scoped, photo
 * required). Every figure on a card comes from the tile row. The section
 * hides when fewer than three photographed listings resolve — honest empty.
 */

import Image from 'next/image'
import Link from 'next/link'
import { H2 } from '@/components/site/primitives'
import type { ListingTile } from '@/lib/data/types/listing'

function fmtPrice(n: number): string {
  return `$${(Math.round(n / 1000) * 1000).toLocaleString('en-US')}`
}

export default function HomepageCineCollection({ tiles }: { tiles: ListingTile[] }) {
  const cards = tiles
    .filter(
      (t) =>
        t.photoUrl &&
        t.listPrice != null &&
        t.propertySubType === 'Single Family Residence' &&
        // a real street address — "0 Hwy 97"-style land placeholders read broken
        t.streetNumber != null &&
        t.streetNumber !== '0',
    )
    .slice(0, 3)
  if (cards.length < 3) return null

  return (
    <section className="cine-collection" aria-label="Featured listings">
      <div className="cine-collection-wrap">
        <div className="cine-collection-head">
          <H2 className="cine-h2">The top of the market, right now</H2>
          <Link href="/homes-for-sale">View every listing →</Link>
        </div>
        <div className="cine-cards">
          {cards.map((t) => {
            const address = [t.streetNumber, t.streetName].filter(Boolean).join(' ')
            const meta = [
              t.beds != null ? `${t.beds} bd` : null,
              t.baths != null ? `${t.baths} ba` : null,
              t.sqft != null ? `${t.sqft.toLocaleString('en-US')} sqft` : null,
            ].filter(Boolean)
            return (
              <Link key={t.listingKey} href={`/listing/${t.listingKey}`} className="cine-card">
                <div className="cine-card-media">
                  <Image
                    src={t.photoUrl as string}
                    alt={address ? `${address}, ${t.city ?? 'Central Oregon'}` : 'Listing photo'}
                    fill
                    sizes="(max-width: 960px) 100vw, 33vw"
                    className="object-cover"
                  />
                </div>
                <div className="cine-card-price">{fmtPrice(t.listPrice as number)}</div>
                <div className="cine-card-addr">
                  {address}
                  {t.city ? ` · ${t.city}` : ''}
                </div>
                {meta.length > 0 && <div className="cine-card-meta">{meta.join(' · ')}</div>}
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}
