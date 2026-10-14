/**
 * Visitor intent and market: is this browser a buyer, a seller, both, or just
 * browsing, and which Central Oregon market does it look at most.
 *
 * WHY (Matt 2026-10-14). GA4 could not tell a buyer from a seller. The
 * first-party store could: visitor_events.page_category already sorts every page
 * into listing_detail, buyer_intent, seller_intent and the rest
 * (visitorPageCategoryFromPath in ./page-type), and the CRM and the sales funnel
 * score on those categories. This module reads that ONE definition, so GA4's
 * user properties `visitor_intent` and `primary_market` mean what the CRM means.
 *
 * THE RULE (named constants below):
 *   seller  any seller_intent page, or a seller event (address_submit, place_value_answer)
 *   buyer   3+ listing_detail page views in the last 30 days, or any buyer_intent
 *           page, or a buyer event (save_listing, schedule_tour_click,
 *           ask_question_click, tour_requested)
 *   both    buyer and seller
 *   else    browsing
 * A page or event flag never expires; only the listing-view count has a window.
 *
 * WHERE IT SHOWS. PageViewTracker pushes `visitor_intent` / `primary_market` as
 * flat dataLayer keys with the page context, before each page_view; the inline
 * GTM bootstrap pushes the stored values with the first-paint page_view; and
 * trackEvent pushes a new `visitor_intent` when an intent event changes it. Both
 * GA4 Event tags map them to GA4 user properties (GA4_USER_PROPERTIES).
 *
 * STORAGE. One localStorage key, VISITOR_INTENT_STORAGE_KEY, holding no
 * identifier: timestamps, flags and per-market counts. Written only when the
 * caller passes `consent: true` (hasAnalyticsConsent(), the gate every analytics
 * storage write uses). This module does not import the consent banner; callers
 * decide. Every storage read and write is wrapped: a blocked or full storage
 * never throws, it only forgets.
 */
import { CENTRAL_OREGON_CITY_SLUGS } from '@/lib/central-oregon'
import { visitorPageCategoryFromPath } from './page-type'

/** The localStorage key. The GTM bootstrap reads it inline (gtm-bootstrap.ts). */
export const VISITOR_INTENT_STORAGE_KEY = 'rr_visitor_intent_v1'

export const VISITOR_INTENTS = ['buyer', 'seller', 'both', 'browsing'] as const
export type VisitorIntent = (typeof VISITOR_INTENTS)[number]

/** Listing-detail page views that make a buyer, inside the window below. */
export const BUYER_LISTING_VIEW_THRESHOLD = 3
/** The window those listing views must fall in. */
export const LISTING_VIEW_WINDOW_DAYS = 30
export const LISTING_VIEW_WINDOW_MS = LISTING_VIEW_WINDOW_DAYS * 24 * 60 * 60 * 1000
/** At most this many listing-view timestamps are kept (newest win). */
export const LISTING_VIEW_CAP = 50
/** At most this many markets are counted (the least-viewed one is dropped). */
export const MARKET_KEY_CAP = 30
/** GA4 caps a user property value at 36 characters. */
export const MARKET_SLUG_MAX = 36

/** Events that make a buyer. Sent through trackEvent (lib/tracking.ts). */
export const BUYER_INTENT_EVENTS = ['save_listing', 'schedule_tour_click', 'ask_question_click', 'tour_requested'] as const
/** Events that make a seller. */
export const SELLER_INTENT_EVENTS = ['address_submit', 'place_value_answer'] as const

/** visitor_events.page_category values (page-type.ts) this classifier reads. */
export const LISTING_DETAIL_CATEGORY = 'listing_detail'
export const BUYER_PAGE_CATEGORY = 'buyer_intent'
export const SELLER_PAGE_CATEGORY = 'seller_intent'

export type VisitorIntentMemory = {
  /** Listing-detail page view times (ms), oldest first, last 30 days, at most 50. */
  listingViews: number[]
  /** Last buyer event (ms), null when none. */
  buyerActionAt: number | null
  /** Last seller event (ms), null when none. */
  sellerActionAt: number | null
  /** Last buyer_intent page view (ms), null when none. */
  buyerPageAt: number | null
  /** Last seller_intent page view (ms), null when none. */
  sellerPageAt: number | null
  /** Page views per market slug, at most 30 keys. */
  markets: Record<string, number>
  /** The market reported last, kept on a tie. */
  primaryMarket: string | null
  /** The label reported last. The bootstrap sends it with the first-paint page_view. */
  intent: VisitorIntent
}

