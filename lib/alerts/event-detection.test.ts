import { describe, it, expect } from 'vitest'
import {
  DEFAULT_EVENT_TOGGLES,
  detectListingEvents,
  filterEventsByToggles,
  normalizeEventToggles,
  parseNotifiedState,
  type ListingEventSource,
  type ListingEvent,
} from './event-detection'

/**
 * Phase 3 contract test (SEARCH_OPTIMIZATION_PLAN_2026-07-29 §4 Phase 3 item
 * 9): for a fixture listing mutation set (new, price drop, pending, BOM, sold,
 * OH), exactly the toggled event types fire, once each.
 */

const NOW = new Date('2026-07-29T18:00:00Z')
const LAST_NOTIFY = '2026-07-22T18:00:00Z'
const AFTER_NOTIFY = '2026-07-25T12:00:00Z'
const BEFORE_NOTIFY = '2026-07-10T12:00:00Z'

function source(overrides: Partial<ListingEventSource> & { listingKey: string }): ListingEventSource {
  return {
    standardStatus: 'Active',
    listPrice: 800000,
    closeDate: null,
    lastPriceChangeDate: null,
    lastPriceChangeAmount: null,
    lastPriceChangePct: null,
    pendingTimestamp: null,
    backOnMarketTimestamp: null,
    statusChangeTimestamp: null,
    hasOpenHouse: false,
    ...overrides,
  }
}

function entry(key: string, over: Record<string, unknown> = {}) {
  return { key, price: 800000, status: 'Active', notified_at: LAST_NOTIFY, open_house: false, ...over }
}

function types(events: ListingEvent[]): string[] {
  return events.map((e) => `${e.type}:${e.listingKey}`).sort()
}

describe('parseNotifiedState', () => {
  it('parses typed entries', () => {
    const { entries, hadLegacyState } = parseNotifiedState(
      [{ key: 'A', price: 500000, status: 'Active', notified_at: LAST_NOTIFY, open_house: true }],
      null,
    )
    expect(hadLegacyState).toBe(false)
    expect(entries.get('A')).toEqual({
      key: 'A',
      price: 500000,
      status: 'Active',
      notified_at: LAST_NOTIFY,
      open_house: true,
    })
  })

  it('parses legacy plain-key strings with the row fallback timestamp', () => {
    const { entries, hadLegacyState } = parseNotifiedState(['A', 'B'], LAST_NOTIFY)
    expect(hadLegacyState).toBe(true)
    expect(entries.get('A')).toEqual({ key: 'A', price: null, status: null, notified_at: LAST_NOTIFY })
    expect(entries.size).toBe(2)
  })

  it('mixes both shapes and survives garbage', () => {
    const { entries } = parseNotifiedState(
      ['A', { key: 'B', price: 1, status: null, notified_at: null }, 42, null, {}, { key: '' }],
      null,
    )
    expect([...entries.keys()].sort()).toEqual(['A', 'B'])
  })

  it('returns empty on non-array input', () => {
    expect(parseNotifiedState(null, null).entries.size).toBe(0)
    expect(parseNotifiedState('nope', null).entries.size).toBe(0)
  })
})

describe('normalizeEventToggles', () => {
  it('defaults match the Flexmls-inherited migration defaults', () => {
    expect(normalizeEventToggles(undefined)).toEqual({
      new: true,
      price_change: true,
      status_change: true,
      back_on_market: false,
      sold: false,
      open_house: false,
    })
    expect(normalizeEventToggles(undefined)).toEqual(DEFAULT_EVENT_TOGGLES)
  })

  it('honors stored booleans and ignores junk keys', () => {
    const toggles = normalizeEventToggles({ new: false, sold: true, bogus: true, price_change: 'yes' })
    expect(toggles.new).toBe(false)
    expect(toggles.sold).toBe(true)
    expect(toggles.price_change).toBe(true) // non-boolean falls back to default
    expect('bogus' in toggles).toBe(false)
  })
})

