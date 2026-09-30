/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * PersonIdentityBridge is the second identify path for a link we sent (the track
 * route is the first). The click that brought the visitor here can END the session
 * in storage (a new campaign, 30 minutes idle, an id from before the rule), and
 * VisitTracker, which is loaded lazily, starts the new one with its first post. So
 * the bridge waits for that post and identifies the session it landed in; asked at
 * mount, it identified the visit before this one and skipped the retry meant for the
 * click's own session (review of 2026-09-30). The browser's own navigator.webdriver
 * goes with the call, and the action refuses a scripted browser before anything is
 * cookied or stitched (the refusal itself is pinned in app/actions/identity-bridge.test.ts).
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({
  search: new URLSearchParams(),
  identify: vi.fn(async () => ({ ok: true })),
}))
vi.mock('next/navigation', () => ({ useSearchParams: () => state.search }))
vi.mock('@/app/actions/identity-bridge', () => ({ identifyPersonFromEmailClickNative: state.identify }))

import PersonIdentityBridge, { IDENTIFY_WAIT_MS } from './PersonIdentityBridge'
import { notePostedSession, resetSessionMemory } from '@/lib/analytics/visitor-session'
import { storeSessionRecord } from '@/test/doc-tracker-harness'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const TOKEN = '64115.email.abcdefghijklmnopqrstuv'
const EARLIER = '3f1c2d4e-5a6b-4c7d-8e9f-0a1b2c3d4e5f'
const POSTED = '11111111-2222-4333-8444-555555555555'
let root: Root | null = null
let node: HTMLDivElement | null = null

function setSignal(name: 'webdriver' | 'globalPrivacyControl', value: boolean | undefined) {
  Object.defineProperty(navigator, name, { configurable: true, value })
}

async function mountAt(url: string) {
  window.history.replaceState({}, '', url)
  state.search = new URLSearchParams(new URL(url, 'https://ryan-realty.com').search)
  node = document.createElement('div')
  document.body.appendChild(node)
  root = createRoot(node)
  await act(async () => {
    root!.render(React.createElement(PersonIdentityBridge))
  })
}

/** VisitTracker's first post of the page settles, recorded under `sessionId`. */
async function trackerPosted(sessionId: string) {
  await act(async () => {
    notePostedSession(sessionId)
    for (let i = 0; i < 4; i++) await Promise.resolve()
  })
}

beforeEach(() => {
  state.identify.mockClear()
  resetSessionMemory()
  window.sessionStorage.clear()
  window.localStorage.clear()
  setSignal('webdriver', false)
  setSignal('globalPrivacyControl', undefined)
})

afterEach(() => {
  if (root) {
    const r = root
    root = null
    act(() => r.unmount())
  }
  node?.remove()
  node = null
  setSignal('webdriver', false)
  setSignal('globalPrivacyControl', undefined)
})

describe('PersonIdentityBridge', () => {
  it('identifies the session the tracker\'s first post landed in, not the one in storage at mount (review of 2026-09-30)', async () => {
    // A session this rule started a minute ago, under another campaign: the email click
    // is an arrival on a new one, so VisitTracker's first post starts a new session.
    storeSessionRecord({ id: 1, n: 3, last: Date.now() - 60_000, sid: EARLIER, s: 'facebook', c: 'spring' }, EARLIER)
    await mountAt(`/homes-for-sale?utm_source=crm&utm_medium=email&_pid=${TOKEN}`)
    expect(state.identify).not.toHaveBeenCalled()
    // the token is left where the tracker's first post reads it
    expect(window.location.search).toContain('_pid=')
    expect(window.sessionStorage.getItem('rr_pid_token')).toBe(TOKEN)
    await trackerPosted(POSTED)
    expect(state.identify).toHaveBeenCalledTimes(1)
    expect(state.identify).toHaveBeenCalledWith(TOKEN, POSTED, { webdriver: false })
    expect(window.location.search).toBe('?utm_source=crm&utm_medium=email')
  })

  it('a post that settled before the bridge asked is used at once', async () => {
    notePostedSession(POSTED)
    await mountAt(`/homes-for-sale?_pid=${TOKEN}`)
    await act(async () => {
      for (let i = 0; i < 4; i++) await Promise.resolve()
    })
    expect(state.identify).toHaveBeenCalledWith(TOKEN, POSTED, { webdriver: false })
  })

  it('on a page the tracker records nothing on, it identifies with no session id once the wait is over', async () => {
    vi.useFakeTimers()
    try {
      storeSessionRecord({ id: 1, n: 3, last: Date.now() - 60_000, sid: EARLIER, s: '', c: '' }, EARLIER)
      await mountAt(`/homes-for-sale?_pid=${TOKEN}`)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(IDENTIFY_WAIT_MS - 1)
      })
      expect(state.identify).not.toHaveBeenCalled()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1)
      })
      expect(state.identify).toHaveBeenCalledWith(TOKEN, undefined, { webdriver: false })
      expect(window.location.search).toBe('')
    } finally {
      vi.useRealTimers()
    }
  })

  it('sends navigator.webdriver with the identify call, so the action can refuse a scripted browser', async () => {
    setSignal('webdriver', true)
    await mountAt(`/homes-for-sale?_pid=${TOKEN}`)
    await trackerPosted(POSTED)
    expect(state.identify).toHaveBeenCalledTimes(1)
    expect(state.identify).toHaveBeenCalledWith(TOKEN, POSTED, { webdriver: true })
  })

  it('Global Privacy Control still stops it before any call, and the address bar is still cleaned', async () => {
    setSignal('globalPrivacyControl', true)
    await mountAt(`/homes-for-sale?agent=matt&_pid=${TOKEN}`)
    await trackerPosted(POSTED)
    expect(state.identify).not.toHaveBeenCalled()
    expect(window.location.search).toBe('?agent=matt')
  })
})
