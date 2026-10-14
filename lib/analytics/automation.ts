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
 * plus PROVISIONAL classes for a cold arrival (no referrer, no campaign, no
 * identity token) that reads as a machine (classifyArrivalShape below):
 * contact-deep-link, stale-browser and datacenter-geo (2026-10-14). The
 * session's first sign of a person clears them (isPersonEvidence below), and so
 * does identification. Reading the UA and geo headers to classify is not storing
 * them: the essential-tier rule (docs/TRACKING_POLICY.md) is that neither is kept.
 *
 * A flagged session is still recorded (so volume stays measurable) but it is
 * excluded from the known-people activity view and never mirrored into GA4; a
 * UA-flagged session is also never identified to a contact (the provisional
 * behavioural class does not block identification).
 *
 * Pure: no I/O. The regexes deliberately overlap middleware.ts's GOOD_BOT_RE /
 * BAD_BOT_RE (those decide what to BLOCK; this decides what to COUNT).
 */

import { chromeSupersededAt } from './chrome-releases'

export type AutomationReason =
  | 'declared-crawler'
  | 'tool'
  | 'headless'
  | 'webdriver'
  | 'empty-ua'
  | 'marker'
  | 'contact-deep-link'
  | 'stale-browser'
  | 'datacenter-geo'
  | 'internal'

export type AutomationClass = { automated: boolean; reason: AutomationReason | null }

export const DECLARED_CRAWLER_RE =
  /(bot\b|bot\/|crawler|spider|slurp|googleother|google-inspectiontool|google-extended|storebot-google|adsbot|mediapartners-google|feedfetcher|bingpreview|facebookexternalhit|facebookcatalog|meta-externalagent|gptbot|oai-searchbot|chatgpt-user|perplexity|claude-(?:web|user|searchbot)|anthropic-ai|google-notebooklm|cohere-ai|ccbot|bytespider|amazonbot|applebot|yandex|baiduspider|petalbot|semrush|ahrefs|mj12bot|dotbot|dataforseo|screaming frog|embedly|whatsapp|telegram|skypeuripreview|slack-imgproxy|vercel-screenshot|vercelbot)/i

export const TOOL_RE =
  /(curl\/|wget|python-requests|python-urllib|aiohttp|httpx|libwww-perl|java\/|okhttp|go-http-client|node-fetch|axios|undici|guzzlehttp|apache-httpclient|scrapy|httrack|zgrab|masscan|nmap|nikto|sqlmap|nuclei|wpscan|censys)/i

export const HEADLESS_RE = /(headlesschrome|headless|phantomjs|puppeteer|playwright|selenium|webdriver|chrome-lighthouse|lighthouse|pagespeed|prerender|rendertron)/i

/**
 * The `Sec-CH-UA` client hint (the brand list Chromium sends on every https
 * request, fetch and sendBeacon included) of a headless Chromium. A scripted
 * browser that overrides its user agent to read as desktop Chrome usually
 * leaves this header alone, and no browser a person uses names itself
 * HeadlessChrome. 2026-10-14; the header is not stored, so its hits on history
 * cannot be counted.
 */
export const HEADLESS_HINT_RE = /headlesschrome/i

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
  /** The request's `Sec-CH-UA` header (HEADLESS_HINT_RE). */
  clientHints?: string | null
}): AutomationClass {
  if (args.marker === true) return { automated: true, reason: 'marker' }
  const ua = typeof args.userAgent === 'string' ? args.userAgent.trim() : ''
  if (!ua) return { automated: true, reason: 'empty-ua' }
  if (TOOL_RE.test(ua)) return { automated: true, reason: 'tool' }
  if (HEADLESS_RE.test(ua)) return { automated: true, reason: 'headless' }
  if (typeof args.clientHints === 'string' && HEADLESS_HINT_RE.test(args.clientHints)) {
    return { automated: true, reason: 'headless' }
  }
  // `CUBOT` is an Android phone brand whose model string would read as "...bot".
  if (DECLARED_CRAWLER_RE.test(ua.replace(/cubot/gi, ''))) return { automated: true, reason: 'declared-crawler' }
  if (args.webdriver === true) return { automated: true, reason: 'webdriver' }
  return { automated: false, reason: null }
}

