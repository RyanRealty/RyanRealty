/**
 * LiveMarketBand -- Experience System shared module (v2, de-tiled)
 *
 * Navy full-width band. One GIANT living number owns the band (active homes
 * count, Amboqia ~clamp 4-7rem) with the other three stats set small in a
 * single quiet line beside/below it. No four equal stat cells.
 *
 * The hero stat (activeCount) animates via useCountUp on viewport entry.
 * Other stats are rendered statically at final value.
 *
 * Overlap moment: The band visually overlaps the bottom of the hero by 3rem
 * (negative top margin applied from the parent page). This is controlled by
 * the parent, not this component.
 *
 * Data comes from the parent page's DAL call (getMarketPulse); stats are
 * passed as props -- this component has no data fetching of its own.
 *
 * Props:
 *   heroStat    -- the giant living number (activeCount is canonical)
 *   heroLabel   -- label below the giant number
 *   auxStats    -- up to 3 quieter stats { label, value, unit? }
 *   marketVerdict  -- optional "seller" | "balanced" | "buyer"
 *   reportHref     -- link to the full market report
 *   reportLabel    -- link text
 *   sectionId      -- passed to useEngagementTracking (defaults to 'market-band')
 */
'use client'

import Link from 'next/link'
import { useRef } from 'react'
import { cn } from '@/lib/utils'
import { DisplayHeading } from '@/components/site/primitives'
import { useEngagementTracking } from './useEngagementTracking'
import { useCountUp } from './useCountUp'

type AuxStat = {
  label: string
  value: string | number | null
  unit?: string
}

type Props = {
  /** The ONE giant living number (canonical: active listing count). */
  heroStat: number | null
  heroLabel?: string
  /** Up to 3 quieter supporting stats. Pass ONLY verified values — a shorter
   *  array is rendered as-is rather than padded with null/`—` (data-accuracy). */
  auxStats?: AuxStat[]
  marketVerdict?: 'seller' | 'balanced' | 'buyer' | null
  reportHref?: string
  reportLabel?: string
  sectionId?: string
  className?: string
  /**
   * Legacy compat: the 4-stat array used by the prior LiveMarketBand API.
   * If supplied, heroStat + auxStats are derived from this array:
   *   stats[0] -> heroStat (numeric portion), stats[1-3] -> auxStats.
   */
  stats?: [AuxStat, AuxStat, AuxStat, AuxStat]
}

const VERDICT_CONFIG = {
  seller: { text: "Seller's market", dot: 'bg-red-400' },
  balanced: { text: 'Balanced market', dot: 'bg-amber-400' },
  buyer: { text: "Buyer's market", dot: 'bg-blue-400' },
}

function fmtValue(v: string | number | null): string {
  if (v == null) return '—'
  if (typeof v === 'string') return v
  return v.toLocaleString()
}

export function LiveMarketBand({
  heroStat: heroStatProp,
  heroLabel = 'Active homes',
  auxStats: auxStatsProp,
  marketVerdict,
  reportHref,
  reportLabel = 'Full market report',
  sectionId = 'market-band',
  className,
  // Legacy compat
  stats,
}: Props) {
  const sectionRef = useRef<HTMLDivElement>(null)
  useEngagementTracking(sectionId, { ref: sectionRef, pageType: 'geo', position: 1 })

  // Resolve hero + aux from either the new API or the legacy 4-stat array
  let heroStat: number | null = heroStatProp ?? null
  let auxStats: AuxStat[] | undefined = auxStatsProp

  if (stats && !auxStatsProp) {
    // Legacy: derive heroStat from stats[0].value (numeric)
    const raw = stats[0].value
    if (typeof raw === 'number') heroStat = raw
    else if (typeof raw === 'string') {
      const parsed = Number(raw.replace(/[^0-9.]/g, ''))
      if (!Number.isNaN(parsed)) heroStat = parsed
    }
    auxStats = [stats[1], stats[2], stats[3]]
  }

  // Count-up animation on the hero stat
  const heroSpanRef = useRef<HTMLSpanElement | null>(null)
  const heroElementRef = heroSpanRef as React.RefObject<HTMLElement | null>
  const { ref: countRef, displayValue: heroDisplay } = useCountUp(
    typeof heroStat === 'number' ? heroStat : null,
    {
      duration: 900,
      format: (n) => n.toLocaleString(),
      ref: heroElementRef,
    },
  )

  const verdict = marketVerdict ? VERDICT_CONFIG[marketVerdict] : null

  return (
    <div
      ref={sectionRef}
      className={cn('bg-primary text-primary-foreground relative', className)}
      aria-label="Live market stats"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-7 md:py-9">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          {/* Hero stat -- one giant living number */}
          <div className="flex flex-col gap-1 md:flex-row md:items-end md:gap-8">
            <div className="flex flex-col gap-0">
              <span
                ref={countRef}
                className="font-display tabular-nums text-white leading-none"
                style={{
                  fontSize: 'clamp(3.5rem, 7vw, 6rem)',
                  letterSpacing: '-0.025em',
                  textShadow: '0 1px 12px rgba(0,0,0,0.18)',
                }}
              >
                {heroStat != null ? heroDisplay : '—'}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.09em] text-white/55 mt-1.5">
                {heroLabel}
              </span>
            </div>

            {/* Quiet supporting stats -- small, inline */}
            {auxStats ? (
              <div
                className="flex items-center gap-5 flex-wrap md:mb-2"
                aria-label="Supporting market stats"
              >
                {auxStats.map((stat, i) => (
                  <div key={i} className="flex flex-col gap-0.5">
                    <span className="tabular-nums font-medium text-white/90 leading-none"
                      style={{ fontSize: 'clamp(0.95rem, 1.6vw, 1.2rem)' }}>
                      {fmtValue(stat.value)}
                      {stat.unit ? (
                        <span className="text-white/48 text-[11px] font-normal ml-0.5">{stat.unit}</span>
                      ) : null}
                    </span>
                    <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-white/42 mt-0.5">
                      {stat.label}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {/* Right: verdict badge + report link */}
          <div className="flex items-center gap-4 flex-shrink-0 flex-wrap">
            {verdict ? (
              <div className="flex items-center gap-2">
                <span className={cn('inline-block w-2 h-2 rounded-full flex-shrink-0', verdict.dot)} aria-hidden />
                <span className="text-sm font-medium text-white/78">{verdict.text}</span>
              </div>
            ) : null}
            {reportHref ? (
              <Link
                href={reportHref}
                className="text-sm font-semibold text-white/65 hover:text-white transition-colors whitespace-nowrap border-l border-white/18 pl-4"
              >
                {reportLabel} &rarr;
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
