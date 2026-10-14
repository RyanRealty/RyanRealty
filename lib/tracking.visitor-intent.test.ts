/**
 * @vitest-environment jsdom
 *
 * trackEvent and visitor intent (Matt 2026-10-14, GTM version 10). A buyer or
 * seller event updates the browser's visitor-intent memory; when the label
 * changes, the new `visitor_intent` is pushed flat just before the event, so
 * the event's own GA4 hit carries the new user property.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const consent = vi.hoisted(() => ({ analytics: true as boolean | 'throw' }))
vi.mock('@/components/CookieConsentBanner', () => ({
  hasAnalyticsConsent: () => {
    if (consent.analytics === 'throw') throw new Error('consent read failed')
    return consent.analytics
  },
}))

import { trackEvent } from './tracking'

const STORAGE_KEY = 'rr_visitor_intent_v1'
const rows = () => (window.dataLayer ?? []) as Array<Record<string, unknown>>

beforeEach(() => {
  window.dataLayer = []
  window.localStorage.clear()
  consent.analytics = true
})

afterEach(() => {
  window.dataLayer = []
  window.localStorage.clear()
})

describe('trackEvent visitor intent', () => {
  it('a seller event pushes the new label flat, before the event it belongs to', () => {
    trackEvent('address_submit', { form: 'get-value', surface: 'sell' })
    expect(rows()).toEqual([
      { visitor_intent: 'seller' },
      { ga4_params: null },
      expect.objectContaining({ event: 'address_submit', form: 'get-value' }),
    ])
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject({ intent: 'seller' })
  })

  it('pushes the label only when it changes', () => {
    trackEvent('address_submit', { surface: 'sell' })
    trackEvent('place_value_answer', { surface: 'community' })
    expect(rows().filter((r) => 'visitor_intent' in r)).toEqual([{ visitor_intent: 'seller' }])
    trackEvent('schedule_tour_click', { surface: 'listing_fold' })
    expect(rows().filter((r) => 'visitor_intent' in r)).toEqual([{ visitor_intent: 'seller' }, { visitor_intent: 'both' }])
  })

  it('an event that is neither buyer nor seller touches no storage and pushes no label', () => {
    trackEvent('click_cta', { cta: 'Call' })
    trackEvent('call_initiated', {})
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(rows().some((r) => 'visitor_intent' in r)).toBe(false)
  })

  it('without analytics consent records nothing and pushes no label, but the event still goes', () => {
    consent.analytics = false
    trackEvent('ask_question_click', { surface: 'listing_fold' })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(rows().some((r) => 'visitor_intent' in r)).toBe(false)
    expect(rows()).toContainEqual(expect.objectContaining({ event: 'ask_question_click' }))
  })

  it('never throws, and still pushes the event, when the consent read fails', () => {
    consent.analytics = 'throw'
    expect(() => trackEvent('tour_requested', {})).not.toThrow()
    expect(rows()).toContainEqual(expect.objectContaining({ event: 'tour_requested' }))
  })
})
