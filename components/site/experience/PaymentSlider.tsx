/**
 * PaymentSlider -- Experience System shared module
 *
 * Inline payment estimator with a price-range slider around the community
 * median. Recomputes estimated monthly P&I live using lib/mortgage.ts math.
 *
 * Per CLAUDE.md §0 Data Accuracy: the assumption text MUST state the rate and
 * term used. The component renders: "Est. P&I at {rate}%, 20% down, 30 yr."
 * This is clearly labeled as an estimate, not a quote.
 *
 * Engagement: fires `payment_slide` module_interact event on first slide.
 *
 * Props:
 *   medianPrice -- community median list price (from pulse DAL). If null,
 *                  the slider is not rendered (no data).
 *   label       -- community name for context label
 *   sectionId   -- passed to useEngagementTracking
 */
// brand-voice:exempt -- UI component; rate disclosure required
'use client'

import { useState, useCallback, useRef, useId } from 'react'
import { cn } from '@/lib/utils'
import { DisplayHeading } from '@/components/site/primitives'
import { useEngagementTracking } from './useEngagementTracking'
import {
  estimatedMonthlyPayment,
  formatMonthlyPayment,
  DEFAULT_DISPLAY_RATE,
  DEFAULT_DISPLAY_DOWN_PCT,
  DEFAULT_DISPLAY_TERM_YEARS,
} from '@/lib/mortgage'
import { CONTACT } from '@/lib/brand/contact'

type Props = {
  medianPrice: number | null
  label?: string
  sectionId?: string
  className?: string
}

function roundTo50k(n: number): number {
  return Math.round(n / 50000) * 50000
}

export function PaymentSlider({ medianPrice, label, sectionId = 'payment-slider', className }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const { trackInteract } = useEngagementTracking(sectionId, { ref, pageType: 'geo', position: 6 })
  const sliderId = useId()

  // Derive a sensible range around the median
  const center = medianPrice != null ? roundTo50k(medianPrice) : null
  const rangeMin = center != null ? Math.max(100000, center - 400000) : 200000
  const rangeMax = center != null ? center + 600000 : 2000000
  const defaultPrice = center ?? 750000

  const [price, setPrice] = useState(defaultPrice)
  const hasTracked = useRef(false)

  const monthly = estimatedMonthlyPayment(
    price,
    DEFAULT_DISPLAY_DOWN_PCT,
    DEFAULT_DISPLAY_RATE,
    DEFAULT_DISPLAY_TERM_YEARS,
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = Number(e.target.value)
      setPrice(v)
      if (!hasTracked.current) {
        hasTracked.current = true
        trackInteract('payment_slide')
      }
    },
    [trackInteract],
  )

  if (medianPrice == null) return null

  const priceFmt = `$${Math.round(price / 1000).toLocaleString()}K`

  return (
    <div ref={ref} className={cn('', className)}>
      {/* Readout */}
      <div className="flex items-baseline gap-4 flex-wrap mb-4">
        <DisplayHeading
          as="div"
          className="tabular-nums text-foreground leading-none"
          style={{ fontSize: 'clamp(1.9rem, 3.2vw, 2.5rem)', letterSpacing: '-0.02em' }}
        >
          {formatMonthlyPayment(monthly)}
          <span className="text-base font-sans text-muted-foreground font-normal ml-1">/mo</span>
        </DisplayHeading>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold uppercase tracking-[0.09em] text-muted-foreground">
            Est. monthly payment
          </span>
          <span className="text-xs text-muted-foreground tabular-nums">
            {priceFmt} home, {DEFAULT_DISPLAY_DOWN_PCT}% down, {DEFAULT_DISPLAY_RATE}% rate, {DEFAULT_DISPLAY_TERM_YEARS} yr fixed
          </span>
        </div>
      </div>

      {/* Slider */}
      <div className="relative">
        <label htmlFor={sliderId} className="sr-only">
          Estimate payment for home price
        </label>
        <input
          id={sliderId}
          type="range"
          min={rangeMin}
          max={rangeMax}
          step={25000}
          value={price}
          onChange={handleChange}
          className="w-full h-1.5 rounded-full cursor-pointer appearance-none"
          style={{
            background: `linear-gradient(to right, #102742 0%, #102742 ${((price - rangeMin) / (rangeMax - rangeMin)) * 100}%, rgba(16,39,66,0.14) ${((price - rangeMin) / (rangeMax - rangeMin)) * 100}%, rgba(16,39,66,0.14) 100%)`,
          }}
          aria-valuetext={priceFmt}
        />
        {/* Range labels */}
        <div className="flex justify-between mt-1.5 text-[11px] tabular-nums text-muted-foreground">
          <span>${Math.round(rangeMin / 1000).toLocaleString()}K</span>
          <span className="font-medium text-foreground">{priceFmt}</span>
          <span>${Math.round(rangeMax / 1000).toLocaleString()}K</span>
        </div>
      </div>

      {/* Disclosure */}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Principal and interest estimate only. Does not include taxes, insurance, or HOA.
        {label ? ` Based on ${label} median list price.` : ''}{' '}
        Contact us for a personalized quote at {CONTACT.phoneDirect}.
      </p>
    </div>
  )
}
