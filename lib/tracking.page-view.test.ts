/**
 * @vitest-environment jsdom
 *
 * Client gtag page_view must carry assigned_broker (USER) + broker_slug (EVENT)
 * when ?agent= is known — the same custom-definition names as generate_lead.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyVisitBrokerToGtag, trackPageView } from './tracking'

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
    expect(gtag).toHaveBeenCalledWith(
      'event',
      'page_view',
      expect.objectContaining({
        page_type: 'listing_search',
        broker_slug: 'rebecca',
      }),
    )
    const pushed = window.dataLayer ?? []
    expect(pushed.some((row) => {
      if (!row || typeof row !== 'object') return false
      const rec = row as Record<string, unknown>
      return rec.event === 'page_view' && rec.broker_slug === 'rebecca'
    })).toBe(true)
  })

  it('omits broker props when no agent is known', () => {
    window.history.replaceState({}, '', '/homes-for-sale')
    trackPageView('listing_search')
    expect(gtag).not.toHaveBeenCalledWith('set', 'user_properties', expect.anything())
    const eventCall = gtag.mock.calls.find((c) => c[0] === 'event' && c[1] === 'page_view')
    expect(eventCall?.[2]).not.toHaveProperty('broker_slug')
  })

  it('applyVisitBrokerToGtag reads the attribution cookie after the URL param is gone', () => {
    window.history.replaceState({}, '', '/housing-market/bend')
    document.cookie = `rr_agent_attribution=${encodeURIComponent(JSON.stringify({ slug: 'paul' }))}`
    expect(applyVisitBrokerToGtag()).toEqual({ broker_slug: 'paul', assigned_broker: 'paul' })
  })
})
