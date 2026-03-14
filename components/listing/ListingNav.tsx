'use client'

import Link from 'next/link'
import { useRef, useState, useEffect } from 'react'
import type { AdjacentListingThumb } from '@/app/actions/listings'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, Camera01Icon } from '@hugeicons/core-free-icons'
import { Button } from "@/components/ui/button"

type SliceShape = { prevList: AdjacentListingThumb[]; nextList: AdjacentListingThumb[] }

type Props = {
  listingKey: string
  prevKey: string | null
  nextKey: string | null
  prevListing?: AdjacentListingThumb | null
  nextListing?: AdjacentListingThumb | null
  adjacentSlice?: SliceShape
  currentThumb?: AdjacentListingThumb
}

function formatPrice(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n) || n <= 0) return ''
  return `$${Number(n).toLocaleString()}`
}

function addressOneLine(listing: AdjacentListingThumb): string {
  const parts = [listing.StreetNumber, listing.StreetName].filter(Boolean).join(' ')
  return parts || listing.City || ''
}

const arrowBtnClass =
  'flex shrink-0 items-center justify-center rounded-lg border border-border bg-card p-2 text-muted-foreground shadow-sm transition hover:border-border hover:bg-muted hover:text-muted-foreground disabled:opacity-40 disabled:pointer-events-none'

function PrevNextCard({
  listing,
  label,
  direction,
}: {
  listing: AdjacentListingThumb
  label: string
  direction: 'prev' | 'next'
}) {
  const href = `/listing/${encodeURIComponent(listing.ListingKey)}`
  const content = (
    <>
      <div className="relative h-12 w-16 shrink-0 overflow-hidden bg-muted">
        {listing.PhotoURL ? (
          <img
            src={listing.PhotoURL}
            alt={`${addressOneLine(listing) || 'Property'} photo`}
            className="h-full w-full object-cover"
            width={64}
            height={48}
            decoding="async"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            <HugeiconsIcon icon={Camera01Icon} className="h-6 w-6" />
          </div>
        )}
      </div>
      <div className="min-w-0 py-1.5 pr-2 pl-0">
        <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
        {listing.ListPrice != null && listing.ListPrice > 0 && (
          <p className="text-sm font-semibold text-foreground truncate">{formatPrice(listing.ListPrice)}</p>
        )}
        {(addressOneLine(listing) || listing.City) && (
          <p className="text-xs text-muted-foreground truncate">{addressOneLine(listing) || listing.City}</p>
        )}
      </div>
    </>
  )
  if (direction === 'next') {
    return (
      <Link
        href={href}
        className="flex min-w-0 max-w-[200px] sm:max-w-[240px] items-center gap-2 overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:border-border hover:shadow"
      >
        <div className="min-w-0 py-1.5 pl-2 pr-0 text-right">
          <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
          {listing.ListPrice != null && listing.ListPrice > 0 && (
            <p className="text-sm font-semibold text-foreground truncate">{formatPrice(listing.ListPrice)}</p>
          )}
          {(addressOneLine(listing) || listing.City) && (
            <p className="text-xs text-muted-foreground truncate">{addressOneLine(listing) || listing.City}</p>
          )}
        </div>
        <div className="relative h-12 w-16 shrink-0 overflow-hidden bg-muted">
          {listing.PhotoURL ? (
            <img
              src={listing.PhotoURL}
              alt={`${addressOneLine(listing) || 'Property'} photo`}
              className="h-full w-full object-cover"
              width={64}
              height={48}
              decoding="async"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
              <HugeiconsIcon icon={Camera01Icon} className="h-6 w-6" />
            </div>
          )}
        </div>
      </Link>
    )
  }
  return (
    <Link
      href={href}
      className="flex min-w-0 max-w-[200px] sm:max-w-[240px] items-center gap-2 overflow-hidden rounded-lg border border-border bg-card shadow-sm transition hover:border-border hover:shadow"
    >
      {content}
    </Link>
  )
}

