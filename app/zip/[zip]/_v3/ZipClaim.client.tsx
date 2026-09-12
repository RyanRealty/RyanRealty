'use client'

/**
 * Claim-first sentence for the ZIP opening. V3Number (beui-number / rareui
 * animatedcounter) counts up the live inventory; reduced-motion settles.
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
    <p className="zip-opening__claim">
      <a href={href} className="zip-opening__claim-count">
        <V3Number value={count} formatted={formatted} startOnView={false} />
      </a>
      {` ${noun} for sale in ${zip} (${area}) right now.`}
    </p>
  )
}
