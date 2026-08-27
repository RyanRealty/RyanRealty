'use client'

import Link from 'next/link'
import { howNumberHref } from '@/lib/market/how-we-get-our-numbers'

/** Small `?` that jumps to the How we get our numbers term for this figure. */
export function MetricHowLink({
  anchor,
  label,
}: {
  anchor: string
  label: string
}) {
  return (
    <Link
      href={howNumberHref(anchor)}
      className="mkt-how"
      aria-label={`How we get this number: ${label}`}
    >
      <span className="mkt-how-mark" aria-hidden="true">
        ?
      </span>
    </Link>
  )
}