export default function ListingNav({
  listingKey,
  prevKey,
  nextKey,
  prevListing,
  nextListing,
  adjacentSlice,
  currentThumb,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)

  const hasSlice =
    adjacentSlice &&
    currentThumb &&
    (adjacentSlice.prevList.length > 0 || adjacentSlice.nextList.length > 0)

  const items: AdjacentListingThumb[] = hasSlice
    ? [
        ...[...(adjacentSlice!.prevList)].reverse(),
        currentThumb!,
        ...(adjacentSlice!.nextList),
      ]
    : []

  function updateScrollState() {
    const el = scrollRef.current
    if (!el) return
    const overflow = el.scrollWidth > el.clientWidth
    setHasOverflow(overflow)
    setCanScrollLeft(el.scrollLeft > 4)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  const THRESHOLD = 4

  function scrollStrip(direction: 'left' | 'right') {
    const el = scrollRef.current
    if (!el) return
    const maxScroll = el.scrollWidth - el.clientWidth
    if (maxScroll <= 0) return
    if (direction === 'right') {
      if (el.scrollLeft >= maxScroll - THRESHOLD) {
        el.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: el.clientWidth * 0.6, behavior: 'smooth' })
      }
    } else {
      if (el.scrollLeft <= THRESHOLD) {
        el.scrollTo({ left: maxScroll, behavior: 'smooth' })
      } else {
        el.scrollBy({ left: -(el.clientWidth * 0.6), behavior: 'smooth' })
      }
    }
    setTimeout(updateScrollState, 350)
  }

  useEffect(() => {
    if (!hasSlice) return
    updateScrollState()
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(updateScrollState)
    ro.observe(el)
    return () => ro.disconnect()
  }, [hasSlice, items.length])

  if (hasSlice && items.length > 0) {
    return (
      <nav className="flex flex-1 min-w-0 items-center" aria-label="Listings in this community">
        {/* Scrollable strip: hover-overlay arrows only (same as city/community sliders) */}
        <div className="group/strip relative flex min-w-0 flex-1 items-center">
          <Button
            type="button"
            onClick={() => scrollStrip('left')}
            disabled={!hasOverflow}
            className="absolute left-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-r from-black/30 to-transparent opacity-0 transition-opacity group-hover/strip:opacity-100 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
            aria-label="Scroll listings left"
          >
            <span className="rounded-full bg-card/90 p-2 shadow">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 text-foreground" />
            </span>
          </Button>
          <Button
            type="button"
            onClick={() => scrollStrip('right')}
            disabled={!hasOverflow}
            className="absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-l from-black/30 to-transparent opacity-0 transition-opacity group-hover/strip:opacity-100 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
            aria-label="Scroll listings right"
          >
            <span className="rounded-full bg-card/90 p-2 shadow">
              <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4 text-foreground" />
            </span>
          </Button>
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className="flex gap-2 overflow-x-auto py-1 scroll-smooth [scroll-snap-type:x_mandatory] [&::-webkit-scrollbar]:h-1.5 [&::-webkit-scrollbar-track]:bg-muted [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border"
          >
            {items.map((item) => {
              const isCurrent = item.ListingKey === listingKey
              const href = `/listing/${encodeURIComponent(item.ListingKey)}`
              return (
                <Link
                  key={item.ListingKey}
                  href={href}
                  className={`flex shrink-0 scroll-snap-align-center gap-2 overflow-hidden rounded-lg border bg-card shadow-sm transition hover:shadow min-w-[140px] max-w-[160px] ${
                    isCurrent
                      ? 'border-accent ring-2 ring-accent ring-offset-1'
                      : 'border-border hover:border-border'
                  }`}
                >
                  <div className="relative h-10 w-14 shrink-0 overflow-hidden bg-muted">
                    {item.PhotoURL ? (
                      <img
                        src={item.PhotoURL}
                        alt={`${addressOneLine(item) || 'Property'} photo`}
                        className="h-full w-full object-cover"
                        width={56}
                        height={40}
                        decoding="async"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <HugeiconsIcon icon={Camera01Icon} className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 py-1 pr-1.5">
                    {item.ListPrice != null && item.ListPrice > 0 && (
                      <p className="text-xs font-semibold text-foreground truncate">{formatPrice(item.ListPrice)}</p>
                    )}
                    <p className="text-xs text-muted-foreground truncate">
                      {addressOneLine(item) || item.City || '—'}
                    </p>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    )
  }

  /* Fallback: only prev/next cards when no slice */
  return (
    <nav className="flex items-center gap-3" aria-label="Previous and next listings">
      {prevKey ? (
        prevListing ? (
          <PrevNextCard listing={prevListing} label="← Previous" direction="prev" />
        ) : (
          <Link
            href={`/listing/${prevKey}`}
            className="flex min-w-[120px] items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-border hover:bg-muted"
          >
            ← Previous
          </Link>
        )
      ) : (
        <span className="flex min-w-[120px] items-center gap-2 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          ← Prev
        </span>
      )}
      {nextKey ? (
        nextListing ? (
          <PrevNextCard listing={nextListing} label="Next →" direction="next" />
        ) : (
          <Link
            href={`/listing/${nextKey}`}
            className="flex min-w-[120px] justify-end rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-border hover:bg-muted"
          >
            Next →
          </Link>
        )
      ) : (
        <span className="flex min-w-[120px] justify-end rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground">
          Next →
        </span>
      )}
    </nav>
  )
}
