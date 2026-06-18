import Link from 'next/link'
import { cn } from '@/lib/utils'
import { findSchoolByName } from '@/data/co-schools'
import type { ListingDetail } from '@/lib/data/types/listing'

/**
 * SchoolsBlock — KB section style: navy border sec-head, Amboqia heading,
 * card grid with hard 1px --edge border.
 */

type Props = {
  listing: Pick<
    ListingDetail,
    'elementarySchool' | 'middleSchool' | 'highSchool' | 'schoolDistrict'
  >
  className?: string
}

function cleanField(raw: string | null): string | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (!trimmed || trimmed.startsWith('***')) return null
  return trimmed
}

export function SchoolsBlock({ listing, className }: Props) {
  const cards: Array<{ level: string; name: string | null }> = [
    { level: 'Elementary', name: cleanField(listing.elementarySchool) },
    { level: 'Middle', name: cleanField(listing.middleSchool) },
    { level: 'High', name: cleanField(listing.highSchool) },
  ]
  const district = cleanField(listing.schoolDistrict)
  const anyPresent = cards.some((c) => c.name && c.name.length > 0)
  if (!anyPresent && !district) return null

  return (
    <section className={cn('section', className)}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Education</div>
          <h2 className="sec-title display">Schools</h2>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '3px',
          background: 'rgba(16,39,66,0.12)',
          border: '1px solid rgba(16,39,66,0.12)',
          marginTop: 'clamp(22px,3vw,36px)',
        }}
      >
        {cards.map((c) => (
          <SchoolCard
            key={c.level}
            level={c.level}
            name={c.name}
            district={district}
          />
        ))}
      </div>
    </section>
  )
}

function SchoolCard({
  level,
  name,
  district,
}: {
  level: string
  name: string | null
  district: string | null
}) {
  const registered = name ? findSchoolByName(name) : undefined

  return (
    <div
      style={{
        background: 'var(--cream, #faf8f4)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        className="eyebrow"
        style={{ color: 'rgba(16,39,66,0.55)', fontSize: '0.62rem', letterSpacing: '0.18em' }}
      >
        {level}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-amboqia, serif)',
          fontSize: 'clamp(1.1rem,2.2vw,1.55rem)',
          lineHeight: 0.92,
          color: name ? 'var(--navy, #102742)' : 'rgba(16,39,66,0.35)',
          overflow: 'visible',
        }}
      >
        {name ? (
          registered ? (
            <Link
              href={`/schools/${registered.slug}`}
              style={{ color: 'var(--navy, #102742)', textDecoration: 'none' }}
              className="hover:underline"
            >
              {name}
            </Link>
          ) : (
            name
          )
        ) : (
          '—'
        )}
      </div>
      {district ? (
        <div
          style={{
            fontSize: '0.72rem',
            fontWeight: 500,
            color: 'rgba(16,39,66,0.55)',
            letterSpacing: '0.02em',
          }}
        >
          {district}
        </div>
      ) : null}
    </div>
  )
}