describe('detectListingEvents — the fixture mutation matrix', () => {
  it('fires exactly the right typed events, once each', () => {
    const prev = [
      entry('SEEN'), // unchanged
      entry('DROP'), // price will drop
      entry('PEND'), // goes pending, still in window
      entry('BOM'), // back on market
      entry('OH'), // gains an open house
      entry('SOLD'), // closes, leaves the window
      entry('GONE'), // leaves the window, unresolvable
      entry('OUT'), // leaves the window, still active
    ]
    const result = detectListingEvents({
      prevRaw: prev,
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [
        source({ listingKey: 'NEWK' }),
        source({ listingKey: 'SEEN' }),
        source({
          listingKey: 'DROP',
          listPrice: 775000,
          lastPriceChangeDate: AFTER_NOTIFY,
          lastPriceChangeAmount: -25000,
          lastPriceChangePct: -3.1,
        }),
        source({ listingKey: 'PEND', standardStatus: 'Pending', pendingTimestamp: AFTER_NOTIFY }),
        source({ listingKey: 'BOM', backOnMarketTimestamp: AFTER_NOTIFY }),
        source({ listingKey: 'OH', hasOpenHouse: true }),
      ],
      departedLookup: [
        source({ listingKey: 'SOLD', standardStatus: 'Closed', closeDate: AFTER_NOTIFY }),
        source({ listingKey: 'OUT', standardStatus: 'Active' }),
      ],
      now: NOW,
    })

    expect(types(result.events)).toEqual(
      [
        'new:NEWK',
        'price_change:DROP',
        'status_change:PEND',
        'back_on_market:BOM',
        'open_house:OH',
        'sold:SOLD',
      ].sort(),
    )
  })

  it('price_change carries direction, amount, and old→new prices', () => {
    const result = detectListingEvents({
      prevRaw: [entry('DROP', { price: 800000 })],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [source({ listingKey: 'DROP', listPrice: 775000 })],
      departedLookup: [],
      now: NOW,
    })
    expect(result.events).toEqual([
      {
        type: 'price_change',
        listingKey: 'DROP',
        oldPrice: 800000,
        newPrice: 775000,
        changeAmount: -25000,
        changePct: -3.1,
        direction: 'down',
      },
    ])
  })

  it('a brand-new listing fires ONLY new, even with change stamps', () => {
    const result = detectListingEvents({
      prevRaw: [],
      lastNotifiedAt: null,
      currentMatches: [
        source({
          listingKey: 'NEWK',
          lastPriceChangeDate: AFTER_NOTIFY,
          pendingTimestamp: AFTER_NOTIFY,
          backOnMarketTimestamp: AFTER_NOTIFY,
          hasOpenHouse: true,
        }),
      ],
      departedLookup: [],
      now: NOW,
    })
    expect(types(result.events)).toEqual(['new:NEWK'])
  })

  it('stamps before the last notify never fire', () => {
    const result = detectListingEvents({
      prevRaw: [entry('A')],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [
        source({
          listingKey: 'A',
          lastPriceChangeDate: BEFORE_NOTIFY,
          pendingTimestamp: BEFORE_NOTIFY,
          backOnMarketTimestamp: BEFORE_NOTIFY,
        }),
      ],
      departedLookup: [],
      now: NOW,
    })
    expect(result.events).toEqual([])
  })

  it('absence from the window alone never fires sold (truncated windows)', () => {
    const result = detectListingEvents({
      prevRaw: [entry('OUT')],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [],
      departedLookup: [source({ listingKey: 'OUT', standardStatus: 'Active' })],
      now: NOW,
    })
    expect(result.events).toEqual([])
    // Still-active departed keys are carried forward, not re-announced later.
    expect(result.nextState.map((e) => e.key)).toEqual(['OUT'])
  })

  it('sold keys and unresolvable keys leave the state; sold fires once', () => {
    const result = detectListingEvents({
      prevRaw: [entry('SOLD'), entry('GONE')],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [],
      departedLookup: [source({ listingKey: 'SOLD', standardStatus: 'Closed', closeDate: AFTER_NOTIFY })],
      now: NOW,
    })
    expect(types(result.events)).toEqual(['sold:SOLD'])
    expect(result.nextState).toEqual([])
  })

  it('a sale closed before the last notify fires nothing and drops out', () => {
    const result = detectListingEvents({
      prevRaw: [entry('OLD')],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [],
      departedLookup: [source({ listingKey: 'OLD', standardStatus: 'Closed', closeDate: BEFORE_NOTIFY })],
      now: NOW,
    })
    expect(result.events).toEqual([])
    expect(result.nextState).toEqual([])
  })

  it('open_house fires only on an explicit false→true transition', () => {
    const fires = detectListingEvents({
      prevRaw: [entry('A', { open_house: false })],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [source({ listingKey: 'A', hasOpenHouse: true })],
      departedLookup: [],
      now: NOW,
    })
    expect(types(fires.events)).toEqual(['open_house:A'])

    const alreadyTrue = detectListingEvents({
      prevRaw: [entry('A', { open_house: true })],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [source({ listingKey: 'A', hasOpenHouse: true })],
      departedLookup: [],
      now: NOW,
    })
    expect(alreadyTrue.events).toEqual([])
  })

  it('writes fresh typed state for every current match', () => {
    const result = detectListingEvents({
      prevRaw: [entry('SEEN')],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [
        source({ listingKey: 'SEEN', listPrice: 800000, hasOpenHouse: true, standardStatus: 'Active' }),
      ],
      departedLookup: [],
      now: NOW,
    })
    expect(result.nextState).toEqual([
      {
        key: 'SEEN',
        price: 800000,
        status: 'Active',
        notified_at: NOW.toISOString(),
        open_house: true,
      },
    ])
  })
})

