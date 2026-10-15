/**
 * Browser GA4 events: what the page pushes, and the GTM tag that sends them.
 *
 * WHY THIS FILE EXISTS. Commit 1224b1f (2026-08-18, "stop dual GA4 tags")
 * removed the in-page gtag('config', 'G-ST40W4WM6T') so GTM-WV6R4NZ5's Google
 * tag is the only GA4 config. From then on a bare gtag('event', name, params)
 * had no destination: the events sat in dataLayer and no /g/collect hit ever
 * carried them. section_view's last GA4 data is the week of 2026-08-17 and
 * call_initiated read 0 for Sep 10 to Oct 7 (Analytics audit 2026-10-08,
 * optimization plan B1). A headless probe on
 * the live site on 2026-10-08, with every outgoing hit blocked, confirmed it: a bare
 * gtag('event') sent nothing, a plain dataLayer event sent nothing (the
 * container has no event tag), and only a page_view and scroll went out.
 *
 * THE FIX. Browser events reach GA4 through ONE GA4 Event tag in GTM, fired by
 * a Custom Event trigger on the names in GA4_BROWSER_EVENTS. The page never
 * calls gtag('event') for GA4 itself, so publishing that tag cannot double
 * count. Matt publishes GTM himself; the exact steps are in
 * docs/GTM_GA4_BROWSER_EVENTS.md, and ga4-browser-events.test.ts
 * keeps that doc, the trigger regex and the parameter table in step with this
 * file.
 *
 * STALE PARAMETERS. GTM's data model keeps every key ever pushed. A tag that
 * read flat keys would send the last section_view's `section` on the next
 * click_cta. So each event's GA4 parameters ride in one object, `ga4_params`,
 * which is cleared (`{ ga4_params: null }`, Google's ecommerce-reset pattern)
 * before every push. The tag reads `ga4_params.<name>` only. page_type and
 * broker_slug are page context on purpose and stay flat keys: the GTM
 * bootstrap and PageViewTracker stamp them on every navigation. So are the
 * user properties visitor_intent and primary_market (GA4_USER_PROPERTIES).
 *
 * PRIVACY. Only the parameters in GA4_EVENT_PARAMS go into ga4_params, so a
 * call that also carries phone_number, email_to, href or a page path for the
 * first-party store never hands those to GA4. Their values go through
 * ga4SafeParamValue too (an email address or phone number is dropped, a CMA
 * document slug in lp_campaign becomes cma-letter), and every hit's
 * page_location is the GA4-safe address (setGa4PageLocation below): no
 * personal information reaches GA4 (Matt 2026-10-14).
 */

import { ga4SafeParamValue, stripGa4UrlParams } from '@/app/api/visitors/track/strip-identity'

export const GA4_MEASUREMENT_ID = 'G-ST40W4WM6T'

/** The dataLayer key the GTM GA4 Event tag reads its parameters from. */
export const GA4_PARAMS_KEY = 'ga4_params'

/**
 * Every browser event name the GTM GA4 Event tag sends. Names come from the
 * EventName union in lib/tracking.ts plus the two non-trackEvent senders
 * (WebVitalsReporter, NotFoundClient). The test fails when the union gains a
 * name that is in neither this list nor GA4_BROWSER_EVENTS_NOT_SENT.
 */
export const GA4_BROWSER_EVENTS = [
  // trackEvent (lib/tracking.ts EventName)
  'tour_requested',
  'schedule_tour_click',
  'schedule_showing_click',
  'ask_question_click',
  'contact_agent_click',
  'email_agent',
  'call_initiated',
  'text_initiated',
  'cma_downloaded',
  'cma_anchor_click',
  'place_value_answer',
  'address_submit',
  'sign_up',
  'open_house_rsvp',
  'open_house_page_view',
  'view_listing',
  'save_listing',
  'like_listing',
  'share_listing',
  'compare_listing',
  'compare_add',
  'compare_remove',
  'compare_share',
  'compare_pdf_download',
  'share',
  'view_photo_gallery',
  'play_video',
  'view_similar_listings',
  'search',
  'save_search',
  'view_community',
  'view_city',
  'view_neighborhood',
  'view_blog_post',
  'view_market_report',
  'download_report',
  'scroll_depth',
  'section_view',
  'click_cta',
  'calculator_used',
  'calculator_interact',
  'map_interaction',
  'share_collection',
  'ai_compare_used',
  'return_visit',
  'exit_intent_shown',
  'homepage_view',
  'hero_search',
  'hero_impression',
  'hero_city_chip',
  'featured_impression',
  'view_featured_listings',
  'community_impression',
  'newsletter_signup',
  'community_cta_click',
  'city_cta_click',
  'broker_view',
  'contact_agent',
  'view_landing_page',
  'pulse_feed_entry',
  'pulse_card_view',
  'pulse_card_like',
  'pulse_card_share',
  'pulse_cta_click',
  'pulse_filter_change',
  'nav_interact',
  'dwell',
  'module_interact',
  // components/NotFoundClient.tsx
  'page_not_found',
  // components/WebVitalsReporter.tsx (Next's metric names, sent as-is since 2026-05)
  'LCP',
  'INP',
  'CLS',
  'FCP',
  'TTFB',
] as const

