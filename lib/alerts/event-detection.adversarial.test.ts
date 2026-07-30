import { describe, it, expect } from 'vitest'
import {
  detectListingEvents,
  parseNotifiedState,
  normalizeEventToggles,
  filterEventsByToggles,
  type ListingEventSource,
  type NotifiedEntry,
} from './event-detection'

/**
 * ADVERSARIAL audit of the typed-event detector shipped in deed9e4b.
 * Fixtures mirror the REAL public.listing_alerts rows in production
 * (read 2026-07-30): 5 active rows, notified_listing_keys = 100% legacy
 * plain MLS-number strings, events = the migration default, recipients NULL,
 * schedule_days NULL, preview_mode false.
 */

const NOW = new Date('2026-08-01T15:00:00Z')

function source(over: Partial<ListingEventSource> & { listingKey: string }): ListingEventSource {
  return {
    standardStatus: 'Active',
    listPrice: 750000,
    closeDate: null,
    lastPriceChangeDate: null,
    lastPriceChangeAmount: null,
    lastPriceChangePct: null,
    pendingTimestamp: null,
    backOnMarketTimestamp: null,
    statusChangeTimestamp: null,
    hasOpenHouse: false,
    ...over,
  }
}

// ── H1: legacy plain-string state must NOT reclassify as `new` ───────────────

describe('H1 mass-blast: legacy plain-string notified state', () => {
  const LAST_NOTIFIED = '2026-07-25T04:01:04.977Z'
  // Real shape: row fe4eb749 ("Bend $500K-$900K"), 15 legacy MLS numbers.
  const legacy = [
    '220215761', '220216002', '220216110', '220217334', '220218901',
    '220219004', '220219550', '220220118', '220220774', '220221009',
    '220221443', '220222001', '220222876', '220223310', '220224121',
  ]

  it('classifies ZERO of the legacy keys as new when they are still matching', () => {
    const matches = legacy.map((k) => source({ listingKey: k }))
    const res = detectListingEvents({
      prevRaw: legacy,
      lastNotifiedAt: LAST_NOTIFIED,
      currentMatches: matches,
      departedLookup: [],
      now: NOW,
    })
    expect(res.hadLegacyState).toBe(true)
    expect(res.events.filter((e) => e.type === 'new')).toEqual([])
    expect(res.events).toEqual([])
  })

  it('fires new ONLY for a key absent from the legacy state', () => {
    const matches = [...legacy, '220299999'].map((k) => source({ listingKey: k }))
    const res = detectListingEvents({
      prevRaw: legacy,
      lastNotifiedAt: LAST_NOTIFIED,
      currentMatches: matches,
      departedLookup: [],
      now: NOW,
    })
    expect(res.events).toEqual([{ type: 'new', listingKey: '220299999' }])
  })

  it('legacy entry with unknown open_house cannot fire open_house', () => {
    const res = detectListingEvents({
      prevRaw: ['A'],
      lastNotifiedAt: LAST_NOTIFIED,
      currentMatches: [source({ listingKey: 'A', hasOpenHouse: true })],
      departedLookup: [],
      now: NOW,
    })
    expect(res.events).toEqual([])
  })

  it('legacy state with a NULL last_notified_at fires nothing (no unknown baseline blast)', () => {
    const res = detectListingEvents({
      prevRaw: legacy,
      lastNotifiedAt: null,
      currentMatches: legacy.map((k) =>
        source({
          listingKey: k,
          pendingTimestamp: '2026-07-31T00:00:00Z',
          backOnMarketTimestamp: '2026-07-31T00:00:00Z',
          lastPriceChangeDate: '2026-07-31T00:00:00Z',
        }),
      ),
      departedLookup: [],
      now: NOW,
    })
    expect(res.events).toEqual([])
  })

  it('empty [] state (the column default) fires new for EVERY current match', () => {
    const matches = ['A', 'B', 'C'].map((k) => source({ listingKey: k }))
    const res = detectListingEvents({
      prevRaw: [],
      lastNotifiedAt: null,
      currentMatches: matches,
      departedLookup: [],
      now: NOW,
    })
    expect(res.events.map((e) => e.type)).toEqual(['new', 'new', 'new'])
  })
})

// ── FINDING A: nextState ordering vs the DAL's slice(-1000) cap ──────────────

