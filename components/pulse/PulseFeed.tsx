'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter, useSearchParams } from 'next/navigation'
import PulseCard from './PulseCard'
import MarketSnapshotCard from './MarketSnapshotCard'
import PulseFilters from './PulseFilters'
import SignupCard from './SignupCard'
import BrandCard from './BrandCard'
import LifestyleCard from './LifestyleCard'
import { pickBrandCard, type BrandCardDefinition } from '@/lib/pulse-brand-cards'
import {
  LIFESTYLE_CARDS,
  type LifestyleCard as LifestyleCardData,
} from '@/lib/pulse-lifestyle-cards'
import {
  getSignals,
  rerank,
  scoreLifestyle,
  recordSession,
  recordFilterSelection,
} from '@/lib/pulse-signals'
import {
  getPulseFeed,
  type PulseEventType,
  type PulseFeedItem,
  type PulseCitySnapshot,
  type PulseRegionSnapshot,
} from '@/app/actions/pulse-feed'
import { isSignupDismissed, getLifetimeLikeCount } from '@/lib/pulse-saves'
import { trackEvent } from '@/lib/tracking'
import { Button } from '@/components/ui/button'

const EVENT_TYPE_OPTIONS: { value: PulseEventType | 'all'; label: string }[] = [
  { value: 'all', label: 'All events' },
  { value: 'new_listing', label: 'Just listed' },
  { value: 'status_closed', label: 'Just sold' },
  { value: 'status_pending', label: 'Pending' },
  { value: 'price_drop', label: 'Price drop' },
]

const SNAPSHOT_EVERY_N_CARDS = 7
const BRAND_CARD_EVERY_N_CARDS = 8
const BRAND_CARD_OFFSET = 3
const LIFESTYLE_CARD_EVERY_N_CARDS = 4
const LIFESTYLE_CARD_OFFSET = 2
const SIGNUP_TRIGGER_LIKES = 3
const PRELOAD_HORIZON = 3

type Props = {
  initialItems: PulseFeedItem[]
  initialNextOffset: number | null
  defaultCities: string[]
  citySnapshots: PulseCitySnapshot[]
  regionSnapshot: PulseRegionSnapshot | null
}

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => decodeURIComponent(s.trim()))
    .filter(Boolean)
}

function toCsv(values: string[]): string | null {
  if (!values.length) return null
  return values.map((v) => encodeURIComponent(v)).join(',')
}

function isPulseEventType(value: string): value is PulseEventType {
  return ['new_listing', 'price_drop', 'status_pending', 'status_closed', 'back_on_market'].includes(value)
}

type FeedEntry =
  | { kind: 'event'; item: PulseFeedItem }
  | { kind: 'snapshot'; snap: PulseCitySnapshot; index: number }
  | { kind: 'brand'; card: BrandCardDefinition; position: number }
  | { kind: 'lifestyle'; card: LifestyleCardData; position: number }
  | { kind: 'signup' }

