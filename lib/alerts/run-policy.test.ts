import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ALERT_MATCH_WINDOW,
  FIRST_SEND_BATCH,
  NEW_LISTING_LOOKBACK_MS,
  alertMatchWindow,
  alertSendStamp,
  gateNewListingEvents,
} from './run-policy'

/** lib/alerts/send.ts is server-only, so its card cap is read from source. */
const MAX_LISTINGS_PER_EMAIL_FOR_TEST = Number(
  /export const MAX_LISTINGS_PER_EMAIL = (\d+)/.exec(readFileSync(resolve('lib/alerts/send.ts'), 'utf8'))?.[1],
)

describe('alertMatchWindow', () => {
  it('reads more listings the longer the gap between sends', () => {
    expect(alertMatchWindow('instant')).toBe(30)
    expect(alertMatchWindow('daily')).toBe(60)
    expect(alertMatchWindow('weekly')).toBe(100)
    expect(alertMatchWindow('monthly')).toBe(100)
  })

  it('covers the busiest Bend day measured (30 new listings, all types) on the daily cadence', () => {
    // listings, City 'Bend', OnMarketDate 2026-08-15..2026-10-14: max 30 a day.
    expect(alertMatchWindow('daily')).toBeGreaterThanOrEqual(30)
  })

  it('falls back to the daily window for an unknown or missing frequency', () => {
    expect(alertMatchWindow(null)).toBe(ALERT_MATCH_WINDOW.daily)
    expect(alertMatchWindow('hourly')).toBe(ALERT_MATCH_WINDOW.daily)
    expect(alertMatchWindow(' Weekly ')).toBe(100)
  })

  it('never asks the cached search for more than one page of 100', () => {
    for (const n of Object.values(ALERT_MATCH_WINDOW)) expect(n).toBeLessThanOrEqual(100)
  })
})

describe('alertSendStamp', () => {
  it('gives two sends on one UTC day different keys', () => {
    const a = alertSendStamp(new Date('2026-10-14T06:30:10Z'))
    const b = alertSendStamp(new Date('2026-10-14T14:00:05Z'))
    expect(a).toBe('2026-10-14T0630Z')
    expect(b).toBe('2026-10-14T1400Z')
    expect(a).not.toBe(b)
  })

  it('has no colon, so email_key.split(":")[1] stays the alert row id', () => {
    const key = `listing-alert:3f1c2a7e-0000-4000-8000-000000000000:${alertSendStamp(new Date())}`
    expect(key.split(':')[1]).toBe('3f1c2a7e-0000-4000-8000-000000000000')
    expect(key.split(':')).toHaveLength(3)
  })
})

describe('gateNewListingEvents: the first email', () => {
  const window = Array.from({ length: 60 }, (_, i) => ({ type: 'new', listingKey: `L${i}` }))

  it('carries the newest FIRST_SEND_BATCH listings and no more', () => {
    const out = gateNewListingEvents({ events: window, firstSend: true, lastNotifiedAt: null, onMarketByKey: new Map() })
    expect(out).toHaveLength(FIRST_SEND_BATCH)
    expect(out.map((e) => e.listingKey)).toEqual(window.slice(0, FIRST_SEND_BATCH).map((e) => e.listingKey))
  })

  it('is one email of cards', () => {
    expect(FIRST_SEND_BATCH).toBe(MAX_LISTINGS_PER_EMAIL_FOR_TEST)
  })

  it('keeps a small area whole', () => {
    const three = window.slice(0, 3)
    expect(gateNewListingEvents({ events: three, firstSend: true, lastNotifiedAt: null, onMarketByKey: new Map() })).toHaveLength(3)
  })
})

describe('gateNewListingEvents: after the first email', () => {
  const last = '2026-10-14T14:00:00Z'
  const day = 24 * 60 * 60 * 1000
  const iso = (msBeforeLast: number) => new Date(Date.parse(last) - msBeforeLast).toISOString()

  it('a listing that came on the market since the last send fires', () => {
    const onMarketByKey = new Map([['A', '2026-10-14']])
    const out = gateNewListingEvents({ events: [{ type: 'new', listingKey: 'A' }], firstSend: false, lastNotifiedAt: last, onMarketByKey })
    expect(out).toHaveLength(1)
  })

  it('a listing that landed in the feed late, within the lookback, still fires', () => {
    const onMarketByKey = new Map([['A', iso(3 * day)]])
    const out = gateNewListingEvents({ events: [{ type: 'new', listingKey: 'A' }], firstSend: false, lastNotifiedAt: last, onMarketByKey })
    expect(out).toHaveLength(1)
  })

  it('an old listing that only entered a widened window is absorbed, not announced', () => {
    const onMarketByKey = new Map([['OLD', iso(NEW_LISTING_LOOKBACK_MS + day)]])
    const out = gateNewListingEvents({ events: [{ type: 'new', listingKey: 'OLD' }], firstSend: false, lastNotifiedAt: last, onMarketByKey })
    expect(out).toHaveLength(0)
  })

  it('a listing with no on-market stamp fires: a missing column never hides a listing', () => {
    const out = gateNewListingEvents({ events: [{ type: 'new', listingKey: 'X' }], firstSend: false, lastNotifiedAt: last, onMarketByKey: new Map([['X', null]]) })
    expect(out).toHaveLength(1)
  })

  it('never touches price, status or open-house events', () => {
    const events = [
      { type: 'price_change', listingKey: 'OLD' },
      { type: 'status_change', listingKey: 'OLD' },
      { type: 'open_house', listingKey: 'OLD' },
    ]
    const onMarketByKey = new Map([['OLD', iso(90 * day)]])
    expect(gateNewListingEvents({ events, firstSend: false, lastNotifiedAt: last, onMarketByKey })).toEqual(events)
  })

  it('an unparseable last-send stamp gates nothing', () => {
    const events = [{ type: 'new', listingKey: 'OLD' }]
    const onMarketByKey = new Map([['OLD', '2020-01-01']])
    expect(gateNewListingEvents({ events, firstSend: false, lastNotifiedAt: 'not-a-date', onMarketByKey })).toHaveLength(1)
  })
})
