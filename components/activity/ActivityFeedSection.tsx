'use client'

import { useState, useCallback, useMemo, useRef, useEffect } from 'react'
import Link from 'next/link'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon } from '@hugeicons/core-free-icons'
import ListingTile from '@/components/ListingTile'
import type { ListingTileListing } from '@/components/ListingTile'
import { Button } from '@/components/ui/button'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { getActivityFeedWithFallbackMulti } from '@/app/actions/activity-feed'
import { getEngagementCountsBatch } from '@/app/actions/engagement'
import { createClient as createSupabaseBrowserClient } from '@/lib/supabase/client'
import type { ActivityFeedItem } from '@/app/actions/activity-feed-shared'
import { H2 } from '@/components/site/primitives'

const SCROLL_THRESHOLD = 4
/**
 * Debounce window for coalescing bursts of activity_events INSERTs into a single
 * refetch. Sync crons can land 5–50 events in a few seconds; without coalescing
 * we'd issue one server action call per row.
 */
const REALTIME_REFETCH_DEBOUNCE_MS = 1500

export type ActivityFeedCity = { city: string; count?: number }

export type ActivityFeedSectionProps = {
  /** Initial feed items (e.g. for default cities). */
  initialItems: ActivityFeedItem[]
  /** Cities selected by default (e.g. ACTIVITY_FEED_DEFAULT_CITIES). */
  defaultCities: string[]
  /** All cities available for the dropdown (e.g. from getBrowseCities). */
  allCities: ActivityFeedCity[]
  /** Section heading. */
  heading?: string
  /** Optional "View all" link. */
  viewAllHref?: string
  viewAllLabel?: string
  /** Max items to fetch when cities change. */
  limit?: number
  className?: string
  /** When true, show save/like on cards and allow toggles. */
  signedIn?: boolean
  /** User's saved listing keys (for activity cards). */
  savedKeys?: string[]
  /** User's liked listing keys (for activity cards). */
  likedKeys?: string[]
  /** User email for tile tracking. */
  userEmail?: string | null
}

/** Map an ActivityFeedItem to ListingTileListing for consistent tile rendering. */
function mapFeedItemToTile(item: ActivityFeedItem): ListingTileListing {
  return {
    ListingKey: item.listing_key,
    ListNumber: item.ListNumber ?? null,
    mls_source: item.mls_source ?? null,
    ListPrice: item.ListPrice ?? null,
    BedroomsTotal: item.BedroomsTotal ?? null,
    BathroomsTotal: item.BathroomsTotal ?? null,
    TotalLivingAreaSqFt: null,
    StreetNumber: item.StreetNumber ?? null,
    StreetName: item.StreetName ?? null,
    City: item.City ?? null,
    State: item.State ?? null,
    PostalCode: item.PostalCode ?? null,
    SubdivisionName: item.SubdivisionName ?? null,
    PhotoURL: item.PhotoURL ?? null,
    Latitude: null,
    Longitude: null,
    StandardStatus: item.StandardStatus ?? null,
    OnMarketDate: item.OnMarketDate ?? null,
    CloseDate: item.CloseDate ?? null,
  }
}

function getPriceDropAmount(item: ActivityFeedItem): number | null {
  if (item.event_type !== 'price_drop') return null
  const previousRaw = item.payload?.previous_price
  const nextRaw = item.payload?.new_price ?? item.ListPrice
  const previous = typeof previousRaw === 'number' ? previousRaw : Number(previousRaw ?? NaN)
  const next = typeof nextRaw === 'number' ? nextRaw : Number(nextRaw ?? NaN)
  if (!Number.isFinite(previous) || !Number.isFinite(next) || previous <= next) return null
  return previous - next
}

/** Union of default cities and allCities for the selector list, default first then rest alphabetically. */
function cityOptions(defaultCities: string[], allCities: ActivityFeedCity[]): string[] {
  const defaultSet = new Set(defaultCities.map((c) => c.trim()).filter(Boolean))
  const rest = allCities
    .map((c) => c.city.trim())
    .filter((c) => c && !defaultSet.has(c))
    .sort((a, b) => a.localeCompare(b))
  return [...defaultCities.filter((c) => c.trim()), ...rest]
}

