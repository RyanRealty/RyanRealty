import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * G-NL-12 proof: getBrokerNewsletterAnalytics('rebecca') must filter EVERY
 * query by broker='rebecca' on both newsletter_recipients and
 * newsletter_recipient_events — it must never be able to return matt's rows.
 * Mocks the supabase client and asserts the .eq('broker', ...) calls.
 */

type EqCall = [string, unknown]

function makeQueryBuilder(result: unknown) {
  const eqCalls: EqCall[] = []
  const builder: Record<string, unknown> = {}
  builder.select = vi.fn(() => builder)
  builder.eq = vi.fn((col: string, val: unknown) => {
    eqCalls.push([col, val])
    return builder
  })
  builder.in = vi.fn(() => builder)
  builder.order = vi.fn(() => builder)
  builder.limit = vi.fn(() => Promise.resolve(result))
  // Some call chains resolve directly off the builder (head:true counts end
  // in .eq(...) with no further chain call) — make the builder itself
  // thenable so `await sb.from(...).select(...).eq(...).eq(...)` resolves.
  builder.then = (resolve: (v: unknown) => void) => resolve(result)
  return { builder, eqCalls }
}

const fromImpl = vi.fn()
vi.mock('@/lib/data/client', () => ({
  createServiceClient: () => ({ from: fromImpl }),
}))

import { getBrokerNewsletterAnalytics, getBrokerWarmList } from './brokerAnalytics'

describe('getBrokerNewsletterAnalytics — G-NL-12 scope proof', () => {
  beforeEach(() => {
    fromImpl.mockReset()
  })

  it('filters newsletter_recipients AND newsletter_recipient_events by the broker param', async () => {
    // Accumulate .eq() calls PER TABLE across every from(table) invocation —
    // newsletter_recipient_events is queried twice (open-count, click-count),
    // each producing its own builder/eqCalls array, so we collect the live
    // arrays (not a spread snapshot taken before the calls happen) and flatten
    // at assertion time.
    const eqCallsPerTable: Record<string, EqCall[][]> = {}

    fromImpl.mockImplementation((table: string) => {
      const result = table === 'newsletter_recipients'
        ? { data: [{ status: 'sent' }, { status: 'opened' }], error: null }
        : { count: 3, error: null }
      const { builder, eqCalls } = makeQueryBuilder(result)
      eqCallsPerTable[table] = eqCallsPerTable[table] ?? []
      eqCallsPerTable[table].push(eqCalls)
      return builder
    })

    const result = await getBrokerNewsletterAnalytics('rebecca')

    const flat = (table: string) => eqCallsPerTable[table]?.flat() ?? []

    // newsletter_recipients was scoped by broker='rebecca'
    expect(flat('newsletter_recipients')).toContainEqual(['broker', 'rebecca'])
    // newsletter_recipient_events was scoped by broker='rebecca' on BOTH the
    // open-count and click-count reads (two .eq('broker', ...) calls minimum).
    const eventBrokerCalls = flat('newsletter_recipient_events').filter(([col, val]) => col === 'broker' && val === 'rebecca')
    expect(eventBrokerCalls.length).toBeGreaterThanOrEqual(2)

    // Never queried with matt's slug anywhere.
    const allCalls = [...flat('newsletter_recipients'), ...flat('newsletter_recipient_events')]
    expect(allCalls.some(([col, val]) => col === 'broker' && val === 'matt')).toBe(false)

    expect(result.recipients).toBe(2)
  })

  it('returns a zeroed result for an empty/invalid broker slug without querying', async () => {
    const result = await getBrokerNewsletterAnalytics('')
    expect(result).toEqual({ recipients: 0, delivered: 0, opened: 0, clicked: 0, ctr: 0, ctor: 0 })
    expect(fromImpl).not.toHaveBeenCalled()
  })
})

describe('getBrokerWarmList — G-NL-12 scope proof', () => {
  beforeEach(() => {
    fromImpl.mockReset()
  })

  it('filters newsletter_recipient_events click reads by the broker param', async () => {
    let eventsEqCalls: EqCall[] = []
    fromImpl.mockImplementation((table: string) => {
      if (table === 'newsletter_recipient_events') {
        const { builder, eqCalls } = makeQueryBuilder({
          data: [{ email: 'lead@example.com', subscriber_id: null, occurred_at: '2026-07-01T00:00:00Z' }],
          error: null,
        })
        eventsEqCalls = eqCalls
        return builder
      }
      const { builder } = makeQueryBuilder({ data: [], error: null })
      return builder
    })

    const rows = await getBrokerWarmList('rebecca', 10)

    expect(eventsEqCalls).toContainEqual(['broker', 'rebecca'])
    expect(eventsEqCalls).toContainEqual(['event', 'click'])
    expect(eventsEqCalls.some(([col, val]) => col === 'broker' && val === 'matt')).toBe(false)
    expect(rows).toEqual([{ email: 'lead@example.com', personId: null, clicks: 1, lastAt: '2026-07-01T00:00:00Z' }])
  })

  it('returns [] for an empty broker slug without querying', async () => {
    const rows = await getBrokerWarmList('')
    expect(rows).toEqual([])
    expect(fromImpl).not.toHaveBeenCalled()
  })
})
