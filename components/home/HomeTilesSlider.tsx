'use client'

import { useRef, useState } from 'react'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { SLIDER_TILE_WIDTH_PX, TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

type Props = {
  title: string
  listings: HomeTileRow[]
  savedKeys: string[]
  likedKeys?: string[]
  signedIn: boolean
  userEmail?: string | null
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

export default function HomeTilesSlider({
  title,
  listings,
  savedKeys,
  likedKeys = [],
  signedIn,
  userEmail,
  downPaymentPercent,
  interestRate,
  loanTermYears,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  function updateScrollState() {
    const el = scrollRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  function scroll(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const step = el.clientWidth * 0.85
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' })
    setTimeout(updateScrollState, 300)
  }

  if (listings.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 sm:px-6" aria-labelledby={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`}>
      <div className="flex items-center justify-between gap-4">
        <h2 id={`${title.replace(/\s+/g, '-').toLowerCase()}-heading`} className="text-xl font-bold tracking-tight text-zinc-900">
          {title}
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => scroll('left')}
            disabled={!canScrollLeft}
            className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Scroll left"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            disabled={!canScrollRight}
            className="rounded-lg border border-zinc-200 bg-white p-2 text-zinc-600 shadow-sm transition hover:bg-zinc-50 disabled:opacity-40 disabled:pointer-events-none"
            aria-label="Scroll right"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="mt-4 flex gap-4 overflow-x-auto pb-2 scroll-smooth scrollbar-thin"
        style={{ scrollbarWidth: 'thin' }}
      >
        {listings.map((listing) => {
          const key = (listing.ListNumber ?? listing.ListingKey ?? '').toString().trim()
          const price = Number(listing.ListPrice ?? 0)
          const monthly =
            price > 0
              ? estimatedMonthlyPayment(price, downPaymentPercent, interestRate, loanTermYears)
              : null
          const monthlyPayment =
            monthly != null && monthly > 0 ? formatMonthlyPayment(monthly) : undefined
          return (
            <div
              key={key}
              className="shrink-0"
              style={{ width: SLIDER_TILE_WIDTH_PX, minHeight: TILE_MIN_HEIGHT_PX }}
            >
              <HomeTileCard
                listing={listing}
                listingKey={key}
                monthlyPayment={monthlyPayment}
                saved={signedIn ? savedKeys.includes(key) : undefined}
                liked={signedIn ? likedKeys.includes(key) : undefined}
                signedIn={signedIn}
                userEmail={userEmail}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
