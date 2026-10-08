/**
 * Server-side automation classification for first-party visitor sessions
 * (P7 identity loop + TRACK-4, 2026-09-23).
 *
 * WHY. /api/visitors/track had no bot check, and the user agent is not STORED
 * at essential consent (97.5% of sessions), so nobody could tell a person from
 * a crawler after the fact. Measured 2026-09-23 over the 7 days to that date
 * (visitor_sessions, first_seen_at >= 2026-09-16, supabase-js read):
 * 1,062 sessions landed on /contact with no referrer, 987 of them on
 * `/contact?intent=<x>&listingKey=<mls>` (the "ask about this home" link on
 * every listing page), each on its own fresh rr_vid, 396 of 400 sampled with
 * exactly one event, around the clock. That is a JS-rendering crawler
 * following links, not 1,000 people. (Re-read 2026-09-23T06:09Z for the 7 days
 * from 2026-09-16T06:09Z: 882 such landings, see classifyArrivalShape.)
 *
 * WHAT. Classification uses only signals available at EVERY consent tier and
 * stores a class label, never the user agent itself:
 *   - declared-crawler  the UA names itself (Googlebot, Bingbot, GPTBot, ...)
 *   - tool              an HTTP library or scanner UA (curl, python-requests, ...)
 *   - headless          a headless or instrumented browser UA (HeadlessChrome,
 *                       PhantomJS, Puppeteer, Playwright, Selenium, Lighthouse)
 *   - webdriver         the page reported navigator.webdriver === true (set by
 *                       Selenium, Puppeteer and Playwright unless deliberately hidden)
 *   - empty-ua          no user agent at all
 *   - marker            our own script set the `rr_automation=1` marker
 * plus one PROVISIONAL behavioural class, contact-deep-link
 * (classifyArrivalShape below), which the session's second event clears.
 * Reading the UA header to classify is not storing it: the essential-tier rule
 * (docs/TRACKING_POLICY.md) is that the UA string is not kept.
 *
 * A flagged session is still recorded (so volume stays measurable) but it is
 * excluded from the known-people activity view and never mirrored into GA4; a
 * UA-flagged session is also never identified to a contact (the provisional
 * behavioural class does not block identification).
 *
 * Pure: no I/O. The regexes deliberately overlap middleware.ts's GOOD_BOT_RE /
 * BAD_BOT_RE (those decide what to BLOCK; this decides what to COUNT).
 */

export type AutomationReason =
  | 'declared-crawler'
  | 'tool'
  | 'headless'
  | 'webdriver'
  | 'empty-ua'
  | 'marker'
  | 'contact-deep-link'
  | 'internal'

export type AutomationClass = { automated: boolean; reason: AutomationReason | null }

export const DECLARED_CRAWLER_RE =
  /(bot\b|bot\/|crawler|spider|slurp|googleother|google-inspectiontool|google-extended|storebot-google|adsbot|mediapartners-google|feedfetcher|bingpreview|facebookexternalhit|facebookcatalog|meta-externalagent|gptbot|oai-searchbot|chatgpt-user|perplexity|claude-(?:web|user|searchbot)|anthropic-ai|cohere-ai|ccbot|bytespider|amazonbot|applebot|yandex|baiduspider|petalbot|semrush|ahrefs|mj12bot|dotbot|dataforseo|screaming frog|embedly|whatsapp|telegram|skypeuripreview|slack-imgproxy|vercel-screenshot|vercelbot)/i

export const TOOL_RE =
  /(curl\/|wget|python-requests|python-urllib|aiohttp|httpx|libwww-perl|java\/|okhttp|go-http-client|node-fetch|axios|undici|guzzlehttp|apache-httpclient|scrapy|httrack|zgrab|masscan|nmap|nikto|sqlmap|nuclei|wpscan|censys)/i

export const HEADLESS_RE = /(headlesschrome|headless|phantomjs|puppeteer|playwright|selenium|webdriver|chrome-lighthouse|lighthouse|pagespeed|prerender|rendertron)/i

export function classifyAutomation(args: {
  userAgent: string | null | undefined
  webdriver?: unknown
  /**
   * Our own scripts' explicit marker (the `rr_automation=1` cookie or query,
   * lib/analytics/ga-suppression.ts): every Playwright / Puppeteer launcher in
   * this repo sets it, so a capture that spoofs a desktop user agent and hides
   * navigator.webdriver is still known to be ours (Matt 2026-10-05, GA cleanup).
   */
  marker?: boolean
}): AutomationClass {
  if (args.marker === true) return { automated: true, reason: 'marker' }
  const ua = typeof args.userAgent === 'string' ? args.userAgent.trim() : ''
  if (!ua) return { automated: true, reason: 'empty-ua' }
  if (TOOL_RE.test(ua)) return { automated: true, reason: 'tool' }
  if (HEADLESS_RE.test(ua)) return { automated: true, reason: 'headless' }
  // `CUBOT` is an Android phone brand whose model string would read as "...bot".
  if (DECLARED_CRAWLER_RE.test(ua.replace(/cubot/gi, ''))) return { automated: true, reason: 'declared-crawler' }
  if (args.webdriver === true) return { automated: true, reason: 'webdriver' }
  return { automated: false, reason: null }
}

