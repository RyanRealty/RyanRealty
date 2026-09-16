'use client'

/**
 * Claim-first sentence for the ZIP opening. DigitSwap is the catalog
 * number object (fixed glyph slots) so number-open still reads as the
 * demo when shots disable CSS animation. V3Number stays on the route
 * for G73 and publishes the sourced face to assistive tech.
 */

import { DigitSwap } from '@/components/motion/digit-swap'
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
    <p id="number-open" className="zip-opening__claim" data-demo-state="number-open">
      <a href={href} className="zip-opening__claim-count">
        <span aria-hidden="true">
          <DigitSwap
            value={formatted}
            animationKey={`zip-claim-${count}`}
            direction="up"
            className="zip-opening__claim-swap"
          />
        </span>
        <span className="sr-only">
          <V3Number value={count} formatted={formatted} startOnView={false} settle />
        </span>
      </a>
      {` ${noun} for sale in ${zip} (${area}) right now.`}
    </p>
  )
}
