/**
 * site-origin.mjs — lib/site-origin.ts for plain-node .mjs scripts, which
 * cannot import TypeScript. Same rule (Matt 2026-10-07: never
 * ryanrealty.vercel.app in anything outward): a production host (the apex,
 * www, the Vercel alias) resolves to https://ryan-realty.com, any other host
 * (a preview, localhost) is kept, unset resolves to https://ryan-realty.com.
 *
 * scripts/lib/site-origin.test.mjs runs both implementations over the same
 * inputs and fails if they ever disagree, so this copy cannot drift.
 * TypeScript scripts (run with tsx) import ../lib/site-origin directly.
 */

export const CANONICAL_SITE_ORIGIN = 'https://ryan-realty.com'

const PRODUCTION_HOSTS = new Set([
  'ryan-realty.com',
  'www.ryan-realty.com',
  'ryanrealty.vercel.app', // staging-host-ok: the production alias being mapped AWAY from
])

export function isProductionSiteHost(hostname) {
  return PRODUCTION_HOSTS.has(String(hostname ?? '').trim().toLowerCase())
}

function parseOrigin(raw) {
  const value = String(raw ?? '').trim()
  if (!value) return null
  try {
    const u = new URL(value)
    if (u.protocol !== 'https:' && u.protocol !== 'http:') return null
    return isProductionSiteHost(u.hostname) ? CANONICAL_SITE_ORIGIN : u.origin
  } catch {
    return null
  }
}

/** The origin for every outward URL a script prints, posts or writes. */
export function siteOrigin(raw) {
  return parseOrigin(raw) ?? CANONICAL_SITE_ORIGIN
}

/** The same mapping, or null when unset, for a caller whose fallback is not production. */
export function configuredSiteOrigin(raw) {
  return parseOrigin(raw)
}