export type Ga4BrowserEvent = (typeof GA4_BROWSER_EVENTS)[number]

/**
 * Names the page may push that the GTM tag must NOT send, and why. A name here
 * is still pushed to dataLayer (other consumers, tests); it just never matches
 * the trigger.
 */
export const GA4_BROWSER_EVENTS_NOT_SENT: Readonly<Record<string, string>> = {
  generate_lead:
    'Sent once, from the server (Measurement Protocol) with a fixed lead_type. A browser copy would double count every lead (plan B1/B2).',
  form_start:
    "GA4 enhanced measurement's Form interactions already sends form_start. Add it here to the sent list only after Matt turns that toggle off.",
  valuation_requested:
    'Sent from the server by lib/cma-request.ts for the same seller-LP, FSBO and place-page submissions. A browser copy would count each one twice.',
  page_view:
    'Sent by its own GTM tag, "GA4 - page_view" on trigger "CE page_view" (GA4_PAGE_VIEW_PARAMS), never by this shared tag. The bootstrap pushes the first paint, PageViewTracker one per pathname change.',
}

/** The GTM tag that is the only page_view sender (GTM version 9, 2026-10-14). */
export const GA4_PAGE_VIEW_TAG_NAME = 'GA4 - page_view'
/** Its trigger: Custom Event, event name equals `page_view`. */
export const GA4_PAGE_VIEW_TRIGGER_NAME = 'CE page_view'

/**
 * The "GA4 - page_view" tag's parameter table. All flat keys: the bootstrap
 * and PageViewTracker push them in the page_view message itself, so the Data
 * Layer Variable reads that message's value. page_location is GA4-safe
 * (stripGa4UrlParams: no contact id, typed address, inquiry or CMA slug);
 * page_referrer is the previous page on a client-side navigation and absent
 * on first paint, where the tag takes the safe document.referrer the
 * bootstrap's `gtag('set')` gave every hit.
 */
export const GA4_PAGE_VIEW_PARAMS = [
  { name: 'page_type', from: 'page_type' },
  { name: 'broker_slug', from: 'broker_slug' },
  // GA4's built-in Content group dimension, the same value as page_type (GTM version 10).
  { name: 'content_group', from: 'page_type' },
  { name: 'page_location', from: 'page_location' },
  { name: 'page_referrer', from: 'page_referrer' },
] as const

/**
 * GA4 user properties both GA4 Event tags set ("GA4 - page_view" and
 * "GA4 - dataLayer events", GTM version 10, 2026-10-14). `from` is the flat
 * dataLayer key. They come from lib/analytics/visitor-intent.ts, the one
 * buyer / seller / both / browsing definition the CRM's page categories use:
 * PageViewTracker pushes both with the page context before every page_view, the
 * inline bootstrap adds the stored values to the first-paint page_view, and
 * trackEvent pushes a new visitor_intent before the buyer or seller event that
 * changed it. Registered in GA4 as user-scoped custom dimensions
 * (scripts/ga4-admin-setup.mjs) and used by the "Visitor intent: …" audiences
 * (scripts/ga4-admin.mjs).
 */
export const GA4_USER_PROPERTIES = [
  { name: 'visitor_intent', from: 'visitor_intent' },
  { name: 'primary_market', from: 'primary_market' },
] as const

/**
 * The GA4 Event tag's parameter table, in GTM order. `from` is the dataLayer
 * key the tag's Data Layer Variable reads (version 2).
 */
