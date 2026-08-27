import { describe, expect, it } from 'vitest'
import { isUntrackableLink } from './shortLinks'

describe('isUntrackableLink — only OUR tracker is skipped', () => {
  it('skips our own /r/ tracker so we never double-wrap', () => {
    expect(isUntrackableLink('https://ryan-realty.com/r/Ab3xY9z')).toBe(true)
    expect(isUntrackableLink('https://www.ryan-realty.com/r/Ab3xY9z')).toBe(true)
  })

  it('still tracks a THIRD-PARTY url that happens to contain /r/', () => {
    // The old test was a bare /r/, which matched any host. A partner link like
    // this was silently left untracked with no way to notice.
    expect(isUntrackableLink('https://zillow.com/r/abc123')).toBe(false)
    expect(isUntrackableLink('https://example.com/blog/r/recipes')).toBe(false)
  })

  it('still tracks a future route of ours under /r-something', () => {
    expect(isUntrackableLink('https://ryan-realty.com/reviews')).toBe(false)
    expect(isUntrackableLink('https://ryan-realty.com/rentals')).toBe(false)
  })

  it('never wraps a compliance or opt-out link', () => {
    for (const u of [
      'https://ryan-realty.com/unsubscribe?t=1',
      'https://ryan-realty.com/opt-out',
      'https://ryan-realty.com/email-preferences',
      'https://ryan-realty.com/agency-disclosure',
      'https://ryan-realty.com/api/track/e/open',
    ]) {
      expect(isUntrackableLink(u)).toBe(true)
    }
  })

  it('tracks an ordinary site link', () => {
    expect(isUntrackableLink('https://ryan-realty.com/housing-market/bend')).toBe(false)
    expect(isUntrackableLink('https://ryan-realty.com/lp/seller-home-value')).toBe(false)
  })
})