/**
 * BEHAVIOURAL classes, provisional: set at session birth on a COLD arrival (no
 * referrer, no campaign or click id on the landing URL, no identity token), and
 * cleared by the track route the moment the session shows a person
 * (isPersonEvidence: a second page, a scroll, a search, a click, a form) or is
 * identified. They never block identification; they keep the session out of the
 * counts of outside visitors and its first view out of the GA4 mirror.
 *
 * `contact-deep-link`: a brand-new browser session whose FIRST page is
 * /contact?listingKey=<a listing>. People reach that form from a listing page,
 * so their session already exists and its landing page is the listing, not the
 * form. Measured 2026-09-23T06:09Z over visitor_sessions first_seen_at >=
 * 2026-09-16 (supabase-js read): 882 sessions landed this way, each on its own
 * new rr_vid, none lasting over 10 seconds, none identified, none in the
 * identity map, and all 300 sampled had exactly one event (a page_view).
 *
 * `stale-browser` (2026-10-14): desktop Google Chrome (Windows, macOS or Linux)
 * whose major version was superseded by the next stable release more than
 * STALE_BROWSER_DAYS before the request (CHROME_STABLE_DATES, the Chromium
 * schedule). Desktop Chrome updates itself; crawlers pin a build and rotate a
 * handful of user-agent strings. See docs/TRACKING_POLICY.md "Automation" for
 * the measured clusters and the identified-human check.
 *
 * `datacenter-geo` (2026-10-14): the request's IP geolocates to a town whose
 * traffic here is cloud egress (DATACENTER_LOCALITIES). Measured the same way.
 */
export const PROVISIONAL_AUTOMATION_REASONS: ReadonlySet<AutomationReason> = new Set<AutomationReason>([
  'contact-deep-link',
  'stale-browser',
  'datacenter-geo',
])

/** Is this automation_reason one of the provisional, self-clearing classes? */
export function isProvisionalReason(reason: unknown): boolean {
  return typeof reason === 'string' && PROVISIONAL_AUTOMATION_REASONS.has(reason as AutomationReason)
}

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

/** Campaign, click-id and link parameters: a landing URL carrying one is a click we can name. */
const ARRIVAL_PARAM_RE = /^(utm_.+|fbclid|gclid|msclkid|ttclid|_pid|agent|rr_doc)$/

/**
 * Desktop Google Chrome's major version from a user agent, or null for anything
 * else: phones and tablets, ChromeOS (school and kiosk Chromebooks are pinned
 * to old builds by policy), and the Chromium browsers that ship on their own
 * schedule (Edge, Opera, Samsung Internet, Yandex, Vivaldi, UC).
 */
