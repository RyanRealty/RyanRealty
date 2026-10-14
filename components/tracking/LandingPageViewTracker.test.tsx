/**
 * @vitest-environment jsdom
 * @vitest-environment-options {"url": "https://ryan-realty.com/sell"}
 *
 * view_landing_page fires once per landing-page view, site-wide, with the page
 * variant lpVariantFromPath gives (Matt 2026-10-09: rebuild the GA4 landing-page
 * audiences on /sell and /buy). GA4 held none of this event from 2026-08-01 to
 * 2026-10-09, so the "LP visitors" audiences had no members.
 *
 * The context is the page's own address and nothing else: the tab-lifetime
 * rr_lp_context copy is gone, so an old landing's utm never rides into a later
 * visit's event or form.
 */
import React, { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/sell' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))

import LandingPageViewTracker from './LandingPageViewTracker'
import { getLpContext, trackLandingPageView } from '@/lib/tracking'

;(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true

type Row = Record<string, unknown>
const lpViews = (): Row[] =>
  (window.dataLayer ?? []).filter((r): r is Row => !!r && typeof r === 'object' && (r as Row).event === 'view_landing_page')

let root: Root | null = null
let host: HTMLDivElement | null = null

function render() {
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  act(() => root!.render(<LandingPageViewTracker />))
}

function rerender() {
  act(() => root!.render(<LandingPageViewTracker />))
}

beforeEach(() => {
  window.dataLayer = []
  window.sessionStorage.clear()
  nav.pathname = '/sell'
  window.history.replaceState({}, '', '/sell')
})

afterEach(() => {
  act(() => root?.unmount())
  host?.remove()
  root = null
  host = null
  window.dataLayer = []
})

describe('LandingPageViewTracker', () => {
  it('fires once on a seller landing page, with the page variant and its utm', () => {
    window.history.replaceState({}, '', '/sell/expired-listings?utm_source=facebook&utm_medium=paid_social&utm_campaign=expired')
    nav.pathname = '/sell/expired-listings'
    render()
    rerender()

    expect(lpViews()).toHaveLength(1)
    expect(lpViews()[0]).toMatchObject({
      event: 'view_landing_page',
      lp_variant: 'expired-listing',
      lp_source: 'facebook',
      lp_medium: 'paid_social',
      lp_campaign: 'expired',
    })
  })

  it('names every live landing page by its page variant', () => {
    const cases: Array<[string, string]> = [
      ['/sell', 'seller-home-value'],
      ['/sell/valuation', 'seller-home-value'],
      ['/sell/for-sale-by-owner', 'fsbo'],
      ['/buy/alerts', 'buy-alerts'],
      ['/buy/leverage', 'buy-leverage'],
      ['/buy/first-time-home-buyer', 'buy-first-time-home-buyer'],
    ]
    nav.pathname = cases[0]![0]
    render()
    for (const [path] of cases.slice(1)) {
      nav.pathname = path
      rerender()
    }
    expect(lpViews().map((r) => r.lp_variant)).toEqual(cases.map(([, v]) => v))
  })

  it('stays silent off the landing pages and on a 404 under /buy or /lp', () => {
    for (const path of ['/homes-for-sale', '/buy', '/', '/sell-my-home-fast', '/buy/xyz', '/lp/foo', '/lp/seller-home-value', '/sell/inherited-home']) {
      nav.pathname = path
      if (!root) render()
      else rerender()
    }
    expect(lpViews()).toHaveLength(0)
  })
})

describe('the landing-page context is the page’s own address', () => {
  it('ignores an old landing’s utm left in the tab and stores nothing', () => {
    window.sessionStorage.setItem(
      'rr_lp_context',
      JSON.stringify({ lp_variant: 'buy-leverage', lp_source: 'facebook', lp_medium: 'paid_social', fbclid: 'OLD' }),
    )
    window.history.replaceState({}, '', '/buy/alerts')

    expect(getLpContext('buy-alerts')).toEqual({ lp_variant: 'buy-alerts' })

    const sent = trackLandingPageView('buy-alerts')
    expect(sent).toEqual({ lp_variant: 'buy-alerts' })
    expect(lpViews()[0]).toEqual(expect.objectContaining({ event: 'view_landing_page', lp_variant: 'buy-alerts' }))
    expect(lpViews()[0]).not.toHaveProperty('lp_source')
    // The stale copy is not rewritten, and nothing new is written.
    expect(window.sessionStorage.length).toBe(1)
  })

  it('drops empty params rather than sending empty strings', () => {
    window.history.replaceState({}, '', '/buy/alerts?utm_source=&utm_medium=cpc&gclid=G1')
    expect(getLpContext('buy-alerts')).toEqual({ lp_variant: 'buy-alerts', lp_medium: 'cpc', gclid: 'G1' })
  })
})
