// brand-voice:exempt
/**
 * HomepageMarketBand — 4-stat navy band between sections.
 *
 * Renders 4 live market figures on a navy background.
 * Stats come from getRegionPulse (passed as props from the server page).
 *
 * Count-up animation on the active count via useCountUp.
 * Reduced-motion: static final value rendered immediately.
 */
'use client'

import React, { useRef } from 'react'
import { cn } from '@/lib/utils'
import { Container } from '@/components/site/primitives'
import { useEngagementTracking } from '@/components/site/experience/useEngagementTracking'
import { useCountUp } from '@/components/site/experience/useCountUp'

function fmtCount(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  const k = Math.round(n / 1000) * 1000
  return `$${k.toLocaleString()}`
}

function fmtMoS(n: number | null): string {
  if (n == null) return '—'
  return `${n.toFixed(1)} mo`
}

type Props = {
  activeCount: number | null
  medianListPrice: number | null
  monthsOfSupply: number | null
  soldCount30d: number | null
}

export default function HomepageMarketBand({
  activeCount,
  medianListPrice,
  monthsOfSupply,
  soldCount30d,
}: Props) {
  const ref = useRef<HTMLDivElement>(null)
  useEngagementTracking('market-band', { ref, pageType: 'homepage', position: 4 })

  const { ref: countRef, displayValue: activeDisplay } = useCountUp(activeCount, {
    duration: 900,
    format: (n) => n.toLocaleString(),
  })

  const mosTip =
    monthsOfSupply != null
      ? monthsOfSupply <= 4
        ? "Seller's market"
        : monthsOfSupply >= 6
          ? "Buyer's market"
          : 'Balanced market'
      : null

  return (
    <div
      ref={ref}
      className="bg-primary text-primary-foreground py-12"
      aria-label="Central Oregon market statistics"
    >
      <Container>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-px">

          {/* Active SFR */}
          <div className="px-6 md:px-8 py-6 border-r border-white/8 md:first:border-l-0 last:border-r-0 hover:bg-white/4 transition-colors">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-2">
              Active SFR homes
            </p>
            <p
              ref={countRef as React.RefObject<HTMLParagraphElement>}
              className="font-display tabular-nums text-white leading-none mb-1"
              style={{ fontSize: 'clamp(2rem, 3vw, 3rem)', letterSpacing: '-0.02em' }}
            >
              {activeCount != null ? activeDisplay : '—'}
            </p>
            <p className="text-[12px] text-white/45">For sale now. Central Oregon</p>
          </div>

          {/* Median list price */}
          <div className="px-6 md:px-8 py-6 border-r border-white/8 hover:bg-white/4 transition-colors">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-2">
              Median list price
            </p>
            <p
              className="font-display tabular-nums text-white leading-none mb-1"
              style={{ fontSize: 'clamp(2rem, 3vw, 3rem)', letterSpacing: '-0.02em' }}
            >
              {fmtPrice(medianListPrice)}
            </p>
            <p className="text-[12px] text-white/45">Single-family homes</p>
          </div>

          {/* Months of supply */}
          <div className="px-6 md:px-8 py-6 border-r border-white/8 hover:bg-white/4 transition-colors">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-2">
              Months of supply
            </p>
            <p
              className="font-display tabular-nums text-white leading-none mb-1"
              style={{ fontSize: 'clamp(2rem, 3vw, 3rem)', letterSpacing: '-0.02em' }}
            >
              {fmtMoS(monthsOfSupply)}
            </p>
            {mosTip ? (
              <p className="text-[12px] text-white/45">{mosTip}</p>
            ) : null}
          </div>

          {/* Closed last 30 days */}
          <div className="px-6 md:px-8 py-6 hover:bg-white/4 transition-colors">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40 mb-2">
              Closed last 30 days
            </p>
            <p
              className="font-display tabular-nums text-white leading-none mb-1"
              style={{ fontSize: 'clamp(2rem, 3vw, 3rem)', letterSpacing: '-0.02em' }}
            >
              {soldCount30d != null ? soldCount30d.toLocaleString() : '—'}
            </p>
            <p className="text-[12px] text-white/45">
              <a href="/housing-market" className="hover:text-white transition-colors">
                Full market report &rarr;
              </a>
            </p>
          </div>
        </div>
      </Container>
    </div>
  )
}
