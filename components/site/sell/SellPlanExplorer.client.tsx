'use client'

/**
 * SellPlanExplorer — the interactive centerpiece of /sell. One navy panel, one
 * decision. Pick a tier and the price morphs, a marketing-reach meter animates,
 * the count of services counts up, and the differentiators reveal in a stagger.
 *
 * WHY: the seller page has to feel like proof, not a brochure. This is the one
 * cinematic moment. The three plans stop being a static table and become a dial
 * the seller turns.
 *
 * DATA ACCURACY (CLAUDE.md §0): the "services" numbers are exact counts of the
 * checked rows in each tier of the Ryan Realty Select Seller Plans document
 * (Essential 13, Enhanced 26, Elite 31 of 31 total). The reach meter is that
 * count as a share of the full plan. No invented figures, no third-party stats.
 *
 * MOTION: CSS transitions + rAF count-up. Respects prefers-reduced-motion (the
 * panel renders fully populated and static). No animation library.
 *
 * TOKENS: design-token colors only (navy = bg-primary, cream = primary-
 * foreground), font-display for Amboqia, locked size ladder, no raw controls.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { CTAButton, Eyebrow } from '@/components/site/primitives'
import { cn } from '@/lib/utils'

const VALUATION_HREF = '/lp/seller-home-value'
const TOTAL_SERVICES = 31

type Tier = {
  name: string
  rate: string
  tagline: string
  services: number
  reachPct: number
  addsLabel: string
  adds: string[]
}

const TIERS: Tier[] = [
  {
    name: 'Essential',
    rate: '2.5%',
    tagline: 'List for less, keep what sells a home.',
    services: 13,
    reachPct: 42,
    addsLabel: 'What you get',
    adds: [
      'Professional photography and a 3D walkthrough',
      'Local MLS plus Zillow, Redfin and Trulia',
      'A written CMA and an independent transaction coordinator',
      'One broker and a written report every week, through close',
    ],
  },
  {
    name: 'Enhanced',
    rate: '3%',
    tagline: 'The full-court press. What most homes get.',
    services: 26,
    reachPct: 84,
    addsLabel: 'Everything in Essential, plus',
    adds: [
      'Aerial drone video and a cinematic walkthrough',
      'Open houses, a broker tour, and virtual staging',
      'Social posts and short-form video on @ryanrealtybend',
      'Outreach to 300 neighbors and thousands of local agents',
    ],
  },
  {
    name: 'Elite',
    rate: '3.5%',
    tagline: 'Every channel, turned all the way up.',
    services: 31,
    reachPct: 100,
    addsLabel: 'Everything in Enhanced, plus',
    adds: [
      'A pre-listing inspection and a professional stager',
      'Placement in Bend Magazine and paid Facebook and Instagram',
      'A home warranty that takes repair worry off the buyer',
      'Outreach to 50 top agents in Portland, Seattle, LA and SF',
    ],
  },
]

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/** rAF count-up toward `target`, reduced-motion aware. */
function useCountUp(target: number, durationMs = 700) {
  const [value, setValue] = useState(target)
  const fromRef = useRef(target)
  const rafRef = useRef(0)

  useEffect(() => {
    if (prefersReducedMotion()) {
      setValue(target)
      fromRef.current = target
      return
    }
    const from = fromRef.current
    if (from === target) return
    const start = performance.now()
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - Math.pow(1 - t, 3)
      setValue(Math.round(from + (target - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, durationMs])

  return value
}

function Check() {
  return (
    <svg aria-hidden viewBox="0 0 20 20" className="mt-0.5 h-5 w-5 shrink-0 text-primary-foreground" fill="none">
      <circle cx="10" cy="10" r="9" className="fill-primary-foreground/15" />
      <path d="M6 10.5l2.5 2.5L14 7" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export function SellPlanExplorer() {
  const [active, setActive] = useState(1) // Enhanced by default
  const tier = TIERS[active]!
  const count = useCountUp(tier.services)

  const onKey = useCallback((e: React.KeyboardEvent, i: number) => {
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault()
      setActive((i + 1) % TIERS.length)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i - 1 + TIERS.length) % TIERS.length)
    }
  }, [])

  return (
    <div className="overflow-hidden rounded-[14px] bg-primary text-primary-foreground">
      <div className="flex flex-col gap-6 p-6 sm:p-8 lg:p-10">
        {/* Header + selector */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Eyebrow className="text-primary-foreground/70">Turn the dial</Eyebrow>
            <p className="mt-1 text-base font-medium text-primary-foreground/80">
              Pick a plan. Watch the reach change.
            </p>
          </div>
          <div
            role="radiogroup"
            aria-label="Choose a plan"
            className="inline-flex self-start rounded-[10px] border border-primary-foreground/20 p-1"
          >
            {TIERS.map((t, i) => (
              <div
                key={t.name}
                role="radio"
                aria-checked={active === i}
                tabIndex={active === i ? 0 : -1}
                onClick={() => setActive(i)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setActive(i) }
                  else onKey(e, i)
                }}
                className={cn(
                  'cursor-pointer select-none rounded-[10px] px-4 py-2 text-sm font-semibold tabular-nums transition',
                  active === i
                    ? 'bg-primary-foreground text-primary'
                    : 'text-primary-foreground/70 hover:text-primary-foreground',
                )}
              >
                <span className="hidden sm:inline">{t.name}&nbsp;</span>
                {t.rate}
              </div>
            ))}
          </div>
        </div>

        {/* Stage */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-12">
          {/* Left: morphing price + CTA */}
          <div className="flex flex-col">
            <div className="flex items-start gap-3">
              <span
                key={tier.rate}
                className="font-display text-7xl leading-none tabular-nums text-primary-foreground sm:text-8xl motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
              >
                {tier.rate}
              </span>
              <span className="mt-2 text-sm font-semibold uppercase tracking-widest text-primary-foreground/70">
                {tier.name}
              </span>
            </div>
            <p className="mt-4 max-w-md text-lg font-semibold leading-snug text-primary-foreground">
              {tier.tagline}
            </p>

            {/* Reach meter */}
            <div className="mt-8">
              <div className="flex items-baseline justify-between">
                <span className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/70">
                  Marketing reach
                </span>
                <span className="text-sm font-semibold tabular-nums text-primary-foreground/80">
                  <span className="font-display text-2xl text-primary-foreground">{count}</span>
                  <span> of {TOTAL_SERVICES} services</span>
                </span>
              </div>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-primary-foreground/15">
                <div
                  className="h-full rounded-full bg-primary-foreground transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${tier.reachPct}%` }}
                />
              </div>
            </div>

            <div className="mt-8">
              <CTAButton href={VALUATION_HREF} tone="on-navy" size="lg">
                Get your free valuation
              </CTAButton>
            </div>
          </div>

          {/* Right: what this tier gives, staggered */}
          <div className="lg:border-l lg:border-primary-foreground/15 lg:pl-12">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary-foreground/70">
              {tier.addsLabel}
            </p>
            {/* Keyed by tier so the list re-animates on switch. Transform-only
                entrance (no opacity fade): content is never gated on the
                animation running, so a hidden/backgrounded tab that pauses the
                animation clock still shows every line. */}
            <ul key={active} className="mt-4 flex flex-col gap-4">
              {tier.adds.map((item) => (
                <li
                  key={item}
                  className="flex gap-3 motion-safe:animate-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
                >
                  <Check />
                  <span className="text-base leading-snug text-primary-foreground/90">{item}</span>
                </li>
              ))}
            </ul>
            <p className="mt-6 text-sm text-primary-foreground/60">
              Every plan runs on the same schedule, the same weekly report, and
              the same comps behind your price. What changes is the reach.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
