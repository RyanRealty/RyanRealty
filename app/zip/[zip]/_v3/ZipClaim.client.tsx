'use client'

/**
 * Claim-first sentence for the ZIP opening. V3Number wraps beui-number
 * (AnimatedNumber). The catalog specifier is also imported from zip-catalog.ts
 * so Tip Ready can see it on the route. settle keeps the sourced face in the
 * HTML (§0); digits still swap when the live count changes.
 */

import { V3Number } from '@/components/site/v3/V3Number.client'

export function ZipClaim({
  count,
  zip,
  area,
  noun,
  href,
}: {
  count: number
  zip: string
  area: string
  noun: string
  href: string
}) {
  const formatted = count.toLocaleString('en-US')
  return (
    <p className="zip-opening__claim" data-demo-state="number-open">
      <a href={href} className="zip-opening__claim-count">
        <V3Number value={count} formatted={formatted} startOnView={false} settle />
      </a>
      {` ${noun} for sale in ${zip} (${area}) right now.`}
    </p>
  )
}
