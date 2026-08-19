import { describe, expect, it } from 'vitest'
import { ACTIVITY_EVENT_DISPLAY, activityEventDisplay, activityEventLabel } from './event-label'

/**
 * The ten `event_type` values present in `public.activity_events` on
 * 2026-08-18 05:20Z, with their row counts. Four of them (marked) had no
 * label in any consumer and printed the raw column value to visitors —
 * `/activity` shipped "status_canceled · Bend · Stonegate".
 */
const LIVE_EVENT_TYPES = [
  { type: 'price_drop', rows: 10_660, label: 'Price cut' },
  { type: 'new_listing', rows: 10_172, label: 'New' },
  { type: 'status_pending', rows: 6_028, label: 'Pending' },
  { type: 'status_closed', rows: 4_996, label: 'Sold' },
  { type: 'status_expired', rows: 1_199, label: 'Off market' },
  { type: 'status_canceled', rows: 1_067, label: 'Off market' }, // was leaking
  { type: 'status_withdrawn', rows: 546, label: 'Off market' }, // was leaking
  { type: 'price_increase', rows: 369, label: 'Price increase' }, // was leaking
  { type: 'status_active', rows: 230, label: 'Back on market' }, // was leaking
  { type: 'back_on_market', rows: 2, label: 'Back on market' },
] as const

describe('activityEventLabel', () => {
  it.each(LIVE_EVENT_TYPES)('labels $type ($rows rows) as "$label"', ({ type, label }) => {
    expect(activityEventLabel(type)).toBe(label)
  })

  it('never returns the raw event_type for any live value', () => {
    for (const { type } of LIVE_EVENT_TYPES) {
      expect(activityEventLabel(type)).not.toBe(type)
    }
  })

  it('resolves an unseen terminal status to the public off-market label', () => {
    // deltaSync writes `status_${StandardStatus}` for every terminal, non-closed
    // transition, so a new RESO status must not need a code change to be safe.
    expect(activityEventLabel('status_hold')).toBe('Off market')
    expect(activityEventLabel('status_temp_off_market')).toBe('Off market')
  })

  it('never prints an internal identifier for an unknown non-status event', () => {
    for (const input of ['sold_by_us', 'weird_new_type', 'x']) {
      expect(activityEventLabel(input)).toBe('Listing update')
    }
  })

  it('never surfaces broker prospecting vocabulary to the public', () => {
    // lib/listing-status-public.ts: expired / withdrawn / canceled are
    // "broker prospecting vocabulary — never a public browse mode".
    for (const type of ['status_expired', 'status_canceled', 'status_withdrawn']) {
      const label = activityEventLabel(type).toLowerCase()
      expect(label).not.toMatch(/expired|canceled|cancelled|withdrawn/)
    }
  })

  it('handles null, undefined, blank, and mixed casing', () => {
    expect(activityEventLabel(null)).toBe('Listing update')
    expect(activityEventLabel(undefined)).toBe('Listing update')
    expect(activityEventLabel('   ')).toBe('Listing update')
    expect(activityEventLabel(' Price_Drop ')).toBe('Price cut')
  })

  it('never returns an empty label', () => {
    for (const input of [null, undefined, '', 'anything', 'status_x', ...LIVE_EVENT_TYPES.map((e) => e.type)]) {
      expect(activityEventLabel(input).trim().length).toBeGreaterThan(0)
    }
  })
})

describe('activityEventDisplay', () => {
  it('pairs a closed-set styling kind with every label', () => {
    const KINDS = ['new', 'price_drop', 'price_increase', 'pending', 'sold', 'expired', 'update']
    for (const { type } of LIVE_EVENT_TYPES) {
      expect(KINDS).toContain(activityEventDisplay(type).kind)
    }
    // The open tail resolves into the same closed set, never a passthrough.
    for (const type of ['status_hold', 'brand_new_event', '', null]) {
      expect(KINDS).toContain(activityEventDisplay(type).kind)
    }
  })

  it('keeps new_listing on the "New" label the staleness relabel keys off', () => {
    // lib/kb/place-sections.ts flips a stale "New" tag to "Listed" by label match.
    expect(activityEventDisplay('new_listing').label).toBe('New')
  })

  it('exposes a frozen map so a consumer cannot mutate the vocabulary', () => {
    expect(Object.isFrozen(ACTIVITY_EVENT_DISPLAY)).toBe(true)
  })
})
