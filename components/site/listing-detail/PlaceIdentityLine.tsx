/**
 * Compact place ladder under the listing price strip.
 * Links City · Neighborhood · Community · Subdivision so the buyer
 * can climb without a traditional breadcrumb chrome (listing parity
 * keeps visual BreadcrumbNav off; JSON-LD breadcrumb stays on the page).
 */

import Link from 'next/link'
import type { PlaceContext } from '@/lib/data/geo/resolvePlaceContext'

type Props = {
  place: PlaceContext
  className?: string
}

export function PlaceIdentityLine({ place, className }: Props) {
  if (place.breadcrumb.length === 0) return null

  // Finest-first for scanning (matches identityLine order).
  const nodes = [...place.breadcrumb].reverse()

  return (
    <nav
      aria-label="Place"
      className={className}
      style={{
        marginTop: 8,
        fontSize: '0.78rem',
        fontWeight: 500,
        letterSpacing: '0.02em',
        color: 'rgba(16,39,66,0.72)',
      }}
    >
      {nodes.map((node, i) => (
        <span key={`${node.type}-${node.slug}`}>
          {i > 0 ? (
            <span aria-hidden style={{ margin: '0 0.35em', opacity: 0.55 }}>
              ·
            </span>
          ) : null}
          <Link
            href={node.href}
            className="underline-offset-2 hover:underline"
            style={{ color: 'inherit' }}
            data-place-type={node.type}
          >
            {node.label}
          </Link>
        </span>
      ))}
    </nav>
  )
}
