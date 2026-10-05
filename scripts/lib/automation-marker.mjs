/**
 * automation-marker.mjs — the marker every browser this repo launches carries.
 *
 * WHY (Matt 2026-10-05, GA cleanup). Our own captures were being counted as
 * visitors. scripts/take-route-shots.mjs spoofed a Mac Chrome/124 user agent and
 * granted analytics consent, so gtag counted it in GA4 (~128 sessions in four
 * weeks) and first-party tracking recorded 1,232 unflagged sessions; ad-hoc
 * probes added more. navigator.webdriver catches a default Playwright or
 * Puppeteer launch, but a script can hide it, and a spoofed user agent hides the
 * rest. So every launcher sets an explicit marker the site reads:
 *
 *   cookie  rr_automation=1   on every ryan-realty.com host, localhost, 127.0.0.1
 *
 * The site (lib/analytics/ga-suppression.ts) loads no Google tag for it and the
 * first-party tracker flags its session `automation_reason = 'marker'`, never
 * identified to a contact. It is a flag, not a credential: it unlocks nothing.
 *
 * Launch through the wrappers, never the packages directly:
 *   import { chromium, devices } from './lib/marked-playwright.mjs'
 *   import puppeteer from './lib/marked-puppeteer.mjs'
 * Playwright test runs get it from playwright.config.ts (automationStorageState).
 * Held by scripts/check-analytics-suppression.mjs (`ci:analytics-suppression`).
 *
 * The name is pinned to lib/analytics/ga-suppression.ts AUTOMATION_MARKER_COOKIE
 * by that gate.
 */

export const AUTOMATION_MARKER_COOKIE = 'rr_automation'
export const AUTOMATION_MARKER_VALUE = '1'

/** The hosts the marker is planted on: production (and every subdomain), and local servers. */
const MARKER_DOMAINS = ['.ryan-realty.com', 'localhost', '127.0.0.1']

/** Cookie objects in the shape both Playwright `addCookies` and Puppeteer `setCookie` accept. */
export function markerCookies(extraHosts = []) {
  const domains = [...MARKER_DOMAINS]
  for (const h of extraHosts) {
    const host = String(h || '').trim().toLowerCase()
    if (host && !domains.includes(host) && !domains.some((d) => d.startsWith('.') && host.endsWith(d))) domains.push(host)
  }
  return domains.map((domain) => ({
    name: AUTOMATION_MARKER_COOKIE,
    value: AUTOMATION_MARKER_VALUE,
    domain,
    path: '/',
    sameSite: 'Lax',
    secure: false,
    httpOnly: false,
    expires: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
  }))
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
