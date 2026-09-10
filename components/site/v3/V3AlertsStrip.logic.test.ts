import { describe, expect, it } from 'vitest'
import {
  anchorPassed,
  isPlausibleEmail,
  selectAlertType,
  stickyAskClosed,
  stickyDismissKey,
  stickyEligible,
  stickyVisible,
  V3_ALERTS_STICKY_INITIAL,
  type V3AlertsStickyState,
} from './V3AlertsStrip.logic'

const past: V3AlertsStickyState = { passed: true, calloutVisible: false, footerVisible: false, dismissed: false }

describe('stickyVisible', () => {
  it('hides until the anchor has been scrolled past', () => {
    expect(stickyVisible(V3_ALERTS_STICKY_INITIAL, 'idle')).toBe(false)
    expect(stickyVisible(past, 'idle')).toBe(true)
  })

  it('never repeats the ask while the callout is on screen', () => {
    expect(stickyVisible({ ...past, calloutVisible: true }, 'idle')).toBe(false)
  })

  it('never covers the footer', () => {
    expect(stickyVisible({ ...past, footerVisible: true }, 'idle')).toBe(false)
  })

  it('stays closed for the session once dismissed', () => {
    expect(stickyVisible({ ...past, dismissed: true }, 'idle')).toBe(false)
  })

  it('is gone for good after a successful subscribe, and still shows while a send is in flight or failed', () => {
    expect(stickyVisible(past, 'sent')).toBe(false)
    expect(stickyVisible(past, 'sending')).toBe(true)
    expect(stickyVisible(past, 'failed')).toBe(true)
  })

  it('scrolling back up above the anchor hides it again', () => {
    expect(stickyVisible({ ...past, passed: false }, 'idle')).toBe(false)
  })
})

/**
 * The page reserves the strip's height while the strip can COME BACK, not only
 * while it is on screen — a reservation that tracked visibility would add and
 * remove the strip's own height every time the footer arrived.
 */
describe('stickyEligible', () => {
  it('ignores the two conditions that flip on every scroll', () => {
    expect(stickyEligible({ ...past, calloutVisible: true }, 'idle')).toBe(true)
    expect(stickyEligible({ ...past, footerVisible: true }, 'idle')).toBe(true)
  })

  it('ends with the three that hold for the rest of the visit', () => {
    expect(stickyEligible(V3_ALERTS_STICKY_INITIAL, 'idle')).toBe(false)
    expect(stickyEligible({ ...past, dismissed: true }, 'idle')).toBe(false)
    expect(stickyEligible(past, 'sent')).toBe(false)
  })

  it('is implied by visibility, always', () => {
    const states: V3AlertsStickyState[] = [
      V3_ALERTS_STICKY_INITIAL,
      past,
      { ...past, calloutVisible: true },
      { ...past, footerVisible: true },
      { ...past, dismissed: true },
    ]
    for (const state of states) {
      for (const status of ['idle', 'sending', 'sent', 'failed'] as const) {
        if (stickyVisible(state, status)) expect(stickyEligible(state, status)).toBe(true)
      }
    }
  })
})

describe('selectAlertType', () => {
  const types = [
    { key: 'houses', count: '148' },
    { key: 'condo', count: '12' },
    { key: 'land', count: '4' },
  ]

  it('returns the matching type and falls back to the first', () => {
    expect(selectAlertType(types, 'condo')?.count).toBe('12')
    expect(selectAlertType(types, 'nope')?.key).toBe('houses')
    expect(selectAlertType(types, null)?.key).toBe('houses')
    expect(selectAlertType([], 'houses')).toBeNull()
    expect(selectAlertType(undefined, 'houses')).toBeNull()
  })
})

/** The strip's control opens the ask when the field renders no box at all. */
describe('stickyAskClosed', () => {
  it('reads the field the visitor is actually looking at', () => {
    expect(stickyAskClosed({ getClientRects: () => ({ length: 0 }) })).toBe(true)
    expect(stickyAskClosed({ getClientRects: () => ({ length: 1 }) })).toBe(false)
  })

  it('treats a missing field as closed: there is nothing to submit', () => {
    expect(stickyAskClosed(null)).toBe(true)
    expect(stickyAskClosed(undefined)).toBe(true)
  })
})

describe('anchorPassed', () => {
  it('is true only when the anchor is above the viewport', () => {
    expect(anchorPassed({ isIntersecting: false, boundingClientRect: { bottom: -12 } })).toBe(true)
    expect(anchorPassed({ isIntersecting: false, boundingClientRect: { bottom: 0 } })).toBe(true)
  })

  it('is false while the anchor is on screen or still below', () => {
    expect(anchorPassed({ isIntersecting: true, boundingClientRect: { bottom: 400 } })).toBe(false)
    expect(anchorPassed({ isIntersecting: false, boundingClientRect: { bottom: 2400 } })).toBe(false)
  })
})

describe('isPlausibleEmail', () => {
  it('matches the capture action shape', () => {
    expect(isPlausibleEmail('fleet-test+site04@ryan-realty.com')).toBe(true)
    expect(isPlausibleEmail('  a@b.co  ')).toBe(true)
    expect(isPlausibleEmail('')).toBe(false)
    expect(isPlausibleEmail('nobody')).toBe(false)
    expect(isPlausibleEmail('a b@c.com')).toBe(false)
    expect(isPlausibleEmail(`${'x'.repeat(250)}@a.com`)).toBe(false)
  })
})

describe('stickyDismissKey', () => {
  it('scopes the close to the strip id', () => {
    expect(stickyDismissKey('alerts')).toBe('v3-alerts-strip:alerts:dismissed')
  })
})
