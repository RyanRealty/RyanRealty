'use client'

import { useRef, useEffect, useState } from 'react'
import Link from 'next/link'
import HomeTileCard from './HomeTileCard'
import type { HomeTileRow } from '@/app/actions/listings'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { trackEvent } from '@/lib/tracking'
import { SLIDER_TILE_WIDTH_PX, TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

type Props = {
  listings: HomeTileRow[]
  savedKeys: string[]
  likedKeys: string[]
  signedIn: boolean
  userEmail?: string | null
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

export default function FeaturedListings({
  listings,
  savedKeys,
  likedKeys,
  signedIn,
  userEmail,
  downPaymentPercent,
  interestRate,
  loanTermYears,
}: Props) {
  const sectionRef = useRef<HTMLElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sentRef = useRef(false)
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
    el.scrollBy({ left: direction === 'left' ? -SLIDER_TILE_WIDTH_PX - 16 : SLIDER_TILE_WIDTH_PX + 16, behavior: 'smooth' })
    setTimeout(updateScrollState, 300)
  }

  useEffect(() => {
    if (sentRef.current || !sectionRef.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          sentRef.current = true
          trackEvent('featured_impression', {})
          trackEvent('view_featured_listings', { count: listings.length })
        }
      },
      { threshold: 0.2 }
    )
    io.observe(sectionRef.current)
    return () => io.disconnect()
  }, [listings.length])

  useEffect(() => {
    updateScrollState()
  }, [listings.length])

  if (listings.length === 0) return null

  return (
    <section
      ref={sectionRef}
      className="bg-white px-4 py-12 sm:px-6 sm:py-16"
      aria-labelledby="featured-listings-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between gap-4">
          <h2 id="featured-listings-heading" className="text-2xl font-bold tracking-tight text-[var(--brand-navy)]">
            Featured Homes
          </h2>
          <div className="flex items-center gap-2">
            <div className="flex gap-1 md:hidden" aria-hidden="true">
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="rounded-lg border border-[var(--color-border)] bg-white p-2 text-[var(--color-text-secondary)] shadow-sm transition hover:bg-[var(--color-bg-subtle)] disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]"
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
                className="rounded-lg border border-[var(--color-border)] bg-white p-2 text-[var(--color-text-secondary)] shadow-sm transition hover:bg-[var(--color-bg-subtle)] disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-cta)]"
                aria-label="Scroll right"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <Link
              href="/search"
              onClick={() => trackEvent('click_cta', { cta_location: 'featured_view_all' })}
              className="text-sm font-semibold text-[var(--accent)] hover:text-[var(--accent-hover)]"
            >
              View All
            </Link>
          </div>
        </div>
        <div className="relative mt-6">
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex gap-4 overflow-x-auto pb-2 scroll-smooth md:grid md:grid-cols-3 md:overflow-visible"
            style={{ scrollbarWidth: 'thin' }}
          >
            {listings.map((listing) => {
              const key = listing.ListingKey ?? listing.ListNumber ?? ''
              const monthly = estimatedMonthlyPayment(
                listing.ListPrice ?? 0,
                downPaymentPercent,
                interestRate,
                loanTermYears
              )
              return (
                <div
                  key={key}
                  className="shrink-0 md:min-w-0"
                  style={{ width: SLIDER_TILE_WIDTH_PX, minHeight: TILE_MIN_HEIGHT_PX }}
                >
                  <HomeTileCard
                    listing={listing}
                    listingKey={String(key)}
                    monthlyPayment={formatMonthlyPayment(monthly)}
                    saved={signedIn && savedKeys.includes(String(key))}
                    liked={signedIn && likedKeys.includes(String(key))}
                    signedIn={signedIn}
                    userEmail={userEmail}
                  />
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </section>
  )
}
