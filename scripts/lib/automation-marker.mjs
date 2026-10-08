/**
 * automation-marker.mjs — the marker every browser this repo launches carries.
 *
 * WHY (Matt 2026-10-05, GA cleanup). Our own captures were being counted as
 * visitors. scripts/take-route-shots.mjs spoofed a Mac Chrome/124 user agent and
 * granted analytics consent, so gtag counted it in GA4 (~128 sessions in four
 * weeks) and first-party tracking recorded 1,232 unflagged sessions; ad-hoc
 * probes added more. navigator.webdriver catches a default Playwright or
 * Puppeteer launch, but a script can hide it, and a spoofed user agent hides the
 * rest. So every launcher sets explicit flags the site reads, BEFORE the first
 * page load:
 *
 *   cookie  rr_automation=1   on every ryan-realty.com host, localhost, 127.0.0.1
 *   cookie  rr_internal=1     same hosts (belt-and-suspenders with the marker)
 *   cookie  ryan_realty_cookie_consent = { analytics: false, marketing: false }
 *                             a DECLINE, never a grant — hides the banner without
 *                             telling gtag it may count the session
 *
 * The site (lib/analytics/ga-suppression.ts) loads no Google tag for either
 * flag and the first-party tracker flags the session, never identified to a
 * contact. They are flags, not credentials: they unlock nothing.
 *
 * Launch through the wrappers, never the packages directly:
 *   import { chromium, devices } from './lib/marked-playwright.mjs'
 *   import puppeteer from './lib/marked-puppeteer.mjs'
 * Playwright test runs get it from playwright.config.ts (automationStorageState).
 * Held by scripts/check-analytics-suppression.mjs (`ci:analytics-suppression`).
 *
 * The names are pinned to lib/analytics/ga-suppression.ts by that gate.
 */

export const AUTOMATION_MARKER_COOKIE = 'rr_automation'
export const AUTOMATION_MARKER_VALUE = '1'
export const INTERNAL_USER_COOKIE = 'rr_internal'
export const CONSENT_COOKIE = 'ryan_realty_cookie_consent'
export const DECLINED_CONSENT = { analytics: false, marketing: false }

/** The hosts the marker is planted on: production (and every subdomain), and local servers. */
const MARKER_DOMAINS = ['.ryan-realty.com', 'localhost', '127.0.0.1']

/**
 * True when this hostname is ours: ryan-realty.com (and subdomains), localhost
 * (and *.localhost), loopback, private LAN IPv4, or a *.vercel.app preview.
 * Third-party sites (SkySlope, Gmail, Aryeo, …) must not get the cookies.
 * No module captures: plantFlagsScript inlines this function via toString().
 */
export function isOwnSiteHost(host) {
  const h = String(host || '')
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '')
    .replace(/:\d+$/, '')
  if (!h) return false
  if (h === 'localhost' || h.endsWith('.localhost')) return true
  if (h === '127.0.0.1' || h === '0.0.0.0' || h === '::1') return true
  if (h === 'ryan-realty.com' || h.endsWith('.ryan-realty.com')) return true
  if (h.endsWith('.vercel.app')) return true
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h)
  if (!m) return false
  const a = Number(m[1])
  const b = Number(m[2])
  if (a === 10) return true
  if (a === 192 && b === 168) return true
  if (a === 172 && b >= 16 && b <= 31) return true
  return false
}

function declinedConsentValue() {
  return encodeURIComponent(JSON.stringify(DECLINED_CONSENT))
}

function cookieOnDomain(domain, name, value) {
  return {
    name,
    value,
    domain,
    path: '/',
    sameSite: 'Lax',
    secure: false,
    httpOnly: false,
    expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  }
}

function cookiesForDomain(domain) {
  return [
    cookieOnDomain(domain, AUTOMATION_MARKER_COOKIE, AUTOMATION_MARKER_VALUE),
    cookieOnDomain(domain, INTERNAL_USER_COOKIE, '1'),
    cookieOnDomain(domain, CONSENT_COOKIE, declinedConsentValue()),
  ]
}

/** Cookie objects in the shape both Playwright `addCookies` and Puppeteer `setCookie` accept. */
export function markerCookies(extraHosts = []) {
  const domains = [...MARKER_DOMAINS]
  for (const h of extraHosts) {
    const host = String(h || '')
      .trim()
      .toLowerCase()
      .replace(/:\d+$/, '')
    if (host && !domains.includes(host) && !domains.some((d) => d.startsWith('.') && host.endsWith(d))) {
      domains.push(host)
    }
  }
  return domains.flatMap((domain) => cookiesForDomain(domain))
}

/**
 * Inline script planted before any page JS (Playwright addInitScript /
 * Puppeteer evaluateOnNewDocument). Writes host-only cookies only when
 * location.hostname is ours (isOwnSiteHost, inlined so the rule cannot drift).
 */
export function plantFlagsScript() {
  const consent = declinedConsentValue()
  return (
    `(function(){try{` +
    `var isOwnSiteHost=${isOwnSiteHost.toString()};` +
    `if(!isOwnSiteHost(location.hostname))return;` +
    `document.cookie=${JSON.stringify(`${AUTOMATION_MARKER_COOKIE}=${AUTOMATION_MARKER_VALUE}; path=/`)};` +
    `document.cookie=${JSON.stringify(`${INTERNAL_USER_COOKIE}=1; path=/`)};` +
    `document.cookie=${JSON.stringify(`${CONSENT_COOKIE}=${consent}; path=/`)}` +
    `}catch(e){}})();`
  )
}

/** A Playwright `storageState` object carrying the marker (for a base URL's host too). */
export function automationStorageState(baseURL) {
  let host = ''
  try {
    host = baseURL ? new URL(baseURL).hostname : ''
  } catch {
    host = ''
  }
  return { cookies: markerCookies(host ? [host] : []), origins: [] }
}
