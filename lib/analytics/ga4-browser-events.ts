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
 * bootstrap and PageViewTracker stamp them on every navigation.
 *
 * PRIVACY. Only the parameters in GA4_EVENT_PARAMS go into ga4_params, so a
 * call that also carries phone_number, email_to, href or a page path for the
 * first-party store never hands those to GA4.
 */

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
  page_view: "GTM's Google tag owns page_view (first paint plus enhanced measurement's history changes). A second one doubles page views.",
}

/**
 * The GA4 Event tag's parameter table, in GTM order. `from` is the dataLayer
 * key the tag's Data Layer Variable reads (version 2).
 */
export const GA4_EVENT_PARAMS = [
  // Page context: flat keys on purpose (stamped on every navigation).
  { name: 'page_type', from: 'page_type' },
  { name: 'broker_slug', from: 'broker_slug' },
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
 * The GA4 parameters for one event: allowlisted names only, aliases folded to
 * the canonical name (an explicit canonical key wins over an alias), scalars
 * only, strings capped at GA4's 100 characters.
 */
export function ga4ParamsFrom(params: Record<string, unknown> = {}): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  const put = (name: string, raw: unknown, overwrite: boolean) => {
    if (!PER_EVENT_PARAMS.has(name)) return
    if (!overwrite && name in out) return
    if (typeof raw === 'string') {
      const v = raw.trim()
      if (v) out[name] = v.slice(0, GA4_PARAM_VALUE_MAX)
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

/**
 * Push one event for GTM: clear the previous event's ga4_params, then push
 * `{ event, ...params, ga4_params }`. The flat params stay for the existing
 * dataLayer readers; GA4 only ever sees ga4_params plus the page context.
 */
export function pushDataLayerEvent(eventName: string, params: Record<string, unknown> = {}): void {
  if (typeof window === 'undefined') return
  const w = window as Window & { dataLayer?: unknown[] }
  w.dataLayer = w.dataLayer || []
  w.dataLayer.push({ [GA4_PARAMS_KEY]: null })
  // Undefined values are dropped: GTM's data model would store them and wipe a
  // sticky page-context key such as broker_slug.
  const flat: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(params)) if (value !== undefined) flat[key] = value
  w.dataLayer.push({ event: eventName, ...flat, [GA4_PARAMS_KEY]: ga4ParamsFrom(params) })
}
