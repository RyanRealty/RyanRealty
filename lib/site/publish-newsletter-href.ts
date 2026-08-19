/**
 * Public newsletter subscribe door.
 *
 * `/newsletter` 404'd. The live subscribe action is
 * `subscribeNewsletterAction` (footer form + this page). `/search` 308s to
 * `/homes-for-sale`. Listing alerts (`/lp/buyer-listing-alerts`) are a
 * different product and must not become the newsletter destination.
 *
 * Founding fingerprints: 71e7816c6d1dd62201a57fa480d7fd39,
 * c650b38778f7a41487262a461a617d6f.
 *
 * Do not send a newsletter from this door. Do not invent a listing.
 */

export const NEWSLETTER_SUBSCRIBE_HREF = '/newsletter'

const LISTING_ALERTS_HREF = '/lp/buyer-listing-alerts'

function pathOnly(href: string | null | undefined): string {
  return (href ?? '').trim().split('?')[0]?.replace(/\/+$/, '') || ''
}

export function isNewsletterSubscribeHref(href: string | null | undefined): boolean {
  return pathOnly(href) === NEWSLETTER_SUBSCRIBE_HREF
}

export function publishNewsletterSubscribeHref(): string {
  return NEWSLETTER_SUBSCRIBE_HREF
}

/** Live newsletter door, or null when the candidate is listing alerts / empty. */
export function publishNewsletterSubscribeDestination(
  href: string | null | undefined,
): string | null {
  const path = pathOnly(href)
  if (!path) return null
  if (path === LISTING_ALERTS_HREF || path.startsWith(`${LISTING_ALERTS_HREF}/`)) return null
  if (isNewsletterSubscribeHref(path)) return NEWSLETTER_SUBSCRIBE_HREF
  return null
}
