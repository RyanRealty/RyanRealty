/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * AnalyticsIdentityBridge tags a known CRM contact in GA4 with the hashed user id
 * from /api/identity/me (decision crm-contacts-tagged-in-ga4), at the analytics
 * tier only: an essential-tier visit reaches GA4 under an anonymous client id
 * and nothing else, the rule the server's Measurement Protocol hits follow too
 * (lib/analytics/ga4-user-id.ts). A banner answer given mid-page tags or untags.
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => {
  process.env.NEXT_PUBLIC_GA4_MEASUREMENT_ID = 'G-TEST'
  return { analytics: true }
})
vi.mock('./CookieConsentBanner', () => ({ hasAnalyticsConsent: () => state.analytics }))

import AnalyticsIdentityBridge from './AnalyticsIdentityBridge'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

const UID = `crm-${'a'.repeat(64)}`
let root: Root | null = null
const gtag = vi.fn()

async function mount(payload: Record<string, unknown>) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => new Response(JSON.stringify(payload), { status: 200, headers: { 'content-type': 'application/json' } })),
  )
  const node = document.createElement('div')
  document.body.appendChild(node)
  root = createRoot(node)
  await act(async () => {
    root!.render(React.createElement(AnalyticsIdentityBridge))
  })
  // fetch + json + the gtag wait resolve on later ticks
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0))
  })
}

const userIdSets = () => gtag.mock.calls.filter((c) => c[0] === 'set' && c[1] && typeof c[1] === 'object' && 'user_id' in c[1]).map((c) => c[1].user_id)

beforeEach(() => {
  state.analytics = true
  gtag.mockReset()
  window.gtag = gtag
  window.dataLayer = []
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  vi.unstubAllGlobals()
})

const known = { identified: true, hashedUserId: UID, hashedEmail: null, personId: 64115 }

describe('AnalyticsIdentityBridge', () => {
  it('tags a known contact at the analytics tier with gtag set, never config', async () => {
    await mount(known)
    expect(userIdSets()).toEqual([UID])
    expect(gtag.mock.calls.some((c) => c[0] === 'config')).toBe(false)
    expect(window.dataLayer).toContainEqual({ user_id: UID })
  })

  it('does not tag a known contact at the essential tier', async () => {
    state.analytics = false
    await mount(known)
    expect(userIdSets()).toEqual([])
  })

  it('tags once the banner turns analytics on, and clears the id when it turns it off', async () => {
    state.analytics = false
    await mount(known)
    state.analytics = true
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
    })
    expect(userIdSets()).toEqual([UID])
    state.analytics = false
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'essential' }))
    })
    expect(userIdSets()).toEqual([UID, null])
  })

  it('does nothing for an anonymous visitor, whatever the banner says', async () => {
    await mount({ identified: false, hashedUserId: null, hashedEmail: null, personId: null })
    await act(async () => {
      window.dispatchEvent(new CustomEvent('cookie-consent', { detail: 'all' }))
    })
    expect(gtag).not.toHaveBeenCalled()
  })
})
