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

const state = vi.hoisted(() => ({ pathname: '/' }))
vi.mock('next/navigation', () => ({ usePathname: () => state.pathname }))
vi.mock('./CookieConsentBanner', () => ({ hasMarketingConsent: () => false }))

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
