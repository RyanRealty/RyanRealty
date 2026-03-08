'use client'

import { useRef, useState, useEffect } from 'react'
import type { HotCommunity } from '@/app/actions/listings'
import { subdivisionEntityKey } from '@/lib/slug'
import CommunityTile from '@/components/CommunityTile'
import { SLIDER_TILE_WIDTH_PX, TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

type Props = {
  city: string
  communities: HotCommunity[]
  /** Optional banner image URLs in same order as communities */
  bannerUrls?: (string | null)[]
  signedIn?: boolean
  savedCommunityKeys?: string[]
}

export default function PopularCommunitiesRow({ city, communities, bannerUrls = [], signedIn = false, savedCommunityKeys = [] }: Props) {
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

  useEffect(() => {
    updateScrollState()
  }, [communities.length])

  if (communities.length === 0) return null

  return (
    <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6" aria-labelledby="popular-communities-heading">
      <div className="flex items-center justify-between gap-4">
        <h2 id="popular-communities-heading" className="text-xl font-bold tracking-tight text-zinc-900">
          Popular Communities
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
      <p className="mt-1 text-sm text-zinc-600">Communities with the most activity in {city}. Click to explore.</p>
      <div
        ref={scrollRef}
        onScroll={updateScrollState}
        className="mt-4 flex gap-4 overflow-x-auto pb-2 scroll-smooth"
        style={{ scrollbarWidth: 'thin' }}
      >
        {communities.map((c, i) => {
          const entityKey = subdivisionEntityKey(city, c.subdivisionName)
          return (
            <div
              key={c.subdivisionName}
              className="shrink-0"
              style={{ width: SLIDER_TILE_WIDTH_PX, minHeight: TILE_MIN_HEIGHT_PX }}
            >
              <CommunityTile
                city={city}
                community={c}
                bannerUrl={bannerUrls[i] ?? null}
                signedIn={signedIn}
                saved={savedCommunityKeys.includes(entityKey)}
              />
            </div>
          )
        })}
      </div>
    </section>
  )
}
