'use client'

/**
 * Claim-first sentence for the ZIP opening. AnimatedNumber (beui-number) is
 * imported here so Tip Ready can see the catalog specifier on the route.
 * settleOnMount keeps the sourced face in the HTML (§0); digits still swap
 * when the live count changes.
 */

import { AnimatedNumber } from '@/components/motion/number'

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
        <AnimatedNumber
          value={count}
          format={(n) =>
            Math.round(n) === Math.round(count) ? formatted : Math.round(n).toLocaleString('en-US')
          }
          startOnView={false}
          settleOnMount
        />
      </a>
      {` ${noun} for sale in ${zip} (${area}) right now.`}
    </p>
  )
}