describe('A: notified-state cap truncates the JUST-NOTIFIED matches', () => {
  /** Mirrors lib/data/leads/listingAlerts.ts markListingAlertNotified. */
  const applyDalCap = (s: NotifiedEntry[]) => s.slice(-1000)

  function bigPrevState(n: number, notifiedAt: string): NotifiedEntry[] {
    return Array.from({ length: n }, (_, i) => ({
      key: `OLD${i}`,
      price: 500000,
      status: 'Active',
      notified_at: notifiedAt,
      open_house: false,
    }))
  }

  it('puts current matches at the HEAD of nextState, so the cap cuts them first', () => {
    const prev = bigPrevState(1000, '2026-07-25T00:00:00Z')
    const current = ['NEW1', 'NEW2', 'NEW3'].map((k) => source({ listingKey: k }))
    // Every departed key still resolves (they are on-market listings), so all
    // 1000 are carried forward — exactly the steady state of a long-running alert.
    const departed = prev.map((e) => source({ listingKey: e.key }))

    const res = detectListingEvents({
      prevRaw: prev,
      lastNotifiedAt: '2026-07-25T00:00:00Z',
      currentMatches: current,
      departedLookup: departed,
      now: NOW,
    })
    expect(res.events.map((e) => e.type)).toEqual(['new', 'new', 'new'])
    expect(res.nextState.length).toBe(1003)
    // The three just-emailed listings sit at the head.
    expect(res.nextState.slice(0, 3).map((e) => e.key)).toEqual(['NEW1', 'NEW2', 'NEW3'])

    const persisted = applyDalCap(res.nextState)
    const persistedKeys = new Set(persisted.map((e) => e.key))
    // BUG: the listings we just emailed are the ones the cap throws away.
    expect(persistedKeys.has('NEW1')).toBe(false)
    expect(persistedKeys.has('NEW2')).toBe(false)
    expect(persistedKeys.has('NEW3')).toBe(false)
  })

  it('re-fires the SAME `new` events on the next run: a permanent duplicate loop', () => {
    let stored: Array<string | Record<string, unknown>> = bigPrevState(
      1000,
      '2026-07-25T00:00:00Z',
    ) as unknown as Array<Record<string, unknown>>
    const current = ['NEW1', 'NEW2', 'NEW3'].map((k) => source({ listingKey: k }))
    const departed = Array.from({ length: 1000 }, (_, i) => source({ listingKey: `OLD${i}` }))

    const runOnce = (lastNotifiedAt: string) => {
      const res = detectListingEvents({
        prevRaw: stored,
        lastNotifiedAt,
        currentMatches: current,
        departedLookup: departed,
        now: NOW,
      })
      stored = applyDalCap(res.nextState) as unknown as Array<Record<string, unknown>>
      return res.events
    }

    expect(runOnce('2026-07-25T00:00:00Z').map((e) => e.listingKey)).toEqual(['NEW1', 'NEW2', 'NEW3'])
    // Run 2 — nothing changed in the MLS, yet the identical email fires again.
    expect(runOnce('2026-08-01T15:00:00Z').map((e) => e.listingKey)).toEqual(['NEW1', 'NEW2', 'NEW3'])
    // Run 3 — and again, forever.
    expect(runOnce('2026-08-01T15:00:00Z').map((e) => e.listingKey)).toEqual(['NEW1', 'NEW2', 'NEW3'])
  })
})

// ── FINDING: departed key that fails the lookup is dropped from state ────────

describe('departed keys that fail the status lookup are silently forgotten', () => {
  it('drops the key, so it fires `new` again when it re-enters the match window', () => {
    const prev: NotifiedEntry[] = [
      { key: 'K1', price: 700000, status: 'Active', notified_at: '2026-07-25T00:00:00Z', open_house: false },
    ]
    // Run A: K1 is outside the 15-row window AND the lookup returned nothing
    // (chunk error / key drift). getListingEventStatesByKeys logs + `continue`s
    // on a chunk error, so a transient DB error empties the whole chunk.
    const runA = detectListingEvents({
      prevRaw: prev,
      lastNotifiedAt: '2026-07-25T00:00:00Z',
      currentMatches: [source({ listingKey: 'K2' })],
      departedLookup: [],
      now: NOW,
    })
    expect(runA.nextState.map((e) => e.key)).toEqual(['K2'])

    // Run B: K1 sorts back into the window → announced as brand new.
    const runB = detectListingEvents({
      prevRaw: runA.nextState,
      lastNotifiedAt: NOW.toISOString(),
      currentMatches: [source({ listingKey: 'K1' }), source({ listingKey: 'K2' })],
      departedLookup: [],
      now: NOW,
    })
    expect(runB.events).toEqual([{ type: 'new', listingKey: 'K1' }])
  })
})

