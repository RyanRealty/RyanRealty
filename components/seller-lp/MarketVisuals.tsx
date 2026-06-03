'use client'

import dynamic from 'next/dynamic'
import type { MarketVisualsProps } from './MarketVisuals.client'

/**
 * Server-safe wrapper for the seller-LP market visuals. Lazy-loads the recharts
 * island with ssr:false so the ~90kB chart bundle ships only on this route and
 * recharts never tries to measure a chart during SSR. Mirrors the pattern in
 * components/site/PriceChart.tsx.
 */
const Inner = dynamic(() => import('./MarketVisuals.client'), {
  ssr: false,
  loading: () => (
    <div className="space-y-5">
      <div
        className="h-72 w-full animate-pulse rounded-2xl border border-primary/10 bg-primary/5"
        aria-hidden
      />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-28 animate-pulse rounded-2xl border border-primary/10 bg-primary/5"
            aria-hidden
          />
        ))}
      </div>
    </div>
  ),
})

export default function MarketVisuals(props: MarketVisualsProps) {
  return <Inner {...props} />
}
