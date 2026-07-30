import { describe, expect, it } from 'vitest'
import {
  detectListingEvents,
  filterEventsByToggles,
  DEFAULT_EVENT_TOGGLES,
  type ListingEventSource,
} from '@/lib/alerts/event-detection'
import { planAlertDelivery } from '@/lib/alerts/delivery-plan'

/**
 * Decisions taken 2026-07-30 after the adversarial audit:
 *   1. price_change fires ONLY from the per-subscriber notified price (§0: no
 *      unsourced number in a client email). The listings.last_price_change_*
 *      fallback is gone — the MLS feed stopped populating it on 2026-04-07.
 *   2. sold is VOW-only (ODS §5-4 A.4): it can never reach a guest alert row,
 *      whatever the stored toggle says.
 */

function src(over: Partial<ListingEventSource> = {}): ListingEventSource {
  return {
    listingKey: '220200001',
    listPrice: 600000,
    standardStatus: 'Active',
    lastPriceChangeDate: null,
    lastPriceChangeAmount: null,
    lastPriceChangePct: null,
    pendingTimestamp: null,
    backOnMarketTimestamp: null,
    statusChangeTimestamp: null,
    closeDate: null,
    hasOpenHouse: false,
    ...over,
  } as ListingEventSource
}

describe('price_change integrity (§0: every figure sourced)', () => {
  it('does NOT fire from the dead last_price_change_* columns', () => {
    // Legacy entry: no stored price, but the stale history stamp is "recent".
    const { events } = detectListingEvents({
      prevRaw: [{ key: '220200001', price: null, status: null, notified_at: '2026-07-01T00:00:00Z' }],
      lastNotifiedAt: '2026-07-01T00:00:00Z',
      currentMatches: [src({ lastPriceChangeDate: '2026-07-20T00:00:00Z', lastPriceChangeAmount: 25000, lastPriceChangePct: 4 })],
      departedLookup: [],
      now: new Date('2026-07-30T00:00:00Z'),
    })
    expect(events.filter((e) => e.type === 'price_change')).toEqual([])
  })

  it('fires from the per-subscriber notified price, with a correct direction', () => {
    const { events } = detectListingEvents({
      prevRaw: [{ key: '220200001', price: 665000, status: 'Active', notified_at: '2026-07-01T00:00:00Z', open_house: false }],
      lastNotifiedAt: '2026-07-01T00:00:00Z',
      currentMatches: [src({ listPrice: 600000 })],
      departedLookup: [],
      now: new Date('2026-07-30T00:00:00Z'),
    })
    const pc = events.find((e) => e.type === 'price_change')
    expect(pc).toBeDefined()
    // A cut must never be announced as an increase (the audit caught exactly this).
    expect(pc).toMatchObject({ oldPrice: 665000, newPrice: 600000, direction: 'down' })
    expect(pc?.changeAmount).toBe(-65000)
  })
})

describe('sold is VOW-only (ODS)', () => {
  const soldEvent = [{ type: 'sold' as const, listingKey: '220200001' }]
  const toggles = { ...DEFAULT_EVENT_TOGGLES, sold: true }

  it('drops sold for a guest row even when the toggle is ON', () => {
    expect(filterEventsByToggles(soldEvent, toggles, { vowEligible: false })).toEqual([])
  })

  it('keeps sold for a registered (VOW-eligible) subscriber', () => {
    expect(filterEventsByToggles(soldEvent, toggles, { vowEligible: true })).toEqual(soldEvent)
  })

  it('defaults to DROPPING sold when eligibility is not supplied (fail closed)', () => {
    expect(filterEventsByToggles(soldEvent, toggles)).toEqual([])
  })

  it('planAlertDelivery skips a guest alert whose only event is sold', () => {
    const plan = planAlertDelivery({
      events: soldEvent,
      toggles,
      previewMode: false,
      recipients: [{ email: 'guest@example.com', name: null, kind: 'primary', unsubscribeToken: 't' }],
      compliance: new Map([['guest@example.com', { hardStopped: false, suppressed: false }]]),
      vowEligible: false,
    })
    expect(plan.action).toBe('skip')
    if (plan.action !== 'skip') throw new Error('expected skip')
    expect(plan.reason).toBe('no_events')
  })

  it('non-sold events still flow to a guest row', () => {
    const plan = planAlertDelivery({
      events: [{ type: 'new', listingKey: '220200001' }],
      toggles,
      previewMode: false,
      recipients: [{ email: 'guest@example.com', name: null, kind: 'primary', unsubscribeToken: 't' }],
      compliance: new Map([['guest@example.com', { hardStopped: false, suppressed: false }]]),
      vowEligible: false,
    })
    expect(plan.action).toBe('send')
  })
})
