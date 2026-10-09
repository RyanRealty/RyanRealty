import { DECLARED_CRAWLER_RE, HEADLESS_RE, TOOL_RE, classifyAutomation } from './automation'

/**
 * THE decision on whether a page view may reach Google Analytics (GA4 property
 * 527333348, G-ST40W4WM6T, loaded through GTM-WV6R4NZ5). Matt 2026-10-05: GA4
 * counts only real outside visitors, and internal users are identified by login.
 *
 * WHY. A read-only audit on 2026-10-05 found four leaks into the production
 * property: the taste/site-queue capture tool (scripts/take-route-shots.mjs)
 * spoofed a desktop Chrome user agent AND granted analytics consent, so gtag
 * counted it (~128 sessions in 4 weeks); local `next build && next start` runs
 * loaded gtag on 127.0.0.1 (82-91 sessions, hostName 127.0.0.1); ad-hoc headless
 * probes (~34 sessions); and GTM fired on /admin (117 admin page views) and
 * counted Matt and the brokers browsing their own site.
 *
 * Read by BOTH writers to GA4, so the browser and the server cannot disagree:
 *   - the browser loaders (components/GTMHead.tsx via lib/analytics/gtm-bootstrap.ts,
 *     components/GoogleAnalytics.tsx) run GA_SUPPRESS_JS, the same rule as one
 *     JavaScript expression, BEFORE gtm.js or gtag.js is requested: a suppressed
 *     page loads no Google tag at all. It cannot be decided during the React
 *     render (hydration would disagree with the server render), which is why it
 *     is an inline expression, the pattern PRIVATE_PATH_JS set.
 *   - the server Measurement Protocol mirror (app/api/visitors/track/route.ts)
 *     calls decideGaSuppression on the page the tracker reports.
 * ga-suppression.test.ts runs the expression and the function over the same
 * cases and fails when they disagree.
 *
 * Suppressed when ANY of:
 *   (a) admin-path           the page is /admin or under it
 *   (b) non-production-host  the page host is not ryan-realty.com or a subdomain
 *                            of it (localhost, 127.0.0.1, *.vercel.app previews)
 *   (c) automation           navigator.webdriver, an automation user agent
 *                            (the classifier in automation.ts), or our explicit
 *                            marker: cookie `rr_automation=1` or `?rr_automation=1`
 *   (d) internal-user        cookie `rr_internal=1`, set on sign-in to /admin and
 *                            refreshed on every authenticated admin page load
 *                            (app/actions/internal-browser.ts)
 *
 * Consent is not part of this decision and nothing here changes what a real
 * visitor is asked or what Consent Mode defaults to.
 */

export const PRODUCTION_HOST = 'ryan-realty.com'
export const AUTOMATION_MARKER_COOKIE = 'rr_automation'
export const AUTOMATION_MARKER_QUERY = 'rr_automation'
export const INTERNAL_USER_COOKIE = 'rr_internal'
/** A year: a broker who signs in once a year stays excluded. */
export const INTERNAL_USER_COOKIE_MAX_AGE_S = 365 * 24 * 60 * 60

export type GaSuppressionReason = 'admin-path' | 'non-production-host' | 'automation' | 'internal-user'
export type GaSuppression = { suppress: boolean; reason: GaSuppressionReason | null }

export type GaSuppressionInput = {
  /** The page's path (no query). */
  pathname: string | null | undefined
  /** The page's hostname; a port is ignored. */
  host: string | null | undefined
  /** The page's query string, with or without the leading `?`. */
  search?: string | null
  userAgent: string | null | undefined
  /** navigator.webdriver as the page reported it. */
  webdriver?: unknown
  /** A raw `Cookie` header / `document.cookie` string. */
  cookieHeader?: string | null
}

export function isAdminPath(pathname: string | null | undefined): boolean {
  if (typeof pathname !== 'string') return false
  return pathname === '/admin' || pathname.startsWith('/admin/')
}

/** Hostname only: strip a trailing dot, [IPv6] brackets, and :port on names that are not IPv6. */
function hostnameOnly(host: string): string {
  let h = host.trim().toLowerCase().replace(/\.$/, '')
  const bracket = /^\[([^\]]+)\](?::\d+)?$/.exec(h)
  if (bracket) return bracket[1]
  if (/^[a-z0-9.-]+:\d+$/.test(h)) return h.replace(/:\d+$/, '')
  return h
}

/**
 * Loopback and local-dev hosts. 7 localhost views reached the production GA4
 * property; these names must never count, even when a production build is
 * served on them (`next start` sets NODE_ENV=production).
 */
