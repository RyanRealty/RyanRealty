import { describe, it, expect } from 'vitest'
import { deriveIntentSignals, topByCount, type BehaviorEventRow } from './getContactBehaviorSummary'

// A fixed "now" so the 7-day window math is deterministic. 2026-06-20 00:00 UTC.
const NOW = Date.parse('2026-06-20T00:00:00.000Z')

// Helper to build a minimal event row with sensible defaults.
function ev(partial: Partial<BehaviorEventRow>): BehaviorEventRow {
  return {
    event_type: 'page_view',
    event_at: '2026-06-19T12:00:00.000Z',
    page_url: 'https://ryan-realty.com/',
    page_category: null,
    listing_mls: null,
    listing_street: null,
    metadata: null,
    ...partial,
  }
}

describe('topByCount', () => {
  it('rolls rows up by key, descending by count', () => {
    const rows = [
      { listing_mls: '111' },
      { listing_mls: '222' },
      { listing_mls: '111' },
      { listing_mls: '111' },
      { listing_mls: '222' },
    ]
    expect(topByCount(rows, 'listing_mls', 5)).toEqual([
      { value: '111', count: 3 },
      { value: '222', count: 2 },
    ])
  })

  it('caps the result at n', () => {
    const rows = [
      { k: 'a' },
      { k: 'b' },
      { k: 'c' },
      { k: 'a' },
    ]
    const out = topByCount(rows, 'k', 2)
    expect(out).toHaveLength(2)
    expect(out[0]).toEqual({ value: 'a', count: 2 })
  })

  it('returns an empty list when n is zero or negative', () => {
    const rows = [{ k: 'a' }, { k: 'a' }]
    expect(topByCount(rows, 'k', 0)).toEqual([])
    expect(topByCount(rows, 'k', -3)).toEqual([])
  })

  it('skips rows whose key is null, undefined, or empty/whitespace', () => {
    const rows = [
      { k: 'a' },
      { k: null },
      { k: undefined },
      { k: '' },
      { k: '   ' },
      { k: 'a' },
    ]
    expect(topByCount(rows, 'k', 5)).toEqual([{ value: 'a', count: 2 }])
  })

  it('coerces non-string keys (numbers) to their string form', () => {
    const rows = [{ id: 7 }, { id: 7 }, { id: 9 }]
    expect(topByCount(rows, 'id', 5)).toEqual([
      { value: '7', count: 2 },
      { value: '9', count: 1 },
    ])
  })

  it('breaks count ties by first-seen order (stable)', () => {
    const rows = [{ k: 'zebra' }, { k: 'apple' }, { k: 'apple' }, { k: 'zebra' }]
    // both have count 2; zebra was seen first, so it leads.
    expect(topByCount(rows, 'k', 5)).toEqual([
      { value: 'zebra', count: 2 },
      { value: 'apple', count: 2 },
    ])
  })

  it('returns an empty list for empty input', () => {
    expect(topByCount([], 'k', 5)).toEqual([])
  })
})

