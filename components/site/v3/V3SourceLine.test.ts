/**
 * v3SourceParts — the fold. §0 is absolute, so the one rule under every case
 * here is that the caller's trace comes back verbatim in `trace`: the visible
 * form changes, the record does not.
 *
 * The real traces below are copied from the routes SITE-42 was opened for.
 */
import { describe, expect, it } from 'vitest'
import { splitSourceStamp, sourceNameFromTrace, v3SourceParts } from './V3SourceLine'

const DROPS =
  'live MLS through Oregon Data Share, asking-price cuts on active single-family homes in ' +
  'Central Oregon in the last 7 days. Median drop 5.7%, $3.7M in asking prices cut this week ' +
  '· updated Sep 9, 2026'

const BEND =
  'Oregon Data Share via MarketPulse, active single-family houses in Bend. Months of supply = ' +
  'active listings divided by average monthly closings over the last 6 months (homes closed in ' +
  'the last 6 months divided by 6). 4 months of supply or less is a seller’s market.'

const PLAT =
  'live MLS through Oregon Data Share, active single-family listings under the Ridge at Eagle ' +
  'Crest name in Redmond.'

describe('splitSourceStamp', () => {
  it('lifts the canonical " · updated <stamp>" clause off the end', () => {
    expect(splitSourceStamp('live MLS, Bend · updated Sep 9, 2026')).toEqual({
      body: 'live MLS, Bend',
      stamp: 'Sep 9, 2026',
    })
  })

  it('leaves a trace that carries no stamp alone', () => {
    expect(splitSourceStamp(PLAT)).toEqual({ body: PLAT, stamp: null })
  })

  it('does not mistake a middot inside the trace for the stamp clause', () => {
    const t = 'live MLS · Oregon Data Share, active listings'
    expect(splitSourceStamp(t)).toEqual({ body: t, stamp: null })
  })
})

describe('sourceNameFromTrace', () => {
  it('takes the leading segment up to the first comma — the shape every trace here is written in', () => {
    expect(sourceNameFromTrace(BEND)).toBe('Oregon Data Share via MarketPulse')
    expect(sourceNameFromTrace(PLAT)).toBe('live MLS through Oregon Data Share')
  })

  it('takes the first sentence when it is shorter than the pre-comma segment', () => {
    // platStatsTrace's real shape: the first comma is 76 characters in, the
    // first period 156. The comma still wins because it is the shorter of the
    // two — the rule is shortest, not comma-first.
    const stats =
      'live MLS through Oregon Data Share through the subdivision statistics cache, closed ' +
      'single-family sales in Ridge at Eagle Crest, Redmond, year to date. Days on market only.'
    expect(sourceNameFromTrace(stats)).toBe(
      'live MLS through Oregon Data Share through the subdivision statistics cache',
    )
    // And the other direction: a short first sentence beats a late comma.
    const late =
      'Deschutes County recorded plats. Clipped and simplified in the RPC, refreshed nightly.'
    expect(sourceNameFromTrace(late)).toBe('Deschutes County recorded plats')
  })

  it('falls back to the first sentence when there is no comma at all', () => {
    expect(sourceNameFromTrace('Deschutes County recorded plats. Nightly delta.')).toBe(
      'Deschutes County recorded plats',
    )
  })

  it('keeps every real trace on the four SITE-42 routes under a clause length', () => {
    for (const t of [DROPS, BEND, PLAT]) {
      expect(sourceNameFromTrace(t).length).toBeLessThanOrEqual(80)
    }
  })
})

describe('v3SourceParts', () => {
  it('folds a real trace to a name and a date, and keeps the trace verbatim', () => {
    const parts = v3SourceParts({ source: DROPS })
    expect(parts.name).toBe('live MLS through Oregon Data Share')
    expect(parts.stamp).toBe('Sep 9, 2026')
    expect(parts.trace).toBe(DROPS)
  })

  it('prefers the caller’s own name and date over anything derived', () => {
    const parts = v3SourceParts({
      source: DROPS,
      sourceName: 'Oregon Data Share',
      asOf: '2026-09-01T00:00:00.000Z',
    })
    expect(parts.name).toBe('Oregon Data Share')
    expect(parts.stamp).not.toBe('Sep 9, 2026')
    expect(parts.trace).toBe(DROPS)
  })

  it('appends an updatedAt the trace did not already carry, so nothing the atom used to print is lost', () => {
    const parts = v3SourceParts({ source: PLAT, updatedAt: '2026-09-09T12:00:00.000Z' })
    expect(parts.trace.startsWith(PLAT)).toBe(true)
    expect(parts.trace).toContain(' · updated ')
    expect(parts.stamp).not.toBeNull()
  })

  it('prints no date rather than inventing one (§0)', () => {
    const parts = v3SourceParts({ source: PLAT })
    expect(parts.stamp).toBeNull()
    expect(parts.trace).toBe(PLAT)
  })

  it('never returns an empty name', () => {
    expect(v3SourceParts({ source: 'MLS' }).name).toBe('MLS')
    expect(v3SourceParts({ source: DROPS, sourceName: '   ' }).name).toBe(
      'live MLS through Oregon Data Share',
    )
  })
})
