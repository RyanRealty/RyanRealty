/**
 * The final listing period as a timeline (chapter 1's graphic).
 *
 * The behaviors the compiler cannot prove: which price events belong to THIS
 * cycle, that the opening ask is the line's start rather than a step, that a
 * cycle with no dated change gets an UNDATED step instead of a made-up date,
 * and that `days` is the one span the rest of the document already prints.
 */

import { describe, it, expect } from 'vitest'
import { buildFinalCycle, finalCycleDaysOnMarket } from './expired-audit'
import type { BpoListingCycle } from '@/lib/bpo/types'

/** 2465 SW 7th, Redmond — MLS 220216004, the document this blueprint came from. */
const SUBJECT_CYCLE: BpoListingCycle = {
  listingKey: '20260226230209330221000000',
  mlsNumber: '220216004',
  status: 'Withdrawn',
  listAgentName: null,
  listOfficeName: null,
  listDate: '2026-02-26T23:27:57+00:00',
  offMarketDate: '2026-09-01',
  originalListPrice: 475_000,
  finalListPrice: 460_000,
  closePrice: null,
  daysOnMarket: 192,
  priceCutCount: 1,
  totalPriceChangeAmt: -15_000,
  wasRelisted: false,
  outcome: 'withdrawn',
}

describe('buildFinalCycle', () => {
  it('is null without a cycle', () => {
    expect(buildFinalCycle({ cycle: null })).toBeNull()
  })

  it('draws the subject: $475,000 on Feb 26, cut to $460,000, off Sep 1, 187 days', () => {
    const fc = buildFinalCycle({
      cycle: SUBJECT_CYCLE,
      priceEvents: [{ date: '2026-07-28', ask: 460_000 }],
    })!
    expect(fc.listDate).toBe('2026-02-26')
    expect(fc.initialAsk).toBe(475_000)
    expect(fc.cuts).toEqual([{ date: '2026-07-28', ask: 460_000 }])
    expect(fc.cutsDated).toBe(true)
    expect(fc.finalAsk).toBe(460_000)
    expect(fc.offMarketDate).toBe('2026-09-01')
    expect(fc.status).toBe('Withdrawn')
    expect(fc.days).toBe(187)
  })

  it('reports the same days the rest of the document prints', () => {
    expect(buildFinalCycle({ cycle: SUBJECT_CYCLE })!.days).toBe(finalCycleDaysOnMarket(SUBJECT_CYCLE))
  })

  it('falls back to one UNDATED step when no dated change is recorded', () => {
    const fc = buildFinalCycle({ cycle: SUBJECT_CYCLE, priceEvents: [] })!
    expect(fc.cutsDated).toBe(false)
    expect(fc.cuts).toEqual([{ date: null, ask: 460_000 }])
  })

  it('draws one flat line when the ask never moved', () => {
    const fc = buildFinalCycle({
      cycle: { ...SUBJECT_CYCLE, originalListPrice: 460_000, finalListPrice: 460_000 },
      priceEvents: [],
    })!
    expect(fc.cuts).toEqual([])
    expect(fc.cutsDated).toBe(false)
  })

  it('drops events from a prior attempt at the same address', () => {
    const fc = buildFinalCycle({
      cycle: SUBJECT_CYCLE,
      priceEvents: [
        { date: '2016-04-22', ask: 234_000 },
        { date: '2026-07-28', ask: 460_000 },
      ],
    })!
    expect(fc.cuts).toEqual([{ date: '2026-07-28', ask: 460_000 }])
  })

  it('drops an edit made after the listing came off the market', () => {
    const fc = buildFinalCycle({
      cycle: SUBJECT_CYCLE,
      priceEvents: [
        { date: '2026-07-28', ask: 460_000 },
        { date: '2026-09-20', ask: 440_000 },
      ],
    })!
    expect(fc.cuts).toEqual([{ date: '2026-07-28', ask: 460_000 }])
  })

  it('does not make the opening ask a step in its own line', () => {
    const fc = buildFinalCycle({
      cycle: SUBJECT_CYCLE,
      priceEvents: [
        { date: '2026-02-26', ask: 475_000 },
        { date: '2026-07-28', ask: 460_000 },
      ],
    })!
    expect(fc.cuts).toEqual([{ date: '2026-07-28', ask: 460_000 }])
  })

  it('orders the steps and records each once when both writers logged it', () => {
    const fc = buildFinalCycle({
      cycle: SUBJECT_CYCLE,
      priceEvents: [
        { date: '2026-08-15', ask: 460_000 },
        { date: '2026-07-28', ask: 468_000 },
        { date: '2026-08-15', ask: 460_000 },
      ],
    })!
    expect(fc.cuts).toEqual([
      { date: '2026-07-28', ask: 468_000 },
      { date: '2026-08-15', ask: 460_000 },
    ])
  })

  it('records a raised ask honestly rather than hiding it', () => {
    const fc = buildFinalCycle({
      cycle: { ...SUBJECT_CYCLE, originalListPrice: 450_000, finalListPrice: 470_000 },
      priceEvents: [{ date: '2026-05-01', ask: 470_000 }],
    })!
    expect(fc.cuts).toEqual([{ date: '2026-05-01', ask: 470_000 }])
  })

  it('carries a source naming the listing and how the step dates were resolved', () => {
    const dated = buildFinalCycle({
      cycle: SUBJECT_CYCLE,
      priceEvents: [{ date: '2026-07-28', ask: 460_000 }],
      fetchedAt: '2026-09-07T12:00:00.000Z',
    })!
    expect(dated.source.filter).toContain('20260226230209330221000000')
    expect(dated.source.filter).toContain('1 dated ask change')
    expect(dated.source.fetchedAt).toBe('2026-09-07T12:00:00.000Z')
    expect(dated.source.query).toContain('price_history')
    expect(dated.source.query).toContain('listing_history')

    const undated = buildFinalCycle({ cycle: SUBJECT_CYCLE, priceEvents: [] })!
    expect(undated.source.filter).toContain('No dated ask change is recorded')
  })

  it('uses the final ask as the opening one when the original is missing', () => {
    const fc = buildFinalCycle({ cycle: { ...SUBJECT_CYCLE, originalListPrice: null } })!
    expect(fc.initialAsk).toBe(460_000)
    expect(fc.cuts).toEqual([])
  })
})
