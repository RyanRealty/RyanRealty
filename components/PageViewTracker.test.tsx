/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/"}
 *
 * PageViewTracker is the client-side half of the one page_view sender (GTM
 * version 9, 2026-10-14): the bootstrap pushes first paint, this pushes one per
 * PATHNAME change. A query-only change (the search map's ?bbox=, the gallery's
 * ?photo=N) is not a page view; enhanced measurement counted those, so a map
 * zoom sent a second page_view (live test 2026-10-14).
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const state = vi.hoisted(() => ({ pathname: '/', analytics: true }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('./CookieConsentBanner', () => ({ hasMarketingConsent: () => false, hasAnalyticsConsent: () => state.analytics }))

import PageViewTracker from './PageViewTracker'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root | null = null

async function renderAt(url: string) {
  window.history.replaceState({}, '', url)
  state.pathname = new URL(url, 'https://ryan-realty.com').pathname
  if (!root) {
    const node = document.createElement('div')
    document.body.appendChild(node)
    root = createRoot(node)
  }
  await act(async () => {
    root!.render(React.createElement(PageViewTracker))
  })
}

function pageViews(): Array<Record<string, unknown>> {
  return (window.dataLayer ?? []).filter(
    (row): row is Record<string, unknown> => !!row && typeof row === 'object' && (row as Record<string, unknown>).event === 'page_view',
  )
}

beforeEach(() => {
  window.dataLayer = []
  window.localStorage.clear()
  state.analytics = true
  document.cookie = 'rr_agent_attribution=; path=/; max-age=0'
})

afterEach(async () => {
  await act(async () => root?.unmount())
  root = null
  window.dataLayer = []
})

describe('PageViewTracker', () => {
  it('pushes no page_view on first paint (the bootstrap did) but stamps page_type', async () => {
    await renderAt('/')
    expect(pageViews()).toEqual([])
    expect(window.dataLayer).toContainEqual(expect.objectContaining({ page_type: 'home' }))
  })

  it('pushes one page_view per pathname change, with the previous page as referrer', async () => {
    await renderAt('/')
    await renderAt('/cities/bend')
    expect(pageViews()).toEqual([
      expect.objectContaining({
        event: 'page_view',
        page_type: 'city',
        page_path: '/cities/bend',
        page_location: 'https://ryan-realty.com/cities/bend',
        page_referrer: 'https://ryan-realty.com/',
      }),
    ])
  })

  it('does not count a query-only change (a map move rewriting ?bbox=)', async () => {
    await renderAt('/')
    await renderAt('/homes-for-sale/sunriver')
    await renderAt('/homes-for-sale/sunriver?bbox=-121.6,43.7,-121.2,43.9')
    await renderAt('/homes-for-sale/sunriver?bbox=-121.5,43.8,-121.3,43.9')
    expect(pageViews()).toHaveLength(1)
  })

  it('strips identity params from page_location and keeps the campaign', async () => {
    await renderAt('/')
    await renderAt('/sell?_pid=13490&utm_source=email')
    const [view] = pageViews()
    expect(view.page_location).toBe('https://ryan-realty.com/sell?utm_source=email')
  })

  it('never tracks a private path', async () => {
    await renderAt('/')
    await renderAt('/sign/abc123')
    expect(pageViews()).toEqual([])
  })
})

describe('PageViewTracker private-path round trip', () => {
  it('counts the return to the page left for a private path', async () => {
    await renderAt('/')
    await renderAt('/cities/bend')
    await renderAt('/sign/abc123')
    await renderAt('/cities/bend')
    expect(pageViews().map((v) => v.page_path)).toEqual(['/cities/bend', '/cities/bend'])
  })
})

/**
 * Visitor intent (Matt 2026-10-14, GTM version 10): each counted page is recorded
 * and the label and market ride in the SAME push as page_type, BEFORE the
 * page_view, so GTM's variables hold them when "GA4 - page_view" fires.
 */
describe('PageViewTracker visitor intent', () => {
  const rows = () => (window.dataLayer ?? []) as Array<Record<string, unknown>>
  const STORAGE_KEY = 'rr_visitor_intent_v1'

  it('stamps visitor_intent and primary_market with page_type on first paint', async () => {
    await renderAt('/cities/bend')
    expect(rows()).toContainEqual({ page_type: 'city', visitor_intent: 'browsing', primary_market: 'bend' })
  })

  it('pushes the new label in the page-context push, before that page_view', async () => {
    await renderAt('/cities/bend')
    await renderAt('/sell')
    const all = rows()
    const view = all.findIndex((r) => r.event === 'page_view')
    const context = all.findIndex((r) => r.page_type === 'sell' && r.event === undefined)
    expect(context).toBeGreaterThan(-1)
    expect(view).toBeGreaterThan(context)
    expect(all[context]).toEqual({ page_type: 'sell', visitor_intent: 'seller', primary_market: 'bend' })
    // The page_view itself is unchanged: GTM reads the flat keys from its data model.
    expect(all[view]).not.toHaveProperty('visitor_intent')
  })

  it('three listing pages make a buyer; a query-only change is not a fourth view', async () => {
    await renderAt('/homes-for-sale/bend/x/1-main-st-220216401')
    await renderAt('/homes-for-sale/bend/x/2-main-st-220216402')
    await renderAt('/homes-for-sale/bend/x/2-main-st-220216402?photo=3')
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? '{}').listingViews).toHaveLength(2)
    await renderAt('/homes-for-sale/redmond/y/3-main-st-220216403')
    const last = rows().filter((r) => typeof r.page_type === 'string' && r.event === undefined).pop()
    expect(last).toEqual({ page_type: 'listing', visitor_intent: 'buyer', primary_market: 'bend' })
  })

  it('without analytics consent records nothing, pushes no intent key and forgets the stored memory', async () => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ intent: 'seller' }))
    state.analytics = false
    await renderAt('/sell')
    expect(rows()).toContainEqual({ page_type: 'sell' })
    expect(rows().some((r) => 'visitor_intent' in r || 'primary_market' in r)).toBe(false)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('never records a private path', async () => {
    await renderAt('/sign/abc123')
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull()
  })
})