export const GA4_EVENT_PARAMS = [
  // Page context: flat keys on purpose (stamped on every navigation).
  { name: 'page_type', from: 'page_type' },
  { name: 'broker_slug', from: 'broker_slug' },
  // GA4's built-in Content group dimension mirrors page_type (GTM version 10).
  { name: 'content_group', from: 'page_type' },
  // Per-event parameters: cleared before every push.
  { name: 'source', from: 'ga4_params.source' },
  { name: 'context', from: 'ga4_params.context' },
  { name: 'surface', from: 'ga4_params.surface' },
  { name: 'cta', from: 'ga4_params.cta' },
  { name: 'cta_location', from: 'ga4_params.cta_location' },
  { name: 'action', from: 'ga4_params.action' },
  { name: 'method', from: 'ga4_params.method' },
  { name: 'value', from: 'ga4_params.value' },
  { name: 'currency', from: 'ga4_params.currency' },
  { name: 'section', from: 'ga4_params.section' },
  { name: 'depth', from: 'ga4_params.depth' },
  { name: 'search_term', from: 'ga4_params.search_term' },
  { name: 'form', from: 'ga4_params.form' },
  { name: 'form_id', from: 'ga4_params.form_id' },
  { name: 'lead_type', from: 'ga4_params.lead_type' },
  { name: 'listing_key', from: 'ga4_params.listing_key' },
  { name: 'city', from: 'ga4_params.city' },
  { name: 'city_slug', from: 'ga4_params.city_slug' },
  { name: 'community_slug', from: 'ga4_params.community_slug' },
  { name: 'place', from: 'ga4_params.place' },
  { name: 'lp_variant', from: 'ga4_params.lp_variant' },
  { name: 'lp_source', from: 'ga4_params.lp_source' },
  { name: 'lp_medium', from: 'ga4_params.lp_medium' },
  { name: 'lp_campaign', from: 'ga4_params.lp_campaign' },
  { name: 'lp_content', from: 'ga4_params.lp_content' },
  { name: 'metric_id', from: 'ga4_params.metric_id' },
  { name: 'metric_rating', from: 'ga4_params.metric_rating' },
  // dwell: the threshold reached (15, 30, 45, 60, 120, 300 seconds).
  { name: 'seconds', from: 'ga4_params.seconds' },
] as const

const PER_EVENT_PARAMS: ReadonlySet<string> = new Set(
  GA4_EVENT_PARAMS.filter((p) => p.from.startsWith(`${GA4_PARAMS_KEY}.`)).map((p) => p.name),
)

/**
 * Callers name the same fact several ways (section vs section_id, depth vs
 * percent vs depth_percent). GA4 gets one name per fact; the flat dataLayer
 * keys and the first-party store keep whatever the caller sent.
 */
export const GA4_PARAM_ALIASES: Readonly<Record<string, string>> = {
  section_id: 'section',
  percent: 'depth',
  depth_percent: 'depth',
  listing_id: 'listing_key',
  place_slug: 'place',
  cta_label: 'cta',
  cta_context: 'cta_location',
}

/** GA4 caps an event parameter value at 100 characters. */
const GA4_PARAM_VALUE_MAX = 100

/**
 * LISTING KEYS STAY TEXT. A listing key is a 26-digit string. GTM's tag sends a
 * JS string as `ep.listing_key` (only a JS number goes as `epn.`), but GA4's
 * collection still reads an all-digit `ep.` value as a number: on 2026-10-08
 * every listing_key in GA4 was a double such as 2.0251020154621696e+25, the
 * last nine or so digits gone. A non-numeric prefix keeps it a string end to
 * end with no GTM change (same DLV, same tag). Only GA4's copy is prefixed;
 * the flat dataLayer keys, the first-party store and the Meta content_ids keep
 * the bare key. Strip `lk_` to join a GA4 export back to listings.
 */
export const GA4_LISTING_KEY_PREFIX = 'lk_'

/** True for a value GA4 would read as a number (digits, decimal, exponent). */
const NUMERIC_LOOKING = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/

/** The GA4 form of a listing key: `lk_<key>` when the key would read as a number. */
export function ga4ListingKey(raw: string | number): string | null {
  const v = typeof raw === 'number' ? (Number.isFinite(raw) ? String(raw) : '') : raw.trim()
  if (!v) return null
  return NUMERIC_LOOKING.test(v) ? `${GA4_LISTING_KEY_PREFIX}${v}` : v
}

/**
 * The GA4 parameters for one event: allowlisted names only, aliases folded to
 * the canonical name (an explicit canonical key wins over an alias), scalars
 * only, strings capped at GA4's 100 characters.
 */
