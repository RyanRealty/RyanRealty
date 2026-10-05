/**
 * Hosts whose traffic must never reach the production GA4 property.
 *
 * Measured 2026-08-26: 43 sessions in the production property arrived with a
 * `127.0.0.1:8777` referral source — our own local development, indistinguishable
 * in the reports from a real referral. Analytics that includes the people
 * building the site is not analytics.
 *
 * Matched against the page_location we are about to report, not the process env,
 * because a local run against production credentials is exactly the case that
 * leaked. `NEXT_PUBLIC_SITE_URL` is deliberately not consulted — a dev machine
 * often has the production value set.
 */
// URL.hostname keeps the brackets on an IPv6 literal: http://[::1]:3000 reads "[::1]".
const NON_PRODUCTION_HOSTS = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1', '[::1]'])

export function isNonProductionPageLocation(pageLocation: unknown): boolean {
  if (typeof pageLocation !== 'string' || !pageLocation) return false
  let host: string
  try {
    host = new URL(pageLocation).hostname.toLowerCase()
  } catch {
    return false
  }
  if (NON_PRODUCTION_HOSTS.has(host)) return true
  // Vercel preview + branch deploys, and any *.local / *.test dev domain.
  if (host.endsWith('.local') || host.endsWith('.test') || host.endsWith('.localhost')) return true
  if (host.endsWith('.vercel.app')) return true
  return false
}