/** What the dataLayer gets, flat. */
export type VisitorIntentContext = {
  visitor_intent: VisitorIntent | null
  primary_market: string | null
}

export type VisitorIntentUpdate = VisitorIntentContext & {
  /** True when visitor_intent differs from the label stored before this update. */
  changed: boolean
}

/** The slice of Storage this module uses, so tests can pass a fake. */
export type IntentStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export type RecordOptions = {
  /** hasAnalyticsConsent() from the caller. Nothing is read or written without it. */
  consent: boolean
  now?: number
  /** Defaults to window.localStorage. Pass null for none. */
  storage?: IntentStorage | null
}

const NOT_RECORDED: VisitorIntentUpdate = { visitor_intent: null, primary_market: null, changed: false }

export function emptyVisitorIntentMemory(): VisitorIntentMemory {
  return {
    listingViews: [],
    buyerActionAt: null,
    sellerActionAt: null,
    buyerPageAt: null,
    sellerPageAt: null,
    markets: {},
    primaryMarket: null,
    intent: 'browsing',
  }
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isMarketSlug(v: unknown): v is string {
  return typeof v === 'string' && v.length <= MARKET_SLUG_MAX && SLUG_RE.test(v)
}

function isVisitorIntent(v: unknown): v is VisitorIntent {
  return typeof v === 'string' && (VISITOR_INTENTS as readonly string[]).includes(v)
}

function timestampOrNull(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null
}

/** The stored JSON, every field checked; anything malformed reads as empty. */
export function parseVisitorIntentMemory(raw: string | null | undefined): VisitorIntentMemory {
  const mem = emptyVisitorIntentMemory()
  if (!raw) return mem
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return mem
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return mem
  const o = parsed as Record<string, unknown>
  if (Array.isArray(o.listingViews)) {
    mem.listingViews = o.listingViews
      .filter((t): t is number => typeof t === 'number' && Number.isFinite(t) && t > 0)
      .sort((a, b) => a - b)
      .slice(-LISTING_VIEW_CAP)
  }
  mem.buyerActionAt = timestampOrNull(o.buyerActionAt)
  mem.sellerActionAt = timestampOrNull(o.sellerActionAt)
  mem.buyerPageAt = timestampOrNull(o.buyerPageAt)
  mem.sellerPageAt = timestampOrNull(o.sellerPageAt)
  if (o.markets && typeof o.markets === 'object' && !Array.isArray(o.markets)) {
    for (const [slug, n] of Object.entries(o.markets as Record<string, unknown>)) {
      if (Object.keys(mem.markets).length >= MARKET_KEY_CAP) break
      if (isMarketSlug(slug) && typeof n === 'number' && Number.isFinite(n) && n > 0) mem.markets[slug] = Math.floor(n)
    }
  }
  mem.primaryMarket = isMarketSlug(o.primaryMarket) && o.primaryMarket in mem.markets ? o.primaryMarket : null
  mem.intent = isVisitorIntent(o.intent) ? o.intent : 'browsing'
  return mem
}

/** Listing-detail views inside the window ending at `now`. */
export function recentListingViews(memory: VisitorIntentMemory, now: number = Date.now()): number {
  return memory.listingViews.filter((t) => now - t < LISTING_VIEW_WINDOW_MS).length
}

export function classifyVisitorIntent(memory: VisitorIntentMemory, now: number = Date.now()): VisitorIntent {
  const seller = memory.sellerPageAt !== null || memory.sellerActionAt !== null
  const buyer =
    recentListingViews(memory, now) >= BUYER_LISTING_VIEW_THRESHOLD ||
    memory.buyerPageAt !== null ||
    memory.buyerActionAt !== null
  if (buyer && seller) return 'both'
  if (seller) return 'seller'
  if (buyer) return 'buyer'
  return 'browsing'
}

/**
 * Routes whose path segment at `index` is a city slug. Only a Central Oregon
 * service-area city (CENTRAL_OREGON_CITY_SLUGS) counts, so a preset
 * (/homes-for-sale/luxury), a route word (/homes-for-sale/listing/<key>) or an
 * out-of-area listing (/homes-for-sale/medford/...) is no market here.
 */
const CITY_SEGMENT_ROUTES: Readonly<Record<string, number>> = {
  'homes-for-sale': 1, // /homes-for-sale/<city>[/<sub>][/<address>-<mls>], presets under a city
  cities: 1, // /cities/<city>[/<neighborhood>|/buying|/cost|...]
  'open-houses': 1, // /open-houses/<city>
  'price-drops': 1, // /price-drops/<city>
  'housing-market': 1, // /housing-market/<city>[/...] (the market report pages)
}

/**
 * The market a page is about, as a lowercase slug, or null.
 *
 *   /homes-for-sale/<city>/...  /cities/<city>/...  /open-houses/<city>
 *   /price-drops/<city>  /housing-market/<city>/...                             -> the city
 *   /communities/<slug>/...                                                     -> the community slug
 *
 * Everything else is null: /subdivisions/<slug> (a plat is finer than a market
 * and its slug carries no city), /listing/<key> (no place in the path),
 * /oregon/<city> (outside the service area), /central-oregon/* (trails, golf,
 * events: not a market), /zip, /areas and every non-place page. /motivated-sellers
 * is a 301 to /price-drops (next.config.ts), so it never renders here.
 */
export function marketSlugFromPath(pathname: string | null | undefined): string | null {
  if (!pathname) return null
  const path = pathname.split(/[?#]/)[0] ?? ''
  const segs = path
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s).toLowerCase()
      } catch {
        return s.toLowerCase()
      }
    })
  const first = segs[0]
  if (!first) return null
  if (first === 'communities') {
    const slug = segs[1]
    return isMarketSlug(slug) ? slug : null
  }
  const index = CITY_SEGMENT_ROUTES[first]
  if (index === undefined) return null
  const city = segs[index]
  return city && CENTRAL_OREGON_CITY_SLUGS.has(city) ? city : null
}

