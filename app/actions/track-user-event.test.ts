/**
 * trackUserEvent writes a row to user_events (a signed-in visitor's viewing history,
 * the search-funnel events). It refuses what every tracker refuses
 * (docs/TRACKING_POLICY.md): a request from a visitor whose banner answer is a
 * decline, or whose browser sends Global Privacy Control, records nothing. Until
 * 2026-09-30 it had no check at all, so a declined or GPC visitor's searches were
 * recorded with their session id (review of 2026-09-30).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  cookies: {} as Record<string, string>,
  headers: {} as Record<string, string>,
  insert: vi.fn(async () => ({ error: null })),
}))

vi.mock('next/headers', () => ({
  cookies: async () => ({ get: (name: string) => (name in state.cookies ? { value: state.cookies[name] } : undefined) }),
  headers: async () => ({ get: (name: string) => state.headers[name.toLowerCase()] ?? null }),
}))
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({
    auth: { getUser: async () => ({ data: { user: { id: 'user-1' } } }) },
    from: () => ({ insert: state.insert }),
  }),
}))

import { trackUserEvent } from './track-user-event'

const enc = (v: { analytics: boolean; marketing: boolean }) => encodeURIComponent(JSON.stringify(v))
const EVENT = { eventType: 'search_filter_apply' as const, sessionId: '11111111-2222-4333-8444-555555555555', pagePath: '/homes-for-sale' }

beforeEach(() => {
  state.cookies = {}
  state.headers = {}
  state.insert.mockClear()
})

describe('trackUserEvent', () => {
  it('records the event for a visitor with no answer yet, or one who accepted', async () => {
    await trackUserEvent(EVENT)
    state.cookies.ryan_realty_cookie_consent = enc({ analytics: true, marketing: true })
    await trackUserEvent(EVENT)
    expect(state.insert).toHaveBeenCalledTimes(2)
    expect(state.insert.mock.calls[0]).toEqual([
      expect.objectContaining({ user_id: 'user-1', session_id: EVENT.sessionId, event_type: 'search_filter_apply', page_path: '/homes-for-sale' }),
    ])
  })

  it('records nothing for a visitor who declined', async () => {
    state.cookies.ryan_realty_cookie_consent = enc({ analytics: false, marketing: false })
    await trackUserEvent(EVENT)
    expect(state.insert).not.toHaveBeenCalled()
  })

  it('records nothing for a browser sending Global Privacy Control, whatever the banner says', async () => {
    state.headers['sec-gpc'] = '1'
    state.cookies.ryan_realty_cookie_consent = enc({ analytics: true, marketing: true })
    await trackUserEvent(EVENT)
    expect(state.insert).not.toHaveBeenCalled()
  })
})
