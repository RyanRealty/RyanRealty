/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/homes-for-sale/bend"}
 *
 * The search-funnel events (fireSearchEvent) follow the same tiers as every other
 * tracker (docs/TRACKING_POLICY.md): a visitor who declined, or whose browser sends
 * Global Privacy Control, is recorded nowhere, and no session id is written for them.
 * Until 2026-09-30 this path had no check at all: it minted rr_session_id and wrote
 * the search to user_events whatever the visitor had answered (review of 2026-09-30).
 * The server action refuses the same requests (app/actions/track-user-event.test.ts).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ track: vi.fn(async () => undefined) }))
vi.mock('@/app/actions/track-user-event', () => ({ trackUserEvent: state.track }))
vi.mock('next/navigation', () => ({ usePathname: () => '/homes-for-sale/bend', useSearchParams: () => new URLSearchParams() }))
vi.mock('next/link', () => ({ default: () => null }))

import { fireSearchEvent } from './search-events.client'
import { resetSessionMemory } from '@/lib/analytics/visitor-session'
import { encodeConsent } from '@/test/consent-fixtures'

function setConsent(raw: string | undefined) {
  document.cookie =
    raw === undefined
      ? 'ryan_realty_cookie_consent=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'
      : `ryan_realty_cookie_consent=${raw}; path=/`
}

function setGpc(on: boolean) {
  Object.defineProperty(navigator, 'globalPrivacyControl', { configurable: true, value: on ? true : undefined })
}

let n = 0
/** A distinct filter each time, so the one-row-per-action guard never collapses two tests' fires. */
const fire = () => fireSearchEvent('search_filter_apply', { filter: 'price', value: String(++n) })

beforeEach(() => {
  state.track.mockClear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSessionMemory()
  setConsent(undefined)
  setGpc(false)
})

afterEach(() => {
  setConsent(undefined)
  setGpc(false)
})

describe('fireSearchEvent is gated like every tracker', () => {
  it('a visitor who declined: nothing sent, no session id written', () => {
    setConsent(encodeConsent({ analytics: false, marketing: false }))
    fire()
    expect(state.track).not.toHaveBeenCalled()
    expect(window.localStorage.getItem('rr_session_id')).toBeNull()
  })

  it('Global Privacy Control: nothing sent, no session id written', () => {
    setGpc(true)
    fire()
    expect(state.track).not.toHaveBeenCalled()
    expect(Object.keys(window.localStorage)).toEqual([])
  })

  it('a visitor with no answer yet, or one who accepted, is recorded as before', () => {
    fire()
    setConsent(encodeConsent({ analytics: true, marketing: true }))
    fire()
    expect(state.track).toHaveBeenCalledTimes(2)
    const [call] = state.track.mock.calls[0] as unknown as [{ eventType: string; sessionId: string; pagePath: string }]
    expect(call).toMatchObject({ eventType: 'search_filter_apply', pagePath: '/homes-for-sale/bend' })
    expect(call.sessionId).toMatch(/^[0-9a-f]{8}-/)
  })
})
