'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import ListingTile from './ListingTile'
import { Button } from '@/components/ui/button'
import { cityPagePath } from '@/lib/slug'
import { H2 } from '@/components/site/primitives'
import type { ListingTileRow } from '@/app/actions/listings'

const SCROLL_THRESHOLD = 4

type Props = {
  city: string
  listings: ListingTileRow[]
  savedKeys: string[]
  priceChangeKeys: Set<string>
  monthlyPayments: (string | undefined)[]
  signedIn: boolean
}

export default function HomeListingsSlider({
  city,
  listings,
  savedKeys,
  priceChangeKeys,
  monthlyPayments,
  signedIn,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)

  const updateScrollState = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    setCanScrollLeft(el.scrollLeft > SCROLL_THRESHOLD)
    setCanScrollRight(maxScroll > SCROLL_THRESHOLD && el.scrollLeft < maxScroll - SCROLL_THRESHOLD)
  }, [])

  const scrollTrack = useCallback((direction: 'left' | 'right') => {
    const el = scrollRef.current
    if (!el) return
    const step = el.clientWidth * 0.85
    el.scrollBy({ left: direction === 'left' ? -step : step, behavior: 'smooth' })
    setTimeout(updateScrollState, 350)
  }, [updateScrollState])

  useEffect(() => {
    updateScrollState()
  }, [listings.length, updateScrollState])

  if (listings.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6">
      <div className="flex items-end justify-between gap-4">
        <H2 className="text-2xl text-foreground">
          Recent & pending in {city}
        </H2>
        <Link
          href={cityPagePath(city)}
          className="text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          View all in {city} →
        </Link>
      </div>
      <div className="relative mt-6 -mx-4 px-4 sm:-mx-6 sm:px-6">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => scrollTrack('left')}
          disabled={!canScrollLeft}
          className="absolute left-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-r from-background to-transparent opacity-90 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
          aria-label="Scroll left"
        >
          <span className="rounded-full border border-border bg-card p-2 shadow-sm">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5 text-foreground" />
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => scrollTrack('right')}
          disabled={!canScrollRight}
          className="absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-l from-background to-transparent opacity-90 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
          aria-label="Scroll right"
        >
          <span className="rounded-full border border-border bg-card p-2 shadow-sm">
            <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5 text-foreground" />
          </span>
        </Button>
        <div
          ref={scrollRef}
          onScroll={updateScrollState}
          className="overflow-x-auto pb-4 scroll-smooth no-scrollbar flex gap-6 snap-x snap-mandatory"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          {listings.map((listing, i) => {
            const key = (listing.ListingKey ?? listing.ListNumber ?? `listing-${i}`).toString().trim()
            return (
              <div
                key={key}
                className="shrink-0 snap-start w-[85vw] min-w-[260px] max-w-[320px] sm:w-[50vw] sm:min-w-[280px] sm:max-w-[360px] lg:w-[33.333vw] lg:min-w-[300px] lg:max-w-[420px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <ListingTile
                  listing={listing}
                  listingKey={key}
                  priority={i < 3}
                  hasRecentPriceChange={key ? priceChangeKeys.has(key) : false}
                  saved={signedIn ? savedKeys.includes(key) : undefined}
                  monthlyPayment={monthlyPayments[i]}
                  signedIn={signedIn}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
