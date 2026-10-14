/**
 * Retired bot-only URL prefixes. Answer 410 at the edge, same mechanism as
 * /_next/image (lib/routing/legacy-next-image.ts): a tiny body, no render.
 *
 * /find-central-oregon-homes-for-sale-with-our-home-search and /property-search
 * (and everything under them) are AgentFire leftovers. GA4 90-day traffic is
 * scrapers (aocr.org), not people. 410 tells crawlers the resource is gone
 * and must not be asked for again.
 */

export const GONE_PREFIXES: readonly string[] = [
  '/find-central-oregon-homes-for-sale-with-our-home-search',
  '/property-search',
]

/** The body of the 410. Deliberately tiny: nothing about it should cost a render. */
export const GONE_BODY = 'Gone'

/** Cache lifetime for the 410, in seconds (one day). Same as the image 410. */
export const GONE_CACHE_SECONDS = 86_400

function normalize(pathname: string): string {
  let p = pathname
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1)
  return p.toLowerCase()
}

/** True when this path is a retired prefix, exact or with a trailing segment. */
export function isGonePath(pathname: string): boolean {
  const p = normalize(pathname)
  for (const prefix of GONE_PREFIXES) {
    if (p === prefix || p.startsWith(`${prefix}/`)) return true
  }
  return false
}
