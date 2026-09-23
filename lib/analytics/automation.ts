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
  | 'contact-deep-link'

export type AutomationClass = { automated: boolean; reason: AutomationReason | null }

const DECLARED_CRAWLER_RE =
  /(bot\b|bot\/|crawler|spider|slurp|googleother|google-inspectiontool|google-extended|storebot-google|adsbot|mediapartners-google|feedfetcher|bingpreview|facebookexternalhit|facebookcatalog|meta-externalagent|gptbot|oai-searchbot|chatgpt-user|perplexity|claude-(?:web|user|searchbot)|anthropic-ai|cohere-ai|ccbot|bytespider|amazonbot|applebot|yandex|baiduspider|petalbot|semrush|ahrefs|mj12bot|dotbot|dataforseo|screaming frog|embedly|whatsapp|telegram|skypeuripreview|slack-imgproxy|vercel-screenshot|vercelbot)/i

const TOOL_RE =
  /(curl\/|wget|python-requests|python-urllib|aiohttp|httpx|libwww-perl|java\/|okhttp|go-http-client|node-fetch|axios|undici|guzzlehttp|apache-httpclient|scrapy|httrack|zgrab|masscan|nmap|nikto|sqlmap|nuclei|wpscan|censys)/i

const HEADLESS_RE = /(headlesschrome|headless|phantomjs|puppeteer|playwright|selenium|webdriver|chrome-lighthouse|lighthouse|pagespeed|prerender|rendertron)/i

export function classifyAutomation(args: {
  userAgent: string | null | undefined
  webdriver?: unknown
}): AutomationClass {
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
