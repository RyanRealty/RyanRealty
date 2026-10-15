/**
 * reachability: entry-point — listing-detail teaser. After ~30s, a small
 * bubble (desktop) or launcher badge (mobile). Never auto-opens the panel.
 * Dismissed for the rest of the session. Honors prefers-reduced-motion in CSS.
 */
import { isListingPath } from '@/lib/site/arrival-intent'
import { LISTING_TEASER_EN } from './scripts'

export const SARAH_TEASER_DELAY_MS = 30_000
export const SARAH_TEASER_SESSION_KEY = 'rr_sarah_teaser_dismissed'
export const SARAH_TEASER_COPY = LISTING_TEASER_EN
/** Matches the site phone-dock hide: bubble on a wide window, badge on a phone. */
export const SARAH_TEASER_WIDE_MQ = '(min-width: 64rem)'

export type SarahTeaserKind = 'bubble' | 'badge'

export function listingTeaserKind(isWideViewport: boolean): SarahTeaserKind {
  return isWideViewport ? 'bubble' : 'badge'
}

export function isSarahListingTeaserPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  return isListingPath(pathname)
}

export function teaserDismissedInSession(storage: Pick<Storage, 'getItem'> | null): boolean {
  if (!storage) return false
  try {
    return storage.getItem(SARAH_TEASER_SESSION_KEY) === '1'
  } catch {
    return false
  }
}

export function persistTeaserDismissed(storage: Pick<Storage, 'setItem'> | null): void {
  if (!storage) return
  try {
    storage.setItem(SARAH_TEASER_SESSION_KEY, '1')
  } catch {
    /* private mode */
  }
}

export function shouldOfferListingTeaser(input: {
  pathname: string | null | undefined
  dismissed: boolean
  panelOpen: boolean
}): boolean {
  if (input.panelOpen) return false
  if (input.dismissed) return false
  return isSarahListingTeaserPath(input.pathname)
}