export function ga4ParamsFrom(params: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  const put = (name: string, raw: unknown, overwrite: boolean) => {
    if (!PER_EVENT_PARAMS.has(name)) return
    if (!overwrite && name in out) return
    if (name === 'listing_key' && (typeof raw === 'string' || typeof raw === 'number')) {
      const v = ga4ListingKey(raw)
      if (v) out[name] = v.slice(0, GA4_PARAM_VALUE_MAX)
      return
    }
    if (typeof raw === 'string') {
      const safe = ga4SafeParamValue(name, raw.trim())
      if (safe) out[name] = safe.slice(0, GA4_PARAM_VALUE_MAX)
    } else if (typeof raw === 'number') {
      if (Number.isFinite(raw)) out[name] = raw
    } else if (typeof raw === 'boolean') {
      out[name] = raw
    }
  }
  for (const [key, raw] of Object.entries(params)) {
    const alias = GA4_PARAM_ALIASES[key]
    if (alias) put(alias, raw, false)
    else put(key, raw, true)
  }
  return out
}

/** The GTM Custom Event trigger's regex (tick "Use regex matching"). */
export function ga4BrowserEventTriggerRegex(): string {
  return `^(${GA4_BROWSER_EVENTS.join('|')})$`
}

export function isGa4BrowserEvent(name: string): name is Ga4BrowserEvent {
  return (GA4_BROWSER_EVENTS as readonly string[]).includes(name)
}

/** The last page_location handed to `gtag('set')` from React (the inline bootstrap sets the first). */
let lastGa4PageLocation: string | undefined
/** The raw location.href that was last checked, so an unchanged address is not re-parsed per event. */
let lastCheckedHref: string | undefined

/**
 * `gtag('set', { page_location, page_referrer })`: from here on, EVERY GA4 hit
 * on the page (both GTM GA4 Event tags and the Google tag's own events, such as
 * form_start and user_engagement) carries this address instead of the
 * browser's. Both values go through stripGa4UrlParams, so a person's typed
 * address (`/sell?address=`), inquiry text, contact id or CMA slug never
 * reaches GA4. The inline bootstrap sets the first page (gtm-bootstrap.ts);
 * PageViewTracker calls this on every client-side navigation, and
 * pushDataLayerEvent refreshes page_location when only the query changed.
 * Pushed as a gtag command (an `arguments` object), the form GTM reads.
 */
export function setGa4PageLocation(href: string, referrer?: string): void {
  if (typeof window === 'undefined') return
  const location = stripGa4UrlParams(href)
  if (!location) return
  const fields: Record<string, string> = { page_location: location }
  const ref = referrer ? stripGa4UrlParams(referrer) : undefined
  if (ref) fields.page_referrer = ref
  const w = window as Window & { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  gtagSet.call(w.dataLayer, 'set', fields)
  lastGa4PageLocation = location
  lastCheckedHref = href
}

/**
 * Record that `href` is already set without pushing anything: on first paint
 * the inline bootstrap made the `gtag('set')` itself (gtm-bootstrap.ts).
 */
export function noteGa4PageLocationSet(href: string): void {
  lastGa4PageLocation = stripGa4UrlParams(href)
  lastCheckedHref = href
}

/**
 * Set page_location again when the address changed since the last check and
 * its GA4-safe form differs from what was set (a query-only change: a map move,
 * a filter). Cheap when nothing moved: one string compare. Never throws.
 */
export function refreshGa4PageLocation(): void {
  if (typeof window === 'undefined') return
  try {
    const href = window.location.href
    if (href === lastCheckedHref) return
    lastCheckedHref = href
    const here = stripGa4UrlParams(href)
    if (here && here !== lastGa4PageLocation) setGa4PageLocation(href)
  } catch {
    /* tracking never breaks a page */
  }
}

/**
 * The inline bootstrap's `gtag()`: push the call's own `arguments` object,
 * the only form GTM treats as a gtag command (an array is read as data).
 * Called with the dataLayer as `this`.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- the arguments object is the payload
function gtagSet(this: unknown[], _command: 'set', _fields: Record<string, string>): void {
  // eslint-disable-next-line prefer-rest-params -- see above
  this.push(arguments)
}

/**
 * Push one event for GTM: clear the previous event's ga4_params, then push
 * `{ event, ...params, ga4_params }`. The flat params stay for the existing
 * dataLayer readers; GA4 only ever sees ga4_params plus the page context.
 * When the page's GA4-safe address changed since the last `gtag('set')` (a
 * query-only change such as a map move), it is set again first, so the event
 * names the page it happened on.
 */
export function pushDataLayerEvent(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  refreshGa4PageLocation()
  w.dataLayer.push({ [GA4_PARAMS_KEY]: null })
  // Undefined values are dropped: GTM's data model would store them and wipe a
  // sticky page-context key such as broker_slug.
  const flat: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) if (value !== undefined) flat[key] = value
  w.dataLayer.push({ event: eventName, ...flat, [GA4_PARAMS_KEY]: ga4ParamsFrom(params) })
}
