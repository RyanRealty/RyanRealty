/**
 * @vitest-environment jsdom
 *
 * Client trackPageView stamps assigned_broker (USER, via gtag set) and
 * broker_slug (EVENT, on the dataLayer page_view push) when ?agent= is known.
 * Same custom-definition names as generate_lead. It never calls
 * gtag('event','page_view') -- GTM's Google tag owns that event, and a second
 * gtag copy would double-count.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyVisitBrokerToGtag, trackPageView } from './tracking'

function dataLayerPageView(): Record<string, unknown> | undefined {
  return (window.dataLayer ?? []).find((row): row is Record<string, unknown> => {
    if (!row || typeof row !== 'object') return false
    return (row as Record<string, unknown>).event === 'page_view'
  })
}

describe('trackPageView visit broker props', () => {
  const gtag = vi.fn()

  beforeEach(() => {
    gtag.mockReset()
    window.gtag = gtag
    window.dataLayer = []
    document.cookie = 'rr_agent_attribution=; path=/; max-age=0'
    window.history.replaceState({}, '', '/homes-for-sale?agent=rebecca-peterson')
  })

  afterEach(() => {
    document.cookie = 'rr_agent_attribution=; path=/; max-age=0'
    window.history.replaceState({}, '', '/')
    delete window.gtag
    window.dataLayer = []
  })

  it('sets assigned_broker user property and broker_slug on page_view when agent is known', () => {
    trackPageView('listing_search', { page_path: '/homes-for-sale' })

    expect(gtag).toHaveBeenCalledWith('set', 'user_properties', { assigned_broker: 'rebecca' })
    expect(gtag.mock.calls.some((c) => c[0] === 'event' && c[1] === 'page_view')).toBe(false)
    expect(dataLayerPageView()).toEqual(
      expect.objectContaining({
        event: 'page_view',
        page_type: 'listing_search',
        broker_slug: 'rebecca',
      }),
    )
  })

  it('omits broker props when no agent is known', () => {
    window.history.replaceState({}, '', '/homes-for-sale')
    trackPageView('listing_search')
    expect(gtag).not.toHaveBeenCalledWith('set', 'user_properties', expect.anything())
    expect(gtag.mock.calls.some((c) => c[0] === 'event' && c[1] === 'page_view')).toBe(false)
    const pushed = dataLayerPageView()
    expect(pushed).toEqual(expect.objectContaining({ event: 'page_view', page_type: 'listing_search' }))
    expect(pushed).not.toHaveProperty('broker_slug')
  })

  it('applyVisitBrokerToGtag reads the attribution cookie after the URL param is gone', () => {
    window.history.replaceState({}, '', '/housing-market/bend')
    document.cookie = `rr_agent_attribution=${encodeURIComponent(JSON.stringify({ slug: 'paul' }))}`
    expect(applyVisitBrokerToGtag()).toEqual({ broker_slug: 'paul', assigned_broker: 'paul' })
  })
})
