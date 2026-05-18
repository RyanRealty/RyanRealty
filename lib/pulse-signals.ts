/**
 * Client-side personalization signals for the /pulse feed.
 *
 * Captures anonymous engagement (likes, expands, filter changes) and exposes
 * a scoring function that re-ranks lifestyle + brand cards toward what the
 * viewer has shown interest in. Pure localStorage, no server round-trip.
 *
 * When a visitor identifies (FUB email click, sign-up form), the FUB bridge
 * can read these signals and persist them server-side for cross-device
 * personalization. That sync is out of scope here; this file is the source
 * for the next layer to read.
 */

const SIGNALS_KEY = 'pulse:signals_v1'

export type PulseSignals = {
  /** Lifetime likes by lifestyle category. */
  likes_by_category: Record<string, number>
  /** Lifetime likes by city (from liked MLS events). */
  likes_by_city: Record<string, number>
  /** Lifetime likes by price band ($K bucketed). */
  likes_by_price_band: Record<string, number>
  /** Lifetime likes by event type (just_listed, sold, etc.) */
  likes_by_event_type: Record<string, number>
  /** Filter selections the user has chosen (city + event type). */
  selected_cities: Record<string, number>
  selected_event_types: Record<string, number>
  /** Counts session opens for return-visitor scoring later. */
  sessions: number
  last_seen: string | null
}

const EMPTY: PulseSignals = {
  likes_by_category: {},
  likes_by_city: {},
  likes_by_price_band: {},
  likes_by_event_type: {},
  selected_cities: {},
  selected_event_types: {},
  sessions: 0,
  last_seen: null,
}

function read(): PulseSignals {
  if (typeof window === 'undefined') return { ...EMPTY }
  try {
    const raw = window.localStorage.getItem(SIGNALS_KEY)
    if (!raw) return { ...EMPTY }
    const parsed = JSON.parse(raw) as Partial<PulseSignals>
    return {
      ...EMPTY,
      ...parsed,
      likes_by_category: { ...EMPTY.likes_by_category, ...(parsed.likes_by_category ?? {}) },
      likes_by_city: { ...EMPTY.likes_by_city, ...(parsed.likes_by_city ?? {}) },
      likes_by_price_band: { ...EMPTY.likes_by_price_band, ...(parsed.likes_by_price_band ?? {}) },
      likes_by_event_type: { ...EMPTY.likes_by_event_type, ...(parsed.likes_by_event_type ?? {}) },
      selected_cities: { ...EMPTY.selected_cities, ...(parsed.selected_cities ?? {}) },
      selected_event_types: { ...EMPTY.selected_event_types, ...(parsed.selected_event_types ?? {}) },
    }
  } catch {
    return { ...EMPTY }
  }
}

function write(signals: PulseSignals) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SIGNALS_KEY, JSON.stringify(signals))
  } catch {
    // ignore quota errors
  }
}

export function getSignals(): PulseSignals {
  return read()
}

function bump(record: Record<string, number>, key: string | null | undefined, by: number = 1) {
  if (!key) return
  record[key] = (record[key] ?? 0) + by
}

function priceBand(price: number | null | undefined): string | null {
  if (price == null || !Number.isFinite(price) || price <= 0) return null
  if (price < 400_000) return 'sub-400k'
  if (price < 600_000) return '400k-600k'
  if (price < 900_000) return '600k-900k'
  if (price < 1_500_000) return '900k-1.5M'
  if (price < 3_000_000) return '1.5M-3M'
  return '3M-plus'
}

export type LikeContext = {
  source: 'listing' | 'lifestyle' | 'brand'
  category?: string | null
  city?: string | null
  price?: number | null
  event_type?: string | null
}

export function recordLike(ctx: LikeContext): void {
  const s = read()
  bump(s.likes_by_category, ctx.category)
  bump(s.likes_by_city, ctx.city)
  bump(s.likes_by_price_band, priceBand(ctx.price))
  bump(s.likes_by_event_type, ctx.event_type)
  s.last_seen = new Date().toISOString()
  write(s)
}

export function recordFilterSelection(opts: {
  cities: string[]
  eventTypes: string[]
}): void {
  const s = read()
  for (const c of opts.cities) bump(s.selected_cities, c)
  for (const t of opts.eventTypes) bump(s.selected_event_types, t)
  s.last_seen = new Date().toISOString()
  write(s)
}

export function recordSession(): void {
  const s = read()
  s.sessions = (s.sessions ?? 0) + 1
  s.last_seen = new Date().toISOString()
  write(s)
}

/** Score a lifestyle card against the user's signals. Higher = better fit. */
export function scoreLifestyle(
  signals: PulseSignals,
  card: { category?: string | null }
): number {
  if (!card.category) return 0
  const catLikes = signals.likes_by_category[card.category] ?? 0
  // 2 points per category like, capped at 6.
  return Math.min(catLikes * 2, 6)
}

/** Score a listing card by city and event-type signal match. */
export function scoreListing(
  signals: PulseSignals,
  listing: { City?: string | null; event_type?: string | null; ListPrice?: number | null }
): number {
  let score = 0
  const c = listing.City
  if (c) {
    score += (signals.likes_by_city[c] ?? 0) * 1.5
    score += (signals.selected_cities[c] ?? 0) * 0.5
  }
  if (listing.event_type) {
    score += (signals.likes_by_event_type[listing.event_type] ?? 0) * 1.0
    score += (signals.selected_event_types[listing.event_type] ?? 0) * 0.4
  }
  const band = priceBand(listing.ListPrice)
  if (band) score += (signals.likes_by_price_band[band] ?? 0) * 1.0
  return score
}

/**
 * Rerank an array by a score function while preserving stability and adding
 * a small (~12%) ε-greedy diversity bonus so we don't trap users in a single
 * type. Items with score 0 keep their original order at the bottom.
 */
export function rerank<T>(items: T[], scoreFn: (item: T) => number): T[] {
  if (items.length < 2) return items
  const indexed = items.map((item, idx) => ({
    item,
    idx,
    score: scoreFn(item) + (Math.random() < 0.12 ? Math.random() * 0.8 : 0),
  }))
  indexed.sort((a, b) => {
    if (b.score === a.score) return a.idx - b.idx
    return b.score - a.score
  })
  return indexed.map((x) => x.item)
}

/** Reset signals (useful for a "Show me a fresh mix" button later). */
export function clearSignals(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.removeItem(SIGNALS_KEY)
  } catch {
    // ignore
  }
}