export function isLocalhostHost(host: string | null | undefined): boolean {
  if (typeof host !== 'string') return false
  const h = hostnameOnly(host)
  if (h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '0.0.0.0') return true
  if (h.endsWith('.localhost')) return true
  return false
}

export function isProductionHost(host: string | null | undefined): boolean {
  if (typeof host !== 'string') return false
  if (isLocalhostHost(host)) return false
  const h = hostnameOnly(host)
  return h === PRODUCTION_HOST || h.endsWith(`.${PRODUCTION_HOST}`)
}

function flagCookieRe(name: string): RegExp {
  return new RegExp(`(?:^|;\\s*)${name}=1(?:;|$)`)
}
function flagQueryRe(name: string): RegExp {
  return new RegExp(`[?&]${name}=1(?:&|$)`)
}
const MARKER_COOKIE_RE = flagCookieRe(AUTOMATION_MARKER_COOKIE)
const MARKER_QUERY_RE = flagQueryRe(AUTOMATION_MARKER_QUERY)
const INTERNAL_COOKIE_RE = flagCookieRe(INTERNAL_USER_COOKIE)

/** Our explicit automation marker, on the cookie or on the page's query. */
export function hasAutomationMarker(args: { cookieHeader?: string | null; search?: string | null }): boolean {
  return MARKER_COOKIE_RE.test(args.cookieHeader ?? '') || MARKER_QUERY_RE.test(args.search ?? '')
}

export function hasInternalUserCookie(cookieHeader: string | null | undefined): boolean {
  return INTERNAL_COOKIE_RE.test(cookieHeader ?? '')
}

export function decideGaSuppression(input: GaSuppressionInput): GaSuppression {
  if (isAdminPath(input.pathname)) return { suppress: true, reason: 'admin-path' }
  if (!isProductionHost(input.host)) return { suppress: true, reason: 'non-production-host' }
  const marker = hasAutomationMarker({ cookieHeader: input.cookieHeader, search: input.search })
  if (classifyAutomation({ userAgent: input.userAgent, webdriver: input.webdriver, marker }).automated) {
    return { suppress: true, reason: 'automation' }
  }
  if (hasInternalUserCookie(input.cookieHeader)) return { suppress: true, reason: 'internal-user' }
  return { suppress: false, reason: null }
}

/** The decision for a page address (the server mirror's view of the page). */
export function decideGaSuppressionForPage(args: {
  pageUrl: string
  userAgent: string | null | undefined
  webdriver?: unknown
  cookieHeader?: string | null
}): GaSuppression {
  let u: URL
  try {
    u = new URL(args.pageUrl)
  } catch {
    return { suppress: true, reason: 'non-production-host' }
  }
  return decideGaSuppression({
    pathname: u.pathname,
    host: u.hostname,
    search: u.search,
    userAgent: args.userAgent,
    webdriver: args.webdriver,
    cookieHeader: args.cookieHeader,
  })
}

/**
 * The same rule as ONE JavaScript expression for an inline script that runs
 * before React: true when no Google tag may load on this page. Reads
 * `location`, `navigator` and `document.cookie`. It fails OPEN (false) on an
 * exception, matching IS_NON_PRODUCTION_BUILD: losing every real visitor to a
 * thrown error is worse than one stray session.
 */
export const GA_SUPPRESS_JS =
  `(function(){try{` +
  `var l=location,n=navigator,c=document.cookie||'',p=l.pathname||'/',h=String(l.hostname||'').toLowerCase().replace(/\\.$/,'').replace(/^\\[|\\]$/g,''),u=String(n.userAgent||'').trim();` +
  `if(p==='/admin'||p.indexOf('/admin/')===0)return true;` +
  `if(h==='localhost'||h==='127.0.0.1'||h==='::1'||h==='0.0.0.0'||h.slice(-10)==='.localhost')return true;` +
  `if(!(h===${JSON.stringify(PRODUCTION_HOST)}||h.slice(-${PRODUCTION_HOST.length + 1})===${JSON.stringify('.' + PRODUCTION_HOST)}))return true;` +
  `if(${MARKER_COOKIE_RE.toString()}.test(c)||${MARKER_QUERY_RE.toString()}.test(l.search||''))return true;` +
  `if(!u||${TOOL_RE.toString()}.test(u)||${HEADLESS_RE.toString()}.test(u)||${DECLARED_CRAWLER_RE.toString()}.test(u.replace(/cubot/gi,'')))return true;` +
  `if(n.webdriver===true)return true;` +
  `if(${INTERNAL_COOKIE_RE.toString()}.test(c))return true;` +
  `return false}catch(e){return false}})()`
