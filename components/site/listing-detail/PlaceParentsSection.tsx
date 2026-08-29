import Link from 'next/link'
import type { PlaceNode } from '@/lib/data/geo/resolvePlaceContext'

type Props = {
  parents: PlaceNode[]
  eyebrow?: string
  title?: string | false
}

/**
 * Climb the ladder: parent city / neighborhood / community cards as ledger rows.
 */
export function PlaceParentsSection({
  parents,
  eyebrow = 'Keep exploring',
  title = 'This place sits inside',
}: Props) {
  if (parents.length === 0) return null
  const label = title === false ? 'Places this home sits inside' : title

  return (
    <section className="section listing-place-parents" aria-label={label}>
      <div className="wrap">
        {title === false ? null : (
          <div className="sec-head">
            <span className="sec-index">{eyebrow}</span>
            <h2 className="sec-title display">{title}</h2>
          </div>
        )}
        <ul
          style={{
            listStyle: 'none',
            margin: '1.5rem 0 0',
            padding: 0,
            borderTop: '1px solid color-mix(in srgb, var(--v3-navy) 12%, transparent)',
          }}
        >
          {parents.map((p) => (
            <li
              key={`${p.type}-${p.slug}`}
              style={{ borderBottom: '1px solid color-mix(in srgb, var(--v3-navy) 12%, transparent)' }}
            >
              <Link
                href={p.href}
                style={{
                  display: 'flex',
                  alignItems: 'baseline',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '1rem 0',
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
                    {p.type}
                  </span>
                  <span className="display" style={{ fontSize: '1.35rem', fontWeight: 500 }}>
                    {p.label}
                  </span>
                </span>
                <span aria-hidden style={{ opacity: 0.5 }}>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
