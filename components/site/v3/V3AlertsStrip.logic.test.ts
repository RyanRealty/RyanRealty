import { describe, expect, it } from 'vitest'
import {
  anchorPassed,
  isPlausibleEmail,
  stickyDismissKey,
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