export default function ActivityFeedSection({
  initialItems,
  defaultCities,
  allCities,
  heading = 'Latest activity',
  viewAllHref,
  viewAllLabel = 'View all',
  limit = 12,
  className,
  signedIn = false,
  savedKeys = [],
  likedKeys = [],
  userEmail,
}: ActivityFeedSectionProps) {
  const [selectedCities, setSelectedCities] = useState<string[]>(() => defaultCities)
  const [items, setItems] = useState<ActivityFeedItem[]>(initialItems)
  const [engagementMap, setEngagementMap] = useState<Awaited<ReturnType<typeof getEngagementCountsBatch>>>({})
  const [loading, setLoading] = useState(false)
  const [popoverOpen, setPopoverOpen] = useState(false)
  const [liveConnected, setLiveConnected] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)
  // selectedCities mirror in a ref so the realtime callback can read the
  // current value without re-subscribing on every city toggle.
  const selectedCitiesRef = useRef(selectedCities)
  selectedCitiesRef.current = selectedCities

  const options = useMemo(() => cityOptions(defaultCities, allCities), [defaultCities, allCities])

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
    const el = scrollRef.current
    if (!el) return
    const ro = new ResizeObserver(() => updateScrollState())
    ro.observe(el)
    const t1 = requestAnimationFrame(() => updateScrollState())
    const t2 = setTimeout(updateScrollState, 150)
    const t3 = setTimeout(updateScrollState, 400)
    return () => {
      ro.disconnect()
      cancelAnimationFrame(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [items.length, updateScrollState])

  useEffect(() => {
    if (items.length === 0) return
    const keys = items.map((i) => i.listing_key).filter(Boolean)
    getEngagementCountsBatch(keys).then(setEngagementMap)
  }, [items])

  /**
   * Supabase Realtime subscription on `activity_events` (SITE_SPEC line 67).
   * INSERT events trigger a debounced refetch of the feed for whatever cities
   * the user currently has selected. Refetch path coalesces bursts via
   * REALTIME_REFETCH_DEBOUNCE_MS so a sync-delta cron pushing 50 rows lands
   * as one network round-trip. Graceful: any failure leaves the feed in its
   * last-fetched state and the "Live" indicator stays off.
   */
  useEffect(() => {
    let cancelled = false
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let channel: ReturnType<ReturnType<typeof createSupabaseBrowserClient>['channel']> | null = null

    try {
      const supabase = createSupabaseBrowserClient()
      channel = supabase
        .channel('activity-feed-home')
        .on(
          // postgres_changes is the canonical Supabase Realtime event for table
          // INSERT/UPDATE/DELETE. activity_events is INSERT-only from sync crons.
          'postgres_changes' as 'system',
          { event: 'INSERT', schema: 'public', table: 'activity_events' },
          () => {
            if (cancelled) return
            if (debounceTimer) clearTimeout(debounceTimer)
            debounceTimer = setTimeout(() => {
              const cities = selectedCitiesRef.current
              if (cities.length === 0) return
              getActivityFeedWithFallbackMulti({ cities, limit })
                .then((next) => {
                  if (!cancelled) setItems(next)
                })
                .catch(() => {
                  // Realtime is a nice-to-have; never let it crash the page.
                })
            }, REALTIME_REFETCH_DEBOUNCE_MS)
          }
        )
        .subscribe((status: string) => {
          if (cancelled) return
          setLiveConnected(status === 'SUBSCRIBED')
        })
    } catch {
      // env missing or browser API not available — fall back to no-realtime
      // behavior. The seeded items + city-toggle refetch still work.
      setLiveConnected(false)
    }

    return () => {
      cancelled = true
      if (debounceTimer) clearTimeout(debounceTimer)
      if (channel) {
        try {
          channel.unsubscribe()
        } catch {
          // ignore — channel may already be torn down
        }
      }
    }
  }, [limit])

  const toggleCity = useCallback(
    (city: string) => {
      const next = selectedCities.includes(city)
        ? selectedCities.filter((c) => c !== city)
        : [...selectedCities, city]
      setSelectedCities(next)
      if (next.length === 0) return
      setLoading(true)
      getActivityFeedWithFallbackMulti({ cities: next, limit })
        .then(setItems)
        .finally(() => setLoading(false))
    },
    [selectedCities, limit]
  )

  const selectAllDefault = useCallback(() => {
    setSelectedCities(defaultCities)
    setLoading(true)
    getActivityFeedWithFallbackMulti({ cities: defaultCities, limit })
      .then(setItems)
      .finally(() => setLoading(false))
  }, [defaultCities, limit])

  return (
    <section
      className={cn('w-full bg-card px-4 py-12 sm:px-6 sm:py-16', className)}
      aria-labelledby="activity-feed-heading"
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-center gap-3">
            <H2 id="activity-feed-heading" className="text-2xl text-primary sm:text-3xl">
              {heading}
            </H2>
            {liveConnected && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                aria-live="polite"
                aria-label="Live activity feed connected"
              >
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success/70 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
                </span>
                Live
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2" aria-haspopup="listbox" aria-expanded={popoverOpen}>
                  Cities ({selectedCities.length})
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="end">
                <div className="max-h-64 overflow-y-auto">
                  <p className="px-2 py-1.5 text-xs font-medium text-muted-foreground">Show activity in:</p>
                  {options.map((city) => (
                    <label
                      key={city}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted"
                    >
                      <Checkbox
                        checked={selectedCities.includes(city)}
                        onCheckedChange={() => toggleCity(city)}
                        aria-label={`Include ${city}`}
                      />
                      <span className="truncate">{city}</span>
                    </label>
                  ))}
                </div>
                <Button variant="ghost" size="sm" className="mt-2 w-full text-xs" onClick={() => { selectAllDefault(); setPopoverOpen(false) }}>
                  Reset to default cities
                </Button>
              </PopoverContent>
            </Popover>
            {viewAllHref && (
              <Link
                href={viewAllHref}
                className="text-sm font-medium text-muted-foreground hover:text-foreground"
              >
                {viewAllLabel} →
              </Link>
            )}
          </div>
        </div>
        <p className="mt-2 text-muted-foreground">
          New listings, price drops, and status changes. Select cities above to filter.
        </p>
        <div className="relative group/slider mt-6">
          {!loading && items.length > 0 && (
            <>
              <Button
                type="button"
                onClick={() => scrollTrack('left')}
                disabled={!canScrollLeft}
                className="absolute left-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-r from-foreground/40 to-transparent opacity-90 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
                aria-label="Scroll left"
              >
                <span className="rounded-full bg-card/90 p-2 shadow-md">
                  <HugeiconsIcon icon={ArrowLeft01Icon} className="h-5 w-5 text-foreground" />
                </span>
              </Button>
              <Button
                type="button"
                onClick={() => scrollTrack('right')}
                disabled={!canScrollRight}
                className="absolute right-0 top-0 z-10 flex h-full w-12 items-center justify-center bg-gradient-to-l from-foreground/40 to-transparent opacity-90 hover:opacity-100 focus:opacity-100 focus:outline-none disabled:pointer-events-none disabled:opacity-0"
                aria-label="Scroll right"
              >
                <span className="rounded-full bg-card/90 p-2 shadow-md">
                  <HugeiconsIcon icon={ArrowRight01Icon} className="h-5 w-5 text-foreground" />
                </span>
              </Button>
            </>
          )}
          <div
            ref={scrollRef}
            onScroll={updateScrollState}
            className={cn(
              'overflow-x-auto pb-2 scroll-smooth no-scrollbar',
              'flex gap-4 snap-x snap-mandatory'
            )}
            style={{ scrollSnapType: 'x mandatory' }}
          >
            {loading && <p className="text-sm text-muted-foreground py-4">Updating...</p>}
            {!loading && items.length === 0 && <p className="text-sm text-muted-foreground py-4">No activity in selected cities yet. Try selecting more cities above.</p>}
            {!loading && items.map((item, i) => (
              <div
                key={item.id}
                className="shrink-0 snap-start w-[280px] sm:w-[320px]"
                style={{ scrollSnapAlign: 'start' }}
              >
                <ListingTile
                  listing={mapFeedItemToTile(item)}
                  listingKey={item.listing_key}
                  signedIn={signedIn}
                  userEmail={userEmail}
                  saved={savedKeys.includes(item.listing_key)}
                  liked={likedKeys.includes(item.listing_key)}
                  hasRecentPriceChange={item.event_type === 'price_drop'}
                  priceDropAmount={getPriceDropAmount(item)}
                  activityAt={item.event_at}
                  priority={i < 3}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}