export function desktopChromeMajor(userAgent: string | null | undefined): number | null {
  if (typeof userAgent !== 'string') return null
  const ua = userAgent.trim()
  if (!/\((?:Windows NT|Macintosh;|X11; Linux)/.test(ua)) return null
  if (/Android|Mobile|CrOS|Edg\/|EdgA\/|OPR\/|SamsungBrowser|YaBrowser|Vivaldi|UCBrowser|CriOS/i.test(ua)) return null
  const m = ua.match(/\bChrome\/(\d+)\./)
  return m ? Number(m[1]) : null
}

/** More than this many days after the next Chrome went stable, a build is stale (STALE rule). */
export const STALE_BROWSER_DAYS = 45

/** Is this desktop Chrome more than STALE_BROWSER_DAYS behind its successor's stable release at `atMs`? */
export function isStaleDesktopChrome(userAgent: string | null | undefined, atMs: number): boolean {
  const major = desktopChromeMajor(userAgent)
  if (major === null) return false
  const superseded = chromeSupersededAt(major)
  if (superseded === null) return false
  return atMs - superseded > STALE_BROWSER_DAYS * 86_400_000
}

/**
 * Towns whose visits here are cloud and datacenter egress, by Vercel's IP geo
 * (x-vercel-ip-city / x-vercel-ip-country-region, US only). Each one carries the
 * hyperscale site that puts its name on cloud addresses. Prineville, OR hosts
 * Meta and Apple datacenters and is deliberately absent: it is a town this
 * brokerage serves. The measured share per town is in docs/TRACKING_POLICY.md.
 */
export const DATACENTER_LOCALITIES: ReadonlyArray<{ city: string; region: string; site: string }> = [
  { city: 'Santa Clara', region: 'CA', site: 'colocation and cloud campus (Silicon Valley)' },
  { city: 'Ashburn', region: 'VA', site: 'AWS us-east-1 and the Loudoun County campuses' },
  { city: 'Council Bluffs', region: 'IA', site: 'Google us-central1' },
  { city: 'Boardman', region: 'OR', site: 'AWS us-west-2' },
  { city: 'The Dalles', region: 'OR', site: 'Google us-west1' },
  { city: 'Moncks Corner', region: 'SC', site: 'Google us-east1' },
]

export type IpGeo = { city?: string | null; region?: string | null; country?: string | null }

export function isDatacenterLocality(geo: IpGeo | null | undefined): boolean {
  if (!geo) return false
  const country = (geo.country ?? '').trim().toUpperCase()
  if (country !== 'US') return false
  const city = (geo.city ?? '').trim().toLowerCase()
  const region = (geo.region ?? '').trim().toUpperCase()
  if (!city || !region) return false
  return DATACENTER_LOCALITIES.some((l) => l.city.toLowerCase() === city && l.region === region)
}

/**
 * Event types only a person produces: a search, a click, a scroll, a save, a form
 * or sign-in. Not `section_view` (it fires when a section renders in view, which a
 * tall headless viewport does on load) and not `welcome_back` (fired on arrival).
 */
export const PERSON_EVIDENCE_EVENTS: ReadonlySet<string> = new Set([
  'search',
  'cta_click',
  'save_listing',
  'scroll_depth',
  'intent_declared',
  'email_opt',
  'sms_opt',
  'join_convert',
  'identify',
  'signin',
])

function pathOf(url: string | null | undefined): string | null {
  if (typeof url !== 'string' || !url) return null
  try {
    return new URL(url).pathname.replace(/\/+$/, '') || '/'
  } catch {
    return null
  }
}

/**
 * Does this event show a person? An interaction (PERSON_EVIDENCE_EVENTS), or a
 * view of a page other than the one the session landed on (the visitor moved
 * on). A repeat view of the landing page and a section render do not. Clears a
 * provisional class (PROVISIONAL_AUTOMATION_REASONS); at session birth it keeps
 * one from being set.
 */
export function isPersonEvidence(args: {
  eventType: string | null | undefined
  pageUrl: string | null | undefined
  landingPage: string | null | undefined
}): boolean {
  const type = typeof args.eventType === 'string' ? args.eventType : ''
  if (PERSON_EVIDENCE_EVENTS.has(type)) return true
  if (type !== 'page_view' && type !== 'listing_view') return false
  const here = pathOf(args.pageUrl)
  const landed = pathOf(args.landingPage)
  return here !== null && landed !== null && here !== landed
}

/**
 * The provisional class of a session's arrival (PROVISIONAL_AUTOMATION_REASONS),
 * from what is true of every event the session sends: the landing page and
 * referrer the tracker captured at first touch, the identity token, and the
 * request's user agent and IP geo HEADERS (read to classify at every consent
 * tier, never stored at essential). A cold arrival only: a referrer, a campaign
 * or click id on the landing URL, or a token is a click we can name, and is
 * never flagged. Pure; `atMs` is the request time.
 */
export function classifyArrivalShape(args: {
  /** The session's first page, as the tracker captured it (full URL, query intact). */
  landingPage: string | null | undefined
  referrer: string | null | undefined
  /** An identity token arrived with the event (forwarded, not on the URL). */
  hasToken?: boolean
  /** The request's User-Agent header (stale-browser). */
  userAgent?: string | null
  /** The request's IP geo headers (datacenter-geo). */
  geo?: IpGeo | null
  /** Request time, epoch ms (stale-browser). Defaults to now. */
  atMs?: number
}): AutomationClass {
  const human: AutomationClass = { automated: false, reason: null }
  if (args.hasToken) return human
  if (typeof args.referrer === 'string' && args.referrer.trim()) return human
  if (typeof args.landingPage !== 'string' || !args.landingPage) return human
  let u: URL
  try {
    u = new URL(args.landingPage)
  } catch {
    return human /* unparseable landing page: no signal */
  }
  // A link we sent or a tagged campaign is a person's click, never this class.
  // (The tracker labels an untagged arrival 'direct / none', so the landing
  // URL's own params are the evidence, not the session's utm columns.)
  for (const key of u.searchParams.keys()) {
    if (ARRIVAL_PARAM_RE.test(key)) return human
  }
  const path = u.pathname.replace(/\/+$/, '') || '/'
  if (path === '/contact' && (u.searchParams.get('listingKey') ?? '').trim()) {
    return { automated: true, reason: 'contact-deep-link' }
  }
  if (isStaleDesktopChrome(args.userAgent, args.atMs ?? Date.now())) {
    return { automated: true, reason: 'stale-browser' }
  }
  if (isDatacenterLocality(args.geo)) return { automated: true, reason: 'datacenter-geo' }
  return human
}
