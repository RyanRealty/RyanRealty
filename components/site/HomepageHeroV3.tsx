// brand-voice:exempt
/**
 * HomepageHeroV3 — Experience System homepage hero
 *
 * Full-bleed canonical Old Mill photo with live market stats inside
 * the canvas (Amboqia display numerals), search field, and seller CTA.
 *
 * Stats come from getRegionPulse (server-rendered). Count-up animation
 * fires on mount. Ken Burns slow zoom anchored top so the American flag
 * stays visible.
 *
 * Reduced-motion: all animations disabled. Search still functions.
 */
'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState, useRef } from 'react'
import { cn } from '@/lib/utils'
import { DisplayHeading, Container } from '@/components/site/primitives'
import { useCountUp } from '@/components/site/experience/useCountUp'
import { useEngagementTracking } from '@/components/site/experience/useEngagementTracking'

function fmtCount(n: number | null): string {
  if (n == null) return '—'
  return n.toLocaleString()
}

function fmtPrice(n: number | null): string {
  if (n == null) return '—'
  const k = Math.round(n / 1000) * 1000
  return `$${k.toLocaleString()}`
}

function fmtDays(n: number | null): string {
  if (n == null) return '—'
  return `${Math.round(n)}`
}

type Props = {
  activeCount: number | null
  medianListPrice: number | null
  medianDaysToPending: number | null
  freshnessLabel: string | null
}