/** The market with the most page views. A tie keeps the stored primary market. */
export function primaryMarket(memory: VisitorIntentMemory): string | null {
  let best: string | null = null
  let bestCount = 0
  for (const [slug, n] of Object.entries(memory.markets)) {
    if (n > bestCount) {
      best = slug
      bestCount = n
    }
  }
  if (best === null) return null
  const stored = memory.primaryMarket
  if (stored && memory.markets[stored] === bestCount) return stored
  return best
}

function addMarketView(memory: VisitorIntentMemory, slug: string): void {
  if (slug in memory.markets) {
    memory.markets[slug] += 1
    return
  }
  const keys = Object.keys(memory.markets)
  if (keys.length >= MARKET_KEY_CAP) {
    // Drop the least-viewed market (first one on a tie), never the primary and
    // never the market added last: at the cap a new market starts at 1, so
    // without that a visitor moving between two new areas would evict each in
    // turn and neither could ever build a count.
    const newest = keys[keys.length - 1]
    let drop: string | null = null
    for (const k of keys) {
      if (k === memory.primaryMarket || k === newest) continue
      if (drop === null || memory.markets[k] < memory.markets[drop]) drop = k
    }
    if (drop !== null) delete memory.markets[drop]
  }
  memory.markets[slug] = 1
}

/**
 * The memory after one page view at `pathname` (pure: returns a new object).
 * Uses the shared page category, so a listing_detail, buyer_intent or
 * seller_intent page here is the same page the CRM scores.
 */
export function applyPageVisit(memory: VisitorIntentMemory, pathname: string, now: number = Date.now()): VisitorIntentMemory {
  const next: VisitorIntentMemory = { ...memory, listingViews: [...memory.listingViews], markets: { ...memory.markets } }
  const category = visitorPageCategoryFromPath(pathname || '/')
  if (category === LISTING_DETAIL_CATEGORY) next.listingViews.push(now)
  else if (category === BUYER_PAGE_CATEGORY) next.buyerPageAt = now
  else if (category === SELLER_PAGE_CATEGORY) next.sellerPageAt = now
  next.listingViews = next.listingViews.filter((t) => now - t < LISTING_VIEW_WINDOW_MS).slice(-LISTING_VIEW_CAP)
  const market = marketSlugFromPath(pathname)
  if (market) addMarketView(next, market)
  next.primaryMarket = primaryMarket(next)
  next.intent = classifyVisitorIntent(next, now)
  return next
}

export function isBuyerIntentEvent(name: string): boolean {
  return (BUYER_INTENT_EVENTS as readonly string[]).includes(name)
}

export function isSellerIntentEvent(name: string): boolean {
  return (SELLER_INTENT_EVENTS as readonly string[]).includes(name)
}

