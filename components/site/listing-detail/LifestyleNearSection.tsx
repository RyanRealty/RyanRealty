import Link from 'next/link'
import type { LifestyleNearItem } from '@/lib/explore/lifestyle-near'
import { lifestyleNearLatLng } from '@/lib/explore/lifestyle-near'

type Props = {
  lat: number | null | undefined
  lng: number | null | undefined
  /** Override precomputed items (e.g. place centroid). */
  items?: LifestyleNearItem[]
  eyebrow?: string
  title?: string
}

/**
 * Parks · trails · golf near a point — ledger rows, not a tile wall.
 * Exploration System lifestyle chapter.
 */
export function LifestyleNearSection({
  lat,
  lng,
  items: itemsProp,
  eyebrow = 'Around here',
  title = 'Parks, trails, and golf nearby',
}: Props) {
  const items = itemsProp ?? lifestyleNearLatLng(lat, lng)
  if (items.length === 0) return null

  return (
    <section className="section" aria-label={title}>
      <div className="wrap">
        <div className="sec-head">
          <span className="sec-index">{eyebrow}</span>
          <h2 className="sec-title display">{title}</h2>
        </div>
        <ul
          style={{
            listStyle: 'none',
            margin: '1.5rem 0 0',
            padding: 0,
            borderTop: '1px solid color-mix(in srgb, var(--v3-navy) 12%, transparent)',
          }}
        >
          {items.map((item) => (
            <li
              key={`${item.kind}-${item.href}`}
              style={{
                borderBottom: '1px solid color-mix(in srgb, var(--v3-navy) 12%, transparent)',
              }}
            >
              <Link
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.85rem 0',
                  color: 'var(--navy)',
                  textDecoration: 'none',
                }}
                className="hover:opacity-80"
              >
                <span>
                  <span
                    style={{
                      fontSize: '0.68rem',
                      fontWeight: 600,
                      letterSpacing: '0.06em',
                      textTransform: 'uppercase',
                      color: 'var(--navy-70)',
                      marginRight: '0.65rem',
                    }}
                  >
                    {item.kind}
                  </span>
                  <span style={{ fontWeight: 600 }}>{item.name}</span>
                  {item.meta ? (
                    <span
                      style={{
                        marginLeft: '0.5rem',
                        fontSize: '0.85rem',
                        color: 'var(--navy-70)',
                      }}
                    >
                      {item.meta}
                    </span>
                  ) : null}
                </span>
                <span
                  className="mono-num"
                  style={{ fontSize: '0.85rem', color: 'var(--navy-70)', flexShrink: 0 }}
                >
                  {item.distanceMiles < 10
                    ? `${item.distanceMiles.toFixed(1)} mi`
                    : `${Math.round(item.distanceMiles)} mi`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