/**
 * A BEHAVIOURAL class, provisional: set at session birth, cleared by the track
 * route the moment the session records a second event (a person reads on and
 * clicks; the crawler never does). It never blocks identification, only the
 * GA4 mirror of that first view and the counts.
 *
 * `contact-deep-link`: a brand-new browser session whose FIRST page is
 * /contact?listingKey=<a listing> with no referrer, no campaign params and no
 * identity token. People reach that form from a listing page, so their session
 * already exists and its landing page is the listing, not the form.
 * Measured 2026-09-23T06:09Z over visitor_sessions first_seen_at >= 2026-09-16
 * (supabase-js read): 882 sessions landed this way, each on its own new rr_vid,
 * none lasting over 10 seconds, none identified, none in the identity map, and
 * all 300 sampled had exactly one event (a page_view). The UA classifier above
 * cannot see this crawler because the UA is not stored at essential consent.
 */
export const PROVISIONAL_AUTOMATION_REASONS: ReadonlySet<AutomationReason> = new Set<AutomationReason>([
  'contact-deep-link',
])

/**
 * THE rule for which sessions automation keeps unidentified, stated once. A session
 * may be identified when it is not flagged (visitor_sessions.is_automated), or is
 * flagged only for a provisional behavioural reason (PROVISIONAL_AUTOMATION_REASONS:
 * a person who reads on clears it, and it never blocks identification). Anything
 * else flagged (from the user agent or navigator.webdriver, or a flag with no reason)
 * never is (docs/TRACKING_POLICY.md, "Automation").
 *
 * Written once, as the PostgREST terms of an `or` filter, and read two ways:
 * IDENTIFIABLE_SESSION_FILTER sends the terms to the database (the browser
 * back-stitch selects the sessions it may identify with it), and
 * sessionBlocksIdentification evaluates the same terms on a row already in hand (the
 * identify paths). lib/visitor-backfill.test.ts runs the filter and the function over
 * every shape of row and fails when they disagree. Until 2026-09-30 the filter was a
 * string written out by hand beside the function (review of 2026-09-30).
 */
type IdentifiableTerm =
  | { column: 'is_automated'; op: 'is'; value: null }
  | { column: 'is_automated'; op: 'eq'; value: false }
  | { column: 'automation_reason'; op: 'in'; value: readonly string[] }

/**
 * `internal`: the browser carries the `rr_internal` cookie, set when a broker or
 * admin signs in to /admin (lib/analytics/ga-suppression.ts). The session is
 * flagged so counts of outside visitors leave it out and GA4 never sees it, but
 * it is a real person and never blocks identification: Matt clicking a tracked
 * link we sent him is how the owner-path send test is proven (Matt 2026-10-05).
 */
export const NON_BLOCKING_FLAG_REASONS: ReadonlySet<AutomationReason> = new Set<AutomationReason>([
  ...PROVISIONAL_AUTOMATION_REASONS,
  'internal',
])

const IDENTIFIABLE_SESSION: readonly IdentifiableTerm[] = [
  { column: 'is_automated', op: 'is', value: null },
  { column: 'is_automated', op: 'eq', value: false },
  { column: 'automation_reason', op: 'in', value: [...NON_BLOCKING_FLAG_REASONS] },
]

/** The rule as a PostgREST `or` filter: the sessions automation does not block. */
export const IDENTIFIABLE_SESSION_FILTER = IDENTIFIABLE_SESSION.map((t) =>
  t.op === 'in' ? `${t.column}.in.(${t.value.join(',')})` : `${t.column}.${t.op}.${String(t.value)}`,
).join(',')

function termHolds(t: IdentifiableTerm, row: Record<string, unknown>): boolean {
  const v = row[t.column]
  if (t.op === 'is') return v === null || v === undefined
  if (t.op === 'eq') return v === t.value
  return typeof v === 'string' && t.value.includes(v)
}

/** The rule on a row in hand: is this session automation that must never be identified? */
export function sessionBlocksIdentification(
  row: { is_automated?: unknown; automation_reason?: unknown } | null | undefined,
): boolean {
  if (!row) return false
  return !IDENTIFIABLE_SESSION.some((t) => termHolds(t, row as Record<string, unknown>))
}

export function classifyArrivalShape(args: {
  /** The session's first page, as the tracker captured it (full URL, query intact). */
  landingPage: string | null | undefined
  referrer: string | null | undefined
  /** An identity token arrived with the event (forwarded, not on the URL). */
  hasToken?: boolean
}): AutomationClass {
  const human: AutomationClass = { automated: false, reason: null }
  if (args.hasToken) return human
  if (typeof args.referrer === 'string' && args.referrer.trim()) return human
  if (typeof args.landingPage !== 'string' || !args.landingPage) return human
  try {
    const u = new URL(args.landingPage)
    // A link we sent or a tagged campaign is a person's click, never this class.
    // (The tracker labels an untagged arrival 'direct / none', so the landing
    // URL's own params are the evidence, not the session's utm columns.)
    for (const key of u.searchParams.keys()) {
      if (key.startsWith('utm_') || key === 'fbclid' || key === 'gclid' || key === '_pid' || key === 'agent') return human
    }
    const path = u.pathname.replace(/\/+$/, '') || '/'
    if (path === '/contact' && (u.searchParams.get('listingKey') ?? '').trim()) {
      return { automated: true, reason: 'contact-deep-link' }
    }
  } catch {
    /* unparseable landing page: no signal */
  }
  return human
}
