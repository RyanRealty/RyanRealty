import Link from 'next/link'
import { cn } from '@/lib/utils'
import { findParksNear, type ParkType } from '@/data/co-parks'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * ParksNearbyBlock — KB section style: navy border sec-head, park cards
 * with hard edge borders in cream/navy palette.
 */

type Props = {
  listing: Pick<ListingDetail, 'lat' | 'lng'>
  className?: string
}

const TYPE_LABEL: Record<ParkType, string> = {
  state: 'State park',
  city: 'City park',
  'natural-area': 'Natural area',
}

function formatMiles(miles: number): string {
  return `${miles.toFixed(1)} mi`
}

export function ParksNearbyBlock({ listing, className }: Props) {
  const { lat, lng } = listing
  if (typeof lat !== 'number' || typeof lng !== 'number') return null

  const parks = findParksNear(lat, lng, 3, 6)
  if (parks.length === 0) return null

  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Outdoors</div>
          <h2 className="sec-title display">Parks nearby</h2>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '3px',
          background: 'rgba(16,39,66,0.12)',
          border: '1px solid rgba(16,39,66,0.12)',
          marginTop: 'clamp(22px,3vw,36px)',
        }}
      >
        {parks.map((park) => (
          <Link
            key={park.slug}
            href={`/parks/${park.slug}`}
            style={{
              display: 'block',
              background: 'var(--cream, #faf8f4)',
              padding: '18px 20px',
              textDecoration: 'none',
              color: 'var(--navy, #102742)',
            }}
            className="hover:bg-[rgba(16,39,66,0.04)] transition-colors"
          >
            <div
              style={{
                fontFamily: 'var(--font-amboqia, serif)',
                fontSize: 'clamp(1.1rem,2.2vw,1.45rem)',
                lineHeight: 0.94,
                color: 'var(--navy, #102742)',
                overflow: 'visible',
                marginBottom: 8,
              }}
            >
              {park.name}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                fontSize: '0.68rem',
                fontWeight: 600,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'rgba(16,39,66,0.72)',
              }}
            >
              <span>{TYPE_LABEL[park.type]}</span>
              <span aria-hidden>·</span>
              <span className="tabular-nums">{formatMiles(park.distanceMiles)}</span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  )
}
