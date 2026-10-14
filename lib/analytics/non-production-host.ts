/**
 * Hosts whose traffic must never reach the production GA4 property.
 *
 * Measured 2026-08-26: 43 sessions in the production property arrived with a
 * `127.0.0.1:8777` referral source — our own local development, indistinguishable
 * in the reports from a real referral. Analytics that includes the people
 * building the site is not analytics.
 *
 * Allowlist, not denylist: any host that is not ryan-realty.com (or a subdomain)
 * is non-production. That covers localhost, 127.0.0.1 with any port, 0.0.0.0,
 * [::1], LAN IPs (192.168.x, 10.x), *.vercel.app previews, and a lookalike
 * host. Matched against the page_location we are about to report AND, on the
 * track route, the request Host header — a client that spoofs pageUrl as
 * production while posting to a local `next start` still drops.
 *
 * `NEXT_PUBLIC_SITE_URL` is deliberately not consulted — a dev machine often
 * has the production value set.
 */
import { isProductionHost } from './ga-suppression'

export function isNonProductionPageLocation(pageLocation: unknown): boolean {
  if (typeof pageLocation !== 'string' || !pageLocation) return false
  let host: string
  try {
    host = new URL(pageLocation).hostname
  } catch {
    return false
  }
  return !isProductionHost(host)
}

/** True when the incoming request Host is not ryan-realty.com (port stripped). */
export function isNonProductionRequestHost(hostHeader: string | null | undefined): boolean {
  if (typeof hostHeader !== 'string' || !hostHeader.trim()) return false
  return !isProductionHost(hostHeader)
}