export default function HomepageHeroV3({
  activeCount,
  medianListPrice,
  medianDaysToPending,
  freshnessLabel,
}: Props) {
  const ref = useRef<HTMLElement>(null)
  useEngagementTracking('hero', { ref, pageType: 'homepage', position: 0 })

  const activeSpanRef = useRef<HTMLSpanElement | null>(null)
  const { displayValue: activeDisplay } = useCountUp(activeCount, {
    duration: 900,
    format: (n) => n.toLocaleString(),
    ref: activeSpanRef as unknown as React.RefObject<HTMLElement | null>,
  })

  const router = useRouter()
  const [query, setQuery] = useState('')

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    const q = query.trim()
    if (!q) return
    router.push(`/search?keywords=${encodeURIComponent(q)}`)
  }

  return (
    <section
      ref={ref}
      aria-label="Hero"
      className={cn(
        'relative flex flex-col justify-end overflow-hidden',
        'min-h-screen',
      )}
      style={{ paddingTop: 'max(88px, env(safe-area-inset-top))' }}
    >
      {/* Hero photo — canonical Old Mill master */}
      <div className="absolute inset-0 site-hero-kenburns">
        <Image
          src="/brand/hero/hero-old-mill-master-4k.jpg"
          alt="Old Mill District drone view with the American flag, the Deschutes River, and the Cascade mountains."
          fill
          priority
          sizes="100vw"
          className="object-cover"
          style={{ objectPosition: 'center 30%' }}
        />
      </div>

      {/* Top vignette — helps nav legibility */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background: 'linear-gradient(to bottom, rgba(16,39,66,0.40) 0%, transparent 18%)',
        }}
      />

      {/* Bottom scrim — protects text */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden
        style={{
          background:
            'linear-gradient(to top, rgba(16,39,66,0.84) 0%, rgba(16,39,66,0.54) 28%, rgba(16,39,66,0.18) 55%, rgba(16,39,66,0.0) 75%)',
        }}
      />

      {/* Content */}
      <div
        className="relative pb-14 md:pb-20 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8"
        style={{ animation: 'rr-fade-up 0.9s cubic-bezier(0.16,1,0.3,1) 0.15s both' }}
      >
        {/* Live indicator + freshness */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.08em] text-white/90"
            style={{
              background: 'rgba(255,255,255,0.10)',
              border: '1px solid rgba(255,255,255,0.20)',
            }}
          >
            <span
              className="inline-block w-[6px] h-[6px] rounded-full bg-green-400 flex-shrink-0"
              style={{
                boxShadow: '0 0 0 2px rgba(74,222,128,0.30)',
                animation: 'rr-pulse-dot 2s ease-in-out infinite',
              }}
              aria-hidden
            />
            Live. Central Oregon SFR
          </span>
          {freshnessLabel ? (
            <span className="text-[11px] font-medium text-white/45 uppercase tracking-[0.06em]">
              {freshnessLabel}
            </span>
          ) : null}
        </div>

        {/* Three core market numbers */}
        <div
          className="flex items-end gap-8 md:gap-12 flex-wrap mb-8"
          aria-label="Live Central Oregon market statistics"
        >
          {activeCount != null ? (
            <div className="flex flex-col gap-0.5">
              <span
                ref={activeSpanRef}
                className="font-display tabular-nums text-white leading-none"
                style={{
                  fontSize: 'clamp(2.8rem, 5vw, 4.5rem)',
                  letterSpacing: '-0.02em',
                  textShadow: '0 2px 20px rgba(0,0,0,0.25)',
                  animation: 'rr-stat-reveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.35s both',
                }}
                aria-label={`${fmtCount(activeCount)} homes for sale`}
              >
                {activeDisplay}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/58">
                Homes for sale
              </span>
            </div>
          ) : null}

          {activeCount != null && medianListPrice != null ? (
            <div
              className="w-px h-14 self-center flex-shrink-0 hidden sm:block"
              aria-hidden
              style={{ background: 'rgba(255,255,255,0.18)' }}
            />
          ) : null}

          {medianListPrice != null ? (
            <div className="flex flex-col gap-0.5">
              <span
                className="font-display tabular-nums text-white leading-none"
                style={{
                  fontSize: 'clamp(2.8rem, 5vw, 4.5rem)',
                  letterSpacing: '-0.02em',
                  textShadow: '0 2px 20px rgba(0,0,0,0.25)',
                  animation: 'rr-stat-reveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.50s both',
                }}
                aria-label={`${fmtPrice(medianListPrice)} median list price`}
              >
                {fmtPrice(medianListPrice)}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/58">
                Median list price
              </span>
            </div>
          ) : null}

          {medianDaysToPending != null ? (
            <>
              <div
                className="w-px h-14 self-center flex-shrink-0 hidden sm:block"
                aria-hidden
                style={{ background: 'rgba(255,255,255,0.18)' }}
              />
              <div className="flex flex-col gap-0.5">
                <span
                  className="font-display tabular-nums text-white leading-none"
                  style={{
                    fontSize: 'clamp(2.8rem, 5vw, 4.5rem)',
                    letterSpacing: '-0.02em',
                    textShadow: '0 2px 20px rgba(0,0,0,0.25)',
                    animation: 'rr-stat-reveal 0.8s cubic-bezier(0.16,1,0.3,1) 0.65s both',
                  }}
                  aria-label={`${fmtDays(medianDaysToPending)} days to pending`}
                >
                  {fmtDays(medianDaysToPending)}
                </span>
                <span className="text-[11px] font-medium uppercase tracking-[0.08em] text-white/58">
                  Days to pending
                </span>
              </div>
            </>
          ) : null}
        </div>

        {/* H1 */}
        <DisplayHeading
          as="h1"
          className="text-white max-w-[560px] mb-8"
          style={{
            fontSize: 'clamp(1.75rem, 3.5vw, 2.75rem)',
            letterSpacing: '-0.01em',
            lineHeight: 1.2,
            textShadow: '0 1px 12px rgba(0,0,0,0.20)',
          }}
        >
          Every listing in Central Oregon, watched daily.
        </DisplayHeading>

        {/* Search field */}
        <form
          onSubmit={handleSearch}
          role="search"
          className="flex items-center max-w-[560px] rounded-xl shadow-2xl overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.97)',
            padding: '6px 6px 6px 20px',
            gap: '12px',
          }}
        >
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, neighborhood, or address"
            aria-label="Search homes for sale in Central Oregon"
            className="flex-1 min-w-0 border-0 outline-none bg-transparent text-[15px] text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="flex-shrink-0 px-5 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/85 active:translate-y-px transition-all"
          >
            Search homes
          </button>
        </form>

        {/* Seller CTA */}
        <div className="flex items-center gap-6 mt-5 flex-wrap">
          <a
            href="/lp/seller-home-value"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white/90 rounded-lg transition-all hover:bg-white/20 hover:text-white"
            style={{
              background: 'rgba(255,255,255,0.12)',
              border: '1px solid rgba(255,255,255,0.28)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            What is your home worth?
          </a>
          <span className="text-[12px] font-medium uppercase tracking-[0.06em] text-white/42 hidden sm:block" aria-hidden>
            scroll to explore
          </span>
        </div>
      </div>

      {/* Keyframe definitions */}
      <style>{`
        @keyframes rr-pulse-dot {
          0%, 100% { box-shadow: 0 0 0 2px rgba(74,222,128,0.30); }
          50%       { box-shadow: 0 0 0 5px rgba(74,222,128,0.15); }
        }
        @keyframes rr-stat-reveal {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes rr-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          [style*="rr-fade-up"], [style*="rr-stat-reveal"] {
            animation: none !important; opacity: 1 !important; transform: none !important;
          }
        }
      `}</style>
    </section>
  )
}
