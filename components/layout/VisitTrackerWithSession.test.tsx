/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * VisitTrackerWithSession bridges a signed-in visitor's session to their contact
 * (identifyAuthenticatedSession). The session it names is the one the page's tracker
 * is recording, read the way every tracker reads it (readRrSessionId: the id and its
 * lifecycle record as one pair). It used to read rr_session_id straight out of
 * localStorage, so a storage that refused writes (a full quota, some private windows)
 * handed the action the id storage still held, a session that had already ended on
 * this page (review of 2026-09-30).
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ identify: vi.fn(async () => ({ ok: true, bridged: true })) }))
vi.mock('../VisitTracker', () => ({ default: () => null }))
vi.mock('@/app/actions/identity-bridge', () => ({ identifyAuthenticatedSession: state.identify }))

import VisitTrackerWithSession from './VisitTrackerWithSession'
import { advanceSession, resetSessionMemory } from '@/lib/analytics/visitor-session'
import { storeSessionRecord } from '@/test/doc-tracker-harness'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const MIN = 60 * 1000
const T0 = Date.UTC(2026, 8, 30, 18, 0, 0)
const OLD = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
let root: Root | null = null
let node: HTMLDivElement | null = null

async function mount() {
  node = document.createElement('div')
  document.body.appendChild(node)
  root = createRoot(node)
  await act(async () => {
    root!.render(React.createElement(VisitTrackerWithSession))
  })
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve()
  })
}

beforeEach(() => {
  state.identify.mockClear()
  window.localStorage.clear()
  window.sessionStorage.clear()
  resetSessionMemory()
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, json: async () => ({ user: { id: 'user-1', email: 'reader@example.com' } }) }) as unknown as Response),
  )
})

afterEach(() => {
  if (root) {
    const r = root
    root = null
    act(() => r.unmount())
  }
  node?.remove()
  node = null
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('VisitTrackerWithSession', () => {
  it('names the session this page is recording, not an ended one storage still holds', async () => {
    // Storage holds a session from three months ago and refuses every write since.
    storeSessionRecord({ id: 1, n: 4, last: T0 - 90 * 24 * 60 * MIN, sid: OLD, s: '', c: '' }, OLD)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    // The page's tracker has recorded its first event: that ended the old session.
    const current = advanceSession({ now: T0, search: '' })!
    expect(current.sessionId).not.toBe(OLD)
    expect(window.localStorage.getItem('rr_session_id')).toBe(OLD)

    await mount()
    expect(state.identify).toHaveBeenCalledTimes(1)
    expect(state.identify).toHaveBeenCalledWith(current.sessionId, { webdriver: false })
  })

  it('with no session yet it names none', async () => {
    await mount()
    expect(state.identify).toHaveBeenCalledWith(undefined, { webdriver: false })
  })
})