// ── price_change: the history fallback rides columns that are dead ───────────

describe('price_change fallback for legacy entries', () => {
  it('never fires from the listings price-history columns (stale since 2026-04-18)', () => {
    // Newest last_price_change_date in prod is 2026-04-18; every alert cursor
    // is months newer, so isAfter() is false for every row on earth.
    const res = detectListingEvents({
      prevRaw: ['A'],
      lastNotifiedAt: '2026-07-25T00:00:00Z',
      currentMatches: [
        source({ listingKey: 'A', lastPriceChangeDate: '2026-04-18T19:19:27Z', listPrice: 690000 }),
      ],
      departedLookup: [],
      now: NOW,
    })
    expect(res.events).toEqual([])
  })

  it('when it DOES fire it reports oldPrice/direction from those stale columns', () => {
    const res = detectListingEvents({
      prevRaw: ['A'],
      lastNotifiedAt: '2026-01-01T00:00:00Z',
      currentMatches: [
        source({
          listingKey: 'A',
          listPrice: 690000,
          lastPriceChangeDate: '2026-04-18T19:19:27Z',
          // Stale magnitude from a change that predates the subscriber's cursor.
          lastPriceChangeAmount: 25000,
          lastPriceChangePct: 3.5,
        }),
      ],
      departedLookup: [],
      now: NOW,
    })
    const ev = res.events[0]
    expect(ev.type).toBe('price_change')
    // Reported to the client as a price INCREASE from $665,000 — a number with
    // no live source (CLAUDE.md §0) taken from a column the MLS stopped feeding.
    expect(ev.direction).toBe('up')
    expect(ev.oldPrice).toBe(665000)
  })
})

// ── toggles ─────────────────────────────────────────────────────────────────

describe('H3 toggles: normalizeEventToggles against the real stored jsonb', () => {
  it('reads the production events map exactly', () => {
    const stored = {
      new: true,
      sold: false,
      open_house: false,
      price_change: true,
      status_change: true,
      back_on_market: false,
    }
    expect(normalizeEventToggles(stored)).toEqual({
      new: true,
      price_change: true,
      status_change: true,
      back_on_market: false,
      sold: false,
      open_house: false,
    })
  })

  it('null / undefined / garbage fall back to defaults, never to all-false', () => {
    for (const raw of [null, undefined, [], 'x', 3, { new: 'yes' }]) {
      const t = normalizeEventToggles(raw)
      expect(t.new).toBe(true)
      expect(t.price_change).toBe(true)
      expect(t.status_change).toBe(true)
    }
  })

  it('an explicit all-false map silences the alert (by design, not a misread)', () => {
    const t = normalizeEventToggles({
      new: false, price_change: false, status_change: false,
      back_on_market: false, sold: false, open_house: false,
    })
    expect(filterEventsByToggles([{ type: 'new', listingKey: 'A' }], t)).toEqual([])
  })
})

describe('parseNotifiedState hostile inputs', () => {
  it('survives every shape a jsonb column can hold', () => {
    const raw = [
      '220215761',
      { key: '220216002', price: '690000', status: ' Active ', notified_at: '2026-07-25T00:00:00Z' },
      { key: null },
      { price: 1 },
      [],
      0,
      false,
      { key: '  ' },
    ]
    const { entries, hadLegacyState } = parseNotifiedState(raw, '2026-07-25T00:00:00Z')
    expect(hadLegacyState).toBe(true)
    expect([...entries.keys()].sort()).toEqual(['220215761', '220216002'])
    expect(entries.get('220216002')!.price).toBe(690000)
    expect(entries.get('220216002')!.status).toBe('Active')
  })

  it('does not throw on a non-array jsonb value', () => {
    expect(() => parseNotifiedState({ a: 1 }, null)).not.toThrow()
    expect(parseNotifiedState({ a: 1 }, null).entries.size).toBe(0)
  })
})