describe('deriveIntentSignals', () => {
  it('returns no signals for an empty trail', () => {
    expect(deriveIntentSignals([], NOW)).toEqual([])
  })

  it('flags 5+ distinct listings viewed in the trailing 7 days', () => {
    const events: BehaviorEventRow[] = ['111', '222', '333', '444', '555'].map((mls) =>
      ev({ event_type: 'listing_view', listing_mls: mls, event_at: '2026-06-18T10:00:00.000Z' }),
    )
    const signals = deriveIntentSignals(events, NOW)
    expect(signals).toContain('viewed 5+ listings in 7 days')
  })

  it('does NOT flag the listing signal below the 5-distinct threshold', () => {
    const events: BehaviorEventRow[] = ['111', '222', '333', '444'].map((mls) =>
      ev({ event_type: 'listing_view', listing_mls: mls, event_at: '2026-06-18T10:00:00.000Z' }),
    )
    const signals = deriveIntentSignals(events, NOW)
    expect(signals.some((s) => s.startsWith('viewed'))).toBe(false)
  })

  it('counts distinct listings, not raw views, for the 7-day signal', () => {
    // 8 views but only 3 distinct homes -> below threshold.
    const events: BehaviorEventRow[] = [
      '111', '111', '111', '222', '222', '333', '333', '333',
    ].map((mls) => ev({ event_type: 'listing_view', listing_mls: mls, event_at: '2026-06-18T10:00:00.000Z' }))
    expect(deriveIntentSignals(events, NOW).some((s) => s.startsWith('viewed'))).toBe(false)
  })

  it('excludes listings viewed OUTSIDE the trailing 7 days from the hot signal', () => {
    // 5 distinct homes, but all viewed 10 days before NOW.
    const events: BehaviorEventRow[] = ['111', '222', '333', '444', '555'].map((mls) =>
      ev({ event_type: 'listing_view', listing_mls: mls, event_at: '2026-06-09T10:00:00.000Z' }),
    )
    const signals = deriveIntentSignals(events, NOW)
    expect(signals.some((s) => s.startsWith('viewed'))).toBe(false)
  })

  it('treats a listing_detail page_view as a listing view', () => {
    const events: BehaviorEventRow[] = ['111', '222', '333', '444', '555'].map((mls) =>
      ev({
        event_type: 'page_view',
        page_category: 'listing_detail',
        listing_mls: mls,
        event_at: '2026-06-18T10:00:00.000Z',
      }),
    )
    expect(deriveIntentSignals(events, NOW)).toContain('viewed 5+ listings in 7 days')
  })

  it('flags a repeat visitor when the trail spans 2+ distinct days', () => {
    const events: BehaviorEventRow[] = [
      ev({ event_at: '2026-06-17T10:00:00.000Z' }),
      ev({ event_at: '2026-06-19T10:00:00.000Z' }),
    ]
    expect(deriveIntentSignals(events, NOW)).toContain('repeat visitor')
  })

  it('does NOT flag a repeat visitor for multiple events on a single day', () => {
    const events: BehaviorEventRow[] = [
      ev({ event_at: '2026-06-19T08:00:00.000Z' }),
      ev({ event_at: '2026-06-19T20:00:00.000Z' }),
    ]
    expect(deriveIntentSignals(events, NOW)).not.toContain('repeat visitor')
  })

  it('flags a price-drop watcher from a price_drop metadata flag', () => {
    const events: BehaviorEventRow[] = [
      ev({ event_type: 'listing_view', listing_mls: '111', metadata: { price_drop: true } }),
    ]
    expect(deriveIntentSignals(events, NOW)).toContain('price-drop watcher')
  })

  it('accepts a string or numeric truthy price-drop flag', () => {
    expect(
      deriveIntentSignals([ev({ metadata: { priceDrop: 'true' } })], NOW),
    ).toContain('price-drop watcher')
    expect(
      deriveIntentSignals([ev({ metadata: { price_drop: 1 } })], NOW),
    ).toContain('price-drop watcher')
  })

  it('flags a mortgage-calculator user by page_category', () => {
    const events: BehaviorEventRow[] = [ev({ page_category: 'financial_tools' })]
    expect(deriveIntentSignals(events, NOW)).toContain('mortgage-calculator user')
  })

  it('flags a mortgage-calculator user by page_url', () => {
    const events: BehaviorEventRow[] = [
      ev({ page_url: 'https://ryan-realty.com/tools/mortgage-calculator' }),
    ]
    expect(deriveIntentSignals(events, NOW)).toContain('mortgage-calculator user')
  })

  it('flags a home-value seeker from a seller-intent valuation page', () => {
    const events: BehaviorEventRow[] = [
      ev({ page_url: 'https://ryan-realty.com/home-valuation' }),
    ]
    expect(deriveIntentSignals(events, NOW)).toContain('home-value seeker')
  })

  it('flags a home-value seeker by the seller_intent page_category', () => {
    const events: BehaviorEventRow[] = [ev({ page_category: 'seller_intent' })]
    expect(deriveIntentSignals(events, NOW)).toContain('home-value seeker')
  })

  it('flags an active searcher at 3+ searches', () => {
    const events: BehaviorEventRow[] = [
      ev({ event_type: 'search' }),
      ev({ event_type: 'search' }),
      ev({ event_type: 'search' }),
    ]
    expect(deriveIntentSignals(events, NOW)).toContain('active searcher')
  })

  it('does NOT flag an active searcher at 2 searches', () => {
    const events: BehaviorEventRow[] = [
      ev({ event_type: 'search' }),
      ev({ event_type: 'search' }),
    ]
    expect(deriveIntentSignals(events, NOW)).not.toContain('active searcher')
  })

  it('emits signals in the locked, stable order', () => {
    const events: BehaviorEventRow[] = [
      // 5 distinct recent listings -> hot signal
      ...['111', '222', '333', '444', '555'].map((mls) =>
        ev({ event_type: 'listing_view', listing_mls: mls, event_at: '2026-06-18T10:00:00.000Z' }),
      ),
      // a second distinct day -> repeat visitor
      ev({ event_at: '2026-06-15T09:00:00.000Z' }),
      // a 6th recent distinct listing that also carries a price-drop flag
      ev({ event_type: 'listing_view', listing_mls: '666', metadata: { price_drop: true } }),
      // mortgage, seller intent, 3 searches
      ev({ page_category: 'financial_tools' }),
      ev({ page_category: 'seller_intent' }),
      ev({ event_type: 'search' }),
      ev({ event_type: 'search' }),
      ev({ event_type: 'search' }),
    ]
    expect(deriveIntentSignals(events, NOW)).toEqual([
      'viewed 6+ listings in 7 days',
      'repeat visitor',
      'price-drop watcher',
      'mortgage-calculator user',
      'home-value seeker',
      'active searcher',
    ])
  })

  it('tolerates a missing event_at without throwing', () => {
    const events: BehaviorEventRow[] = [
      ev({ event_at: null, event_type: 'search' }),
      ev({ event_at: null, event_type: 'search' }),
      ev({ event_at: null, event_type: 'search' }),
    ]
    expect(deriveIntentSignals(events, NOW)).toContain('active searcher')
    // null event_at contributes no day bucket, so no repeat-visitor flag.
    expect(deriveIntentSignals(events, NOW)).not.toContain('repeat visitor')
  })

  it('does not double-emit a signal when the same condition recurs', () => {
    const events: BehaviorEventRow[] = [
      ev({ page_category: 'financial_tools' }),
      ev({ page_category: 'financial_tools' }),
      ev({ page_url: 'https://ryan-realty.com/tools/mortgage-calculator' }),
    ]
    const signals = deriveIntentSignals(events, NOW)
    expect(signals.filter((s) => s === 'mortgage-calculator user')).toHaveLength(1)
  })
})
