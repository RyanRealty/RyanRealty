'use client'

import { useRef, useState, useEffect } from 'react'
import type { HotCommunity } from '@/app/actions/listings'
import { subdivisionEntityKey } from '@/lib/slug'
import CommunityTile from '@/components/CommunityTile'
import { SLIDER_TILE_WIDTH_PX, TILE_MIN_HEIGHT_PX } from '@/lib/tile-constants'

type Props = {
  city: string
  communities: HotCommunity[]
  /** City or hero image URL for section background */
  sectionBackgroundUrl?: string | null
  /** Banner image URLs in same order as communities */
  bannerUrls?: (string | null)[]
  signedIn?: boolean
  savedCommunityKeys?: string[]
}

const DEFAULT_DISPLAY_COUNT = 10

export default function HotCommunitiesSection({
  city,
  communities,
  sectionBackgroundUrl,
  bannerUrls = [],
  signedIn = false,
  savedCommunityKeys = [],
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  const displayCommunities = communities.slice(0, DEFAULT_DISPLAY_COUNT)

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
  }, [displayCommunities.length])

  if (displayCommunities.length === 0) return null

  return (
    <section
      className="relative overflow-hidden rounded-2xl border border-zinc-200 shadow-lg"
      aria-labelledby="hot-communities-heading"
    >
      {/* Photo background with overlay */}
      {sectionBackgroundUrl && (
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${sectionBackgroundUrl})` }}
          aria-hidden
        />
      )}
      <div
        className={`relative ${sectionBackgroundUrl ? 'bg-black/50' : 'bg-gradient-to-br from-zinc-800 to-zinc-900'}`}
      >
        <div className="relative mx-auto max-w-7xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 id="hot-communities-heading" className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                Hot communities in {city}
              </h2>
              <p className="mt-1 text-sm text-white/90">
                Where the action is — most listings, pending sales, and new listings. Explore these in-demand neighborhoods.
              </p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => scroll('left')}
                disabled={!canScrollLeft}
                className="rounded-lg border border-white/30 bg-white/10 p-2 text-white shadow transition hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none"
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
                className="rounded-lg border border-white/30 bg-white/10 p-2 text-white shadow transition hover:bg-white/20 disabled:opacity-40 disabled:pointer-events-none"
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
            className="mt-6 flex gap-4 overflow-x-auto pb-2 scroll-smooth"
            style={{ scrollbarWidth: 'thin' }}
          >
            {displayCommunities.map((c, i) => {
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
        </div>
      </div>
    </section>
  )
}
