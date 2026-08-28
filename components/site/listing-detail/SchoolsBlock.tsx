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

      {/* Flexbox, not grid: an odd card count (3) in a fixed-column grid at
          narrow widths leaves a trailing empty cell that shows this
          container's tinted background as a bare tile with nothing in it
          (mobile 390px, design-audit 2026-08-27). A lone trailing flex item
          has no sibling to share its row with, so it stretches to fill it
          instead of leaving a hole. */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '3px',
          background: 'color-mix(in srgb, var(--v3-navy) 12%, transparent)',
          border: '1px solid color-mix(in srgb, var(--v3-navy) 12%, transparent)',
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
        flex: '1 1 180px',
        background: 'var(--v3-cream)',
        padding: '18px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        className="eyebrow"
        style={{ color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)', fontSize: '0.62rem', letterSpacing: '0.18em' }}
      >
        {level}
      </div>
      <div
        style={{
          fontFamily: 'var(--font-amboqia-safe, serif)',
          fontSize: 'clamp(1.1rem,2.2vw,1.55rem)',
          lineHeight: 0.92,
          color: name ? 'var(--v3-navy)' : 'color-mix(in srgb, var(--v3-navy) 35%, transparent)',
          overflow: 'visible',
        }}
      >
        {name ? (
          registered ? (
            <Link
              href={`/schools/${registered.slug}`}
              style={{ color: 'var(--v3-navy)', textDecoration: 'none' }}
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
            color: 'color-mix(in srgb, var(--v3-navy) 72%, transparent)',
            letterSpacing: '0.02em',
          }}
        >
          {district}
        </div>
      ) : null}
    </div>
  )
}