export default function PulseFeed({
  initialItems,
  initialNextOffset,
  defaultCities,
  citySnapshots,
  regionSnapshot,
}: Props) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialSelectedCities = useMemo(
    () => parseCsv(searchParams.get('cities')),
    [searchParams]
  )
  const initialSelectedTypes = useMemo(() => {
    return parseCsv(searchParams.get('types')).filter(isPulseEventType) as PulseEventType[]
  }, [searchParams])

  const [selectedCities, setSelectedCities] = useState<string[]>(initialSelectedCities)
  const [selectedTypes, setSelectedTypes] = useState<PulseEventType[]>(initialSelectedTypes)
  const [items, setItems] = useState<PulseFeedItem[]>(initialItems)
  const [nextOffset, setNextOffset] = useState<number | null>(initialNextOffset)
  const [loading, setLoading] = useState(false)
  const [activeVideoKey, setActiveVideoKey] = useState<string | null>(null)
  const [showSignupCard, setShowSignupCard] = useState(false)
  const signupTrigger = useRef<'like_threshold' | 'dwell' | 'manual'>('like_threshold')
  const filtersDirty = useRef(false)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    recordSession()
    trackEvent('homepage_view', {
      source: 'pulse_feed',
      cities: selectedCities,
      event_types: selectedTypes,
    })
    // initial-load fire only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Check on mount: if the user already has 3+ likes from a prior session and
  // hasn't dismissed the prompt, show the in-feed signup.
  useEffect(() => {
    if (isSignupDismissed()) return
    const total = getLifetimeLikeCount()
    if (total >= SIGNUP_TRIGGER_LIKES) {
      setShowSignupCard(true)
    }
  }, [])

  // Dwell-based trigger: 75 seconds on page without a like also surfaces the card.
  useEffect(() => {
    if (isSignupDismissed()) return
    const t = window.setTimeout(() => {
      if (!isSignupDismissed() && !showSignupCard) {
        signupTrigger.current = 'dwell'
        setShowSignupCard(true)
      }
    }, 75_000)
    return () => window.clearTimeout(t)
  }, [showSignupCard])

  const syncUrl = useCallback(
    (cities: string[], types: PulseEventType[]) => {
      const params = new URLSearchParams()
      const citiesValue = toCsv(cities)
      if (citiesValue) params.set('cities', citiesValue)
      const typesValue = toCsv(types)
      if (typesValue) params.set('types', typesValue)
      const queryString = params.toString()
      const target = queryString.length > 0 ? `/pulse?${queryString}` : '/pulse'
      router.replace(target, { scroll: false })
    },
    [router]
  )

  const refresh = useCallback(
    async (cities: string[], types: PulseEventType[]) => {
      setLoading(true)
      try {
        const { items: nextItems, nextOffset: cursor } = await getPulseFeed({
          cities: cities.length ? cities : null,
          eventTypes: types.length ? types : null,
          offset: 0,
        })
        setItems(nextItems)
        setNextOffset(cursor)
        trackEvent('search', {
          source: 'pulse_feed',
          cities,
          event_types: types,
          result_count: nextItems.length,
        })
      } finally {
        setLoading(false)
      }
    },
    []
  )

  const handleCities = useCallback(
    (cities: string[]) => {
      setSelectedCities(cities)
      syncUrl(cities, selectedTypes)
      filtersDirty.current = true
      recordFilterSelection({ cities, eventTypes: selectedTypes })
      void refresh(cities, selectedTypes)
    },
    [refresh, selectedTypes, syncUrl]
  )

  const handleTypes = useCallback(
    (types: PulseEventType[]) => {
      setSelectedTypes(types)
      syncUrl(selectedCities, types)
      filtersDirty.current = true
      recordFilterSelection({ cities: selectedCities, eventTypes: types })
      void refresh(selectedCities, types)
    },
    [refresh, selectedCities, syncUrl]
  )

  const loadMore = useCallback(async () => {
    if (loading || nextOffset == null) return
    setLoading(true)
    try {
      const { items: more, nextOffset: cursor } = await getPulseFeed({
        cities: selectedCities.length ? selectedCities : null,
        eventTypes: selectedTypes.length ? selectedTypes : null,
        offset: nextOffset,
      })
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.listing_key))
        const merged = [...prev]
        for (const item of more) {
          if (!seen.has(item.listing_key)) {
            merged.push(item)
            seen.add(item.listing_key)
          }
        }
        return merged
      })
      setNextOffset(cursor)
    } finally {
      setLoading(false)
    }
  }, [loading, nextOffset, selectedCities, selectedTypes])

  // Preload more pages well before the user reaches the end so the feed never stalls.
  useEffect(() => {
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          void loadMore()
        }
      },
      { rootMargin: '1200px 0px' }
    )
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [loadMore])

  const handleVideoVisible = useCallback((key: string) => {
    setActiveVideoKey((prev) => (prev === key ? prev : key))
  }, [])

  const handleLikeThresholdHit = useCallback(() => {
    if (isSignupDismissed()) return
    signupTrigger.current = 'like_threshold'
    setShowSignupCard(true)
  }, [])

  const handleSignupDismiss = useCallback(() => {
    setShowSignupCard(false)
  }, [])

  const interstitials = useMemo(() => {
    if (citySnapshots.length === 0) return [] as PulseCitySnapshot[]
    const filtered = selectedCities.length
      ? citySnapshots.filter((c) =>
          selectedCities.some((sel) => sel.toLowerCase() === c.geo_label.toLowerCase())
        )
      : citySnapshots
    return filtered
  }, [citySnapshots, selectedCities])

  const feedEntries: FeedEntry[] = useMemo(() => {
    // Re-rank lifestyle slate by the user's category signal each render.
    // Same slate every time, just ordered by what they've engaged with.
    const signals = getSignals()
    const rankedLifestyle = rerank(LIFESTYLE_CARDS, (card) => scoreLifestyle(signals, card))

    const out: FeedEntry[] = []
    let snapshotIndex = 0
    let brandIndex = 0
    let lifestyleIndex = 0
    let signupInserted = false
    items.forEach((item, idx) => {
      out.push({ kind: 'event', item })
      const nextPosition = idx + 1

      // Lifestyle card every 4 events (offset 2) — the most frequent variety
      // injection. Events, dining, outdoors, neighborhoods. Pull from the
      // ranked slate so the user sees their preferred categories first.
      const positionForLifestyle =
        nextPosition - LIFESTYLE_CARD_OFFSET >= 0 &&
        (nextPosition - LIFESTYLE_CARD_OFFSET) % LIFESTYLE_CARD_EVERY_N_CARDS === 0
      if (positionForLifestyle && rankedLifestyle.length > 0) {
        const card = rankedLifestyle[lifestyleIndex % rankedLifestyle.length]
        out.push({
          kind: 'lifestyle',
          card,
          position: nextPosition,
        })
        lifestyleIndex += 1
      }

      // Brand card every 8 events (offset 3) — less frequent than lifestyle so
      // the brand stays welcome, not nagging.
      const positionForBrand =
        nextPosition - BRAND_CARD_OFFSET >= 0 &&
        (nextPosition - BRAND_CARD_OFFSET) % BRAND_CARD_EVERY_N_CARDS === 0
      if (positionForBrand) {
        out.push({
          kind: 'brand',
          card: pickBrandCard(brandIndex),
          position: nextPosition,
        })
        brandIndex += 1
      }

      // Market-pulse snapshot every 7 events.
      const positionForSnapshot = nextPosition % SNAPSHOT_EVERY_N_CARDS === 0
      if (positionForSnapshot && interstitials.length > 0) {
        const snap = interstitials[snapshotIndex % interstitials.length]
        snapshotIndex += 1
        out.push({ kind: 'snapshot', snap, index: snapshotIndex })
      }

      // Inject signup card once after the 5th event.
      if (showSignupCard && !signupInserted && idx + 1 === 5) {
        out.push({ kind: 'signup' })
        signupInserted = true
      }
    })
    if (showSignupCard && !signupInserted) {
      out.push({ kind: 'signup' })
    }
    return out
  }, [items, interstitials, showSignupCard])

  // Preload the next N hero images in the background so the scroll never waits on bytes.
  const preloadUrls = useMemo(() => {
    const urls: string[] = []
    for (let i = 0; i < Math.min(items.length, PRELOAD_HORIZON); i++) {
      const u = items[i]?.PhotoURL
      if (u) urls.push(u)
    }
    return urls
  }, [items])

  const showEmpty = !loading && items.length === 0

  return (
    <div ref={containerRef} className="mx-auto w-full max-w-md px-3 pb-24 pt-3 sm:px-0">
      <Head>
        {preloadUrls.map((url) => (
          <link key={url} rel="preload" as="image" href={url} />
        ))}
      </Head>

      <div className="sticky top-16 z-30 -mx-3 mb-3 border-b border-border bg-background/85 px-3 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/65 sm:mx-0 sm:rounded-2xl sm:border sm:px-4 sm:py-3">
        <PulseFilters
          cities={defaultCities}
          selectedCities={selectedCities}
          onCitiesChange={handleCities}
          eventTypes={EVENT_TYPE_OPTIONS}
          selectedEventTypes={selectedTypes}
          onEventTypesChange={handleTypes}
        />
      </div>

      {regionSnapshot && items.length > 0 && selectedCities.length === 0 && !filtersDirty.current && (
        <div className="mb-3">
          <MarketSnapshotCard scope="region" snapshot={{ ...regionSnapshot }} />
        </div>
      )}

      <div
        className="flex flex-col gap-3"
        style={{ scrollSnapType: 'y proximity' }}
      >
        {feedEntries.map((entry, idx) => {
          if (entry.kind === 'snapshot') {
            return (
              <MarketSnapshotCard
                key={`snap-${entry.snap.geo_slug}-${entry.index}-${idx}`}
                snapshot={entry.snap}
              />
            )
          }
          if (entry.kind === 'brand') {
            return (
              <BrandCard
                key={`brand-${entry.card.id}-${entry.position}-${idx}`}
                card={entry.card}
                position={entry.position}
              />
            )
          }
          if (entry.kind === 'lifestyle') {
            return (
              <LifestyleCard
                key={`lifestyle-${entry.card.id}-${entry.position}-${idx}`}
                card={entry.card}
                position={entry.position}
              />
            )
          }
          if (entry.kind === 'signup') {
            return <SignupCard key={`signup-${idx}`} onDismiss={handleSignupDismiss} triggeredBy={signupTrigger.current} />
          }
          return (
            <PulseCard
              key={entry.item.id}
              item={entry.item}
              priority={idx < 2}
              videoActive={activeVideoKey === entry.item.listing_key}
              onVideoVisible={handleVideoVisible}
              onLikeThresholdHit={handleLikeThresholdHit}
            />
          )
        })}
      </div>

      {showEmpty && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <p
            className="font-display text-xl text-foreground"
            style={{ fontFamily: 'var(--font-amboqia, ui-serif, Georgia, serif)' }}
          >
            No matching activity yet
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Try adding cities or events back, or check again later.
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => {
              setSelectedCities([])
              setSelectedTypes([])
              syncUrl([], [])
              filtersDirty.current = true
              void refresh([], [])
            }}
          >
            Show everything
          </Button>
        </div>
      )}

      <div ref={sentinelRef} className="h-10" aria-hidden />
      {loading && (
        <p className="py-4 text-center text-sm text-muted-foreground">Loading more activity…</p>
      )}
      {!loading && nextOffset == null && items.length > 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">
          You are caught up. Check back soon.
        </p>
      )}
    </div>
  )
}