describe('detectListingEvents — legacy plain-key back-compat', () => {
  it('legacy keys never fire new, and suppress open_house on unknown prior state', () => {
    const result = detectListingEvents({
      prevRaw: ['SEEN', 'OHKEY'],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [
        source({ listingKey: 'SEEN' }),
        source({ listingKey: 'OHKEY', hasOpenHouse: true }),
        source({ listingKey: 'NEWK' }),
      ],
      departedLookup: [],
      now: NOW,
    })
    expect(result.hadLegacyState).toBe(true)
    // OHKEY has no stored open_house flag → suppressed. Only NEWK is new.
    expect(types(result.events)).toEqual(['new:NEWK'])
  })

  it('legacy keys still fire price_change via the history stamp', () => {
    const result = detectListingEvents({
      prevRaw: ['DROP'],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [
        source({
          listingKey: 'DROP',
          listPrice: 775000,
          lastPriceChangeDate: AFTER_NOTIFY,
          lastPriceChangeAmount: -25000,
          lastPriceChangePct: -3.1,
        }),
      ],
      departedLookup: [],
      now: NOW,
    })
    expect(result.events).toHaveLength(1)
    const event = result.events[0]
    expect(event.type).toBe('price_change')
    expect(event.newPrice).toBe(775000)
    expect(event.changeAmount).toBe(-25000)
    expect(event.direction).toBe('down')
    // oldPrice reconstructed from the history amount when no stored price.
    expect(event.oldPrice).toBe(800000)
  })

  it('legacy state migrates to typed entries on the next pass', () => {
    const result = detectListingEvents({
      prevRaw: ['SEEN'],
      lastNotifiedAt: LAST_NOTIFY,
      currentMatches: [source({ listingKey: 'SEEN' })],
      departedLookup: [],
      now: NOW,
    })
    expect(result.nextState[0]).toMatchObject({ key: 'SEEN', price: 800000, status: 'Active' })
  })
})

describe('filterEventsByToggles', () => {
  const events: ListingEvent[] = [
    { type: 'new', listingKey: 'A' },
    { type: 'price_change', listingKey: 'B' },
    { type: 'sold', listingKey: 'C' },
    { type: 'open_house', listingKey: 'D' },
  ]

  it('keeps only toggled-on event types', () => {
    const filtered = filterEventsByToggles(events, DEFAULT_EVENT_TOGGLES)
    expect(types(filtered)).toEqual(['new:A', 'price_change:B'])
  })

  it('an all-off map silences everything', () => {
    const off = normalizeEventToggles({
      new: false,
      price_change: false,
      status_change: false,
      back_on_market: false,
      sold: false,
      open_house: false,
    })
    expect(filterEventsByToggles(events, off)).toEqual([])
  })

  it('sold + open_house opt-in works', () => {
    const toggles = normalizeEventToggles({ new: false, price_change: false, sold: true, open_house: true })
    expect(types(filterEventsByToggles(events, toggles))).toEqual(['open_house:D', 'sold:C'])
  })
})
