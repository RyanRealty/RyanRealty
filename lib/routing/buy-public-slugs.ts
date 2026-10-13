/**
 * Known /buy/<slug> pages. Unknown slugs used to soft-404 (HTTP 200 + noindex)
 * because app/buy/loading.tsx streams notFound() as a 200. Middleware answers
 * a real 404 from this list. Bare /buy is not in the list so next.config can
 * 301 it to /homes-for-sale.
 *
 * /buy/alerts is a sibling worktree. Do not add it here until that page ships.
 */
export const BUY_INTENT_SLUGS = ['first-time-home-buyer', 'relocation', 'investment'] as const

export const BUY_STATIC_SLUGS = ['leverage'] as const

export const BUY_PUBLIC_SLUGS = [...BUY_INTENT_SLUGS, ...BUY_STATIC_SLUGS] as const

export type BuyPublicSlug = (typeof BUY_PUBLIC_SLUGS)[number]

export function buyPublicSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/buy\/([^/]+)\/?$/)
  if (!match?.[1]) return null
  try {
    return decodeURIComponent(match[1]).toLowerCase()
  } catch {
    return match[1].toLowerCase()
  }
}

export function isKnownBuyPublicSlug(slug: string): boolean {
  return (BUY_PUBLIC_SLUGS as readonly string[]).includes(slug)
}

/** True when this is a one-segment /buy/<slug> that has no page. */
export function isUnknownBuyPublicPath(pathname: string): boolean {
  const slug = buyPublicSlugFromPath(pathname)
  return slug != null && !isKnownBuyPublicSlug(slug)
}