/** True for an event that can change the label. trackEvent checks this first, so other events cost nothing. */
export function isVisitorIntentEvent(name: string): boolean {
  return isBuyerIntentEvent(name) || isSellerIntentEvent(name)
}

/** The memory after one event (pure). A non-intent event changes only the stored label's freshness. */
export function applyIntentEvent(memory: VisitorIntentMemory, eventName: string, now: number = Date.now()): VisitorIntentMemory {
  const next: VisitorIntentMemory = { ...memory, listingViews: [...memory.listingViews], markets: { ...memory.markets } }
  if (isBuyerIntentEvent(eventName)) next.buyerActionAt = now
  else if (isSellerIntentEvent(eventName)) next.sellerActionAt = now
  next.intent = classifyVisitorIntent(next, now)
  return next
}

function defaultStorage(): IntentStorage | null {
  try {
    if (typeof window === 'undefined') return null
    return window.localStorage ?? null
  } catch {
    return null
  }
}

function resolveStorage(storage: IntentStorage | null | undefined): IntentStorage | null {
  return storage === undefined ? defaultStorage() : storage
}

/** The stored memory, or an empty one when storage is missing, blocked or holds garbage. */
export function readVisitorIntentMemory(storage?: IntentStorage | null): VisitorIntentMemory {
  const s = resolveStorage(storage)
  if (!s) return emptyVisitorIntentMemory()
  try {
    return parseVisitorIntentMemory(s.getItem(VISITOR_INTENT_STORAGE_KEY))
  } catch {
    return emptyVisitorIntentMemory()
  }
}

/** Store the memory. Returns false when storage refused (private mode, full, blocked). */
export function writeVisitorIntentMemory(memory: VisitorIntentMemory, storage?: IntentStorage | null): boolean {
  const s = resolveStorage(storage)
  if (!s) return false
  try {
    s.setItem(VISITOR_INTENT_STORAGE_KEY, JSON.stringify(memory))
    return true
  } catch {
    return false
  }
}

/** Forget this browser's intent (analytics consent is off). Never throws. */
export function clearVisitorIntent(storage?: IntentStorage | null): void {
  const s = resolveStorage(storage)
  if (!s) return
  try {
    s.removeItem(VISITOR_INTENT_STORAGE_KEY)
  } catch {
    /* nothing stored, or storage blocked */
  }
}

function update(
  opts: RecordOptions,
  apply: (memory: VisitorIntentMemory, now: number) => VisitorIntentMemory,
): VisitorIntentUpdate {
  if (!opts.consent) return NOT_RECORDED
  try {
    const now = opts.now ?? Date.now()
    const before = readVisitorIntentMemory(opts.storage)
    const after = apply(before, now)
    writeVisitorIntentMemory(after, opts.storage)
    return { visitor_intent: after.intent, primary_market: after.primaryMarket, changed: after.intent !== before.intent }
  } catch {
    return NOT_RECORDED
  }
}

/**
 * Record one page view (PageViewTracker, once per pathname). Returns the label
 * and market to push with the page context; both null without consent.
 */
export function recordPageVisit(pathname: string, opts: RecordOptions): VisitorIntentUpdate {
  return update(opts, (memory, now) => applyPageVisit(memory, pathname, now))
}

/**
 * Record one buyer or seller event (trackEvent). A name that is neither is not
 * recorded and returns nulls.
 */
export function recordIntentEvent(eventName: string, opts: RecordOptions): VisitorIntentUpdate {
  if (!isVisitorIntentEvent(eventName)) return NOT_RECORDED
  return update(opts, (memory, now) => applyIntentEvent(memory, eventName, now))
}

/**
 * Pushed when analytics consent is off: an `undefined` value REPLACES a key in
 * GTM's data model, so neither GA4 tag keeps sending the user properties this
 * page pushed before the visitor turned analytics off.
 */
export const VISITOR_INTENT_CLEAR_FIELDS: Readonly<Record<'visitor_intent' | 'primary_market', undefined>> = {
  visitor_intent: undefined,
  primary_market: undefined,
}

/** The flat dataLayer keys for a context, null fields left out (an undefined or null key would wipe GTM's stored value). */
export function visitorIntentDataLayerFields(ctx: VisitorIntentContext): Partial<Record<'visitor_intent' | 'primary_market', string>> {
  const out: Partial<Record<'visitor_intent' | 'primary_market', string>> = {}
  if (ctx.visitor_intent) out.visitor_intent = ctx.visitor_intent
  if (ctx.primary_market) out.primary_market = ctx.primary_market
  return out
}
