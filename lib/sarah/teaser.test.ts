import { describe, expect, it } from 'vitest'
import { LISTING_TEASER_EN } from './scripts'
import {
  SARAH_TEASER_COPY,
  SARAH_TEASER_DELAY_MS,
  SARAH_TEASER_SESSION_KEY,
  isSarahListingTeaserPath,
  persistTeaserDismissed,
  shouldOfferListingTeaser,
  teaserDismissedInSession,
} from './teaser'

describe('listing teaser', () => {
  it('is listing-detail only', () => {
    expect(isSarahListingTeaserPath('/homes-for-sale/bend/20556-empire-220226741')).toBe(true)
    expect(isSarahListingTeaserPath('/homes-for-sale/listing/220226741')).toBe(true)
    expect(isSarahListingTeaserPath('/homes-for-sale/bend')).toBe(false)
    expect(isSarahListingTeaserPath('/cities/bend')).toBe(false)
    expect(isSarahListingTeaserPath('/')).toBe(false)
  })

  it('waits 30s, uses the approved copy, and stays dismissed for the session', () => {
    expect(SARAH_TEASER_DELAY_MS).toBe(30_000)
    expect(SARAH_TEASER_COPY).toBe('Questions about this home? I can help.')
    expect(SARAH_TEASER_COPY).toBe(LISTING_TEASER_EN)
    expect(SARAH_TEASER_SESSION_KEY).toBe('rr_sarah_teaser_dismissed')
    const store: Record<string, string> = {}
    const storage = {
      getItem: (k: string) => store[k] ?? null,
      setItem: (k: string, v: string) => {
        store[k] = v
      },
    }
    expect(teaserDismissedInSession(storage)).toBe(false)
    persistTeaserDismissed(storage)
    expect(teaserDismissedInSession(storage)).toBe(true)
  })

  it('does not offer when the panel is open or the teaser was dismissed', () => {
    const path = '/homes-for-sale/bend/20556-empire-220226741'
    expect(shouldOfferListingTeaser({ pathname: path, dismissed: false, panelOpen: false })).toBe(true)
    expect(shouldOfferListingTeaser({ pathname: path, dismissed: true, panelOpen: false })).toBe(false)
    expect(shouldOfferListingTeaser({ pathname: path, dismissed: false, panelOpen: true })).toBe(false)
  })
})
