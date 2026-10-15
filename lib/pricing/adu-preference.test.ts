import { describe, expect, it, vi } from 'vitest'
import { aduFirst, aduPreferenceSentence, aduPreferenceTrace, isAduSale, ppsfSpread, reviewFallbackPreference, subjectHasAdu } from './adu-preference'

const adu = (n: number) => ({ comps: Array.from({ length: n }, (_, i) => ({ i })) })

describe('subjectHasAdu', () => {
  it('reads the MLS details field first, then the remarks', () => {
    expect(subjectHasAdu({ units: { aduYn: true }, publicRemarks: null })).toBe(true)
    expect(subjectHasAdu({ units: { aduYn: null }, publicRemarks: 'Detached 520 sq ft ADU with its own kitchen.' })).toBe(true)
    expect(subjectHasAdu({ units: { aduYn: false }, publicRemarks: 'Room for an ADU in the back yard.' })).toBe(false)
    expect(subjectHasAdu({ publicRemarks: null })).toBe(false)
  })
  it('isAduSale reads the sale remarks with the same reader', () => {
    expect(isAduSale({ publicRemarks: 'Main home plus a permitted guest house.' })).toBe(true)
    expect(isAduSale({ publicRemarks: 'ADU potential.' })).toBe(false)
    expect(isAduSale({ publicRemarks: null })).toBe(false)
  })
})

describe('aduFirst (Matt 2026-10-14: ADU sales first, five or more set the price, else fall back)', () => {
  it('a subject without an ADU runs the ordinary selection once and records nothing', async () => {
    const calls: boolean[] = []
    const out = await aduFirst({
      subjectAdu: false,
      run: (aduOnly) => {
        calls.push(aduOnly)
        return adu(5)
      },
    })
    expect(calls).toEqual([false])
    expect(out.aduPreference).toBeNull()
    expect(out.result.comps).toHaveLength(5)
  })
  it('five ADU sales set the price and the ordinary run never happens', async () => {
    const calls: boolean[] = []
    const out = await aduFirst({
      subjectAdu: true,
      run: (aduOnly) => {
        calls.push(aduOnly)
        return aduOnly ? adu(5) : adu(9)
      },
    })
    expect(calls).toEqual([true])
    expect(out.result.comps).toHaveLength(5)
    expect(out.aduPreference).toMatchObject({ outcome: 'adu-sales', adu_sales_held: 5, minimum: 5 })
    expect(out.aduPreference?.sentence).toContain('read from closed sales that also have one')
  })
  it('four ADU sales fall back to the ordinary set and the letter says so', async () => {
    const calls: boolean[] = []
    const out = await aduFirst({
      subjectAdu: true,
      run: async (aduOnly) => {
        calls.push(aduOnly)
        return aduOnly ? adu(4) : adu(7)
      },
    })
    expect(calls).toEqual([true, false])
    expect(out.result.comps).toHaveLength(7)
    expect(out.aduPreference).toMatchObject({ outcome: 'fallback', adu_sales_held: 4, minimum: 5 })
    expect(out.aduPreference?.sentence).toContain('Fewer than five closed sales with one were found to set its price')
    expect(out.aduPreference?.sentence).toContain('with and without an ADU')
  })
  it('public sentences carry no count, no digit and no em dash (the printed set can differ after the review)', () => {
    for (const s of [aduPreferenceSentence('adu-sales', 5), aduPreferenceSentence('fallback', 5)]) {
      expect(s).not.toMatch(/\d/)
      expect(s).not.toMatch(/—/)
    }
    expect(aduPreferenceSentence('adu-sales', 5)).not.toContain('Fewer')
  })
  it('a short pass records why it fell back and keeps the first pass trace; the review fallback is its own reason', async () => {
    const out = await aduFirst({
      subjectAdu: true,
      run: (aduOnly) => (aduOnly ? { ...adu(2), trace: ['rung a', 'rung b'] } : { ...adu(6), trace: ['whole pool'] }),
    })
    expect(out.aduPreference).toMatchObject({ outcome: 'fallback', fallback_reason: 'short', first_pass_trace: ['rung a', 'rung b'] })
    const review = reviewFallbackPreference(4)
    expect(review).toMatchObject({ outcome: 'fallback', fallback_reason: 'review', adu_sales_held: 4, minimum: 5 })
    expect(review.sentence).toBe(aduPreferenceSentence('fallback', 5))
    expect(aduPreferenceTrace(review, null)).toContain('held 4 ADU sale(s) after the comparability review')
  })
  it('the trace names the pass, the count and the pool', () => {
    const p = { outcome: 'fallback' as const, adu_sales_held: 2, minimum: 5, sentence: '' }
    expect(aduPreferenceTrace(p, 3)).toContain('Only 2 ADU sale(s) could set the price')
    expect(aduPreferenceTrace(p, 3)).toContain('3 sale(s) in the pool state an ADU')
    expect(aduPreferenceTrace({ ...p, outcome: 'adu-sales', adu_sales_held: 5 }, null)).toContain('they are the set')
  })
})

describe('the tightness rule (Matt 2026-10-14, second call): five ADU sales price the home only when as tight as the ordinary set', () => {
  const set = (ppsf: number[]) => ({ comps: ppsf.map((closePpsf, i) => ({ listingKey: `s${i}`, closePpsf })), trace: ['pass'] })
  const spread = (r: { comps: { closePpsf: number }[] }) => ppsfSpread(r.comps.map((c) => c.closePpsf))

  it('ppsfSpread is the coefficient of variation, null under two values', () => {
    expect(ppsfSpread([400, 400, 400])).toBe(0)
    expect(ppsfSpread([300, 500])).toBe(0.25)
    expect(ppsfSpread([400])).toBeNull()
    expect(ppsfSpread([null, undefined, 0])).toBeNull()
  })

  it('a looser ADU set hands the home to the ordinary set, records both spreads, and the letter says why', async () => {
    const run = vi.fn(async (aduOnly: boolean) => (aduOnly ? set([300, 400, 500, 600, 700]) : set([395, 400, 405, 410, 415])))
    const { result, aduPreference } = await aduFirst({ subjectAdu: true, run, spread, unitRead: true })
    expect(run.mock.calls.map(([a]) => a)).toEqual([true, false])
    expect(result.comps.map((c) => c.closePpsf)).toEqual([395, 400, 405, 410, 415])
    expect(aduPreference).toMatchObject({ outcome: 'fallback', fallback_reason: 'spread', adu_sales_held: 5, adu_spread_cv: 0.2828, ordinary_spread_cv: 0.0175 })
    expect(aduPreference?.sentence).toContain('their prices spread wider than the ordinary set')
    expect(aduPreference?.sentence).toContain('What the unit adds is read on its own')
    expect(aduPreference?.first_pass_trace).toEqual(['pass'])
    expect(aduPreferenceTrace(aduPreference!, 7)).toContain('spreads wider than the ordinary set\'s (CV 0.2828 against 0.0175)')
  })

  it('an ADU set as tight as the ordinary set is the set, and both spreads ride the diagnostics', async () => {
    const run = vi.fn(async (aduOnly: boolean) => (aduOnly ? set([400, 405, 410, 415, 420]) : set([300, 400, 500, 600, 700])))
    const { result, aduPreference } = await aduFirst({ subjectAdu: true, run, spread, unitRead: true })
    expect(run.mock.calls.map(([a]) => a)).toEqual([true, false])
    expect(result.comps).toHaveLength(5)
    expect(aduPreference).toMatchObject({ outcome: 'adu-sales', adu_sales_held: 5, adu_spread_cv: 0.0172, ordinary_spread_cv: 0.2828 })
    expect(aduPreference?.fallback_reason).toBeUndefined()
    expect(aduPreferenceTrace(aduPreference!, null)).toContain('spreads no wider than the ordinary set\'s (CV 0.0172 against 0.2828)')
  })

  it('an ordinary set under five cannot out-tighten the ADU set: the ADU set stays', async () => {
    const run = vi.fn(async (aduOnly: boolean) => (aduOnly ? set([300, 400, 500, 600, 700]) : set([400, 400])))
    const { aduPreference } = await aduFirst({ subjectAdu: true, run, spread, unitRead: true })
    expect(aduPreference).toMatchObject({ outcome: 'adu-sales', adu_spread_cv: 0.2828, ordinary_spread_cv: null })
  })

  it('without a recorded ADU area the spread is not read: a looser ADU set is still the set (review 2026-10-15)', async () => {
    const run = vi.fn(async (aduOnly: boolean) => (aduOnly ? set([300, 400, 500, 600, 700]) : set([395, 400, 405, 410, 415])))
    const { result, aduPreference } = await aduFirst({ subjectAdu: true, run, spread })
    expect(result.comps.map((c) => c.closePpsf)).toEqual([300, 400, 500, 600, 700])
    expect(aduPreference?.outcome).toBe('adu-sales')
    expect(run).toHaveBeenCalledTimes(1)
  })

  it('without the spread callback the first rule holds: five ADU sales are the set and the ordinary run never happens', async () => {
    const run = vi.fn(async (aduOnly: boolean) => (aduOnly ? set([300, 400, 500, 600, 700]) : set([400, 400, 400, 400, 400])))
    const { aduPreference } = await aduFirst({ subjectAdu: true, run })
    expect(run.mock.calls.map(([a]) => a)).toEqual([true])
    expect(aduPreference?.outcome).toBe('adu-sales')
  })

  it('the short and review fallbacks now say the unit is valued on its own, and no sentence carries an em dash or a digit', () => {
    for (const s of [aduPreferenceSentence('fallback', 5, 'short'), aduPreferenceSentence('fallback', 5, 'review'), aduPreferenceSentence('fallback', 5, 'spread'), aduPreferenceSentence('adu-sales', 5)]) {
      expect(s).not.toMatch(/[—–]/)
      expect(s).not.toMatch(/\d/)
    }
    // The unit is read on its own only when its area is on record (review 2026-10-15).
    expect(aduPreferenceSentence('fallback', 5, 'short', true)).toContain('What the unit adds is read on its own')
    expect(reviewFallbackPreference(4, 5, true).sentence).toContain('What the unit adds is read on its own')
    expect(aduPreferenceSentence('fallback', 5, 'short')).not.toContain('read on its own')
    expect(aduPreferenceSentence('fallback', 5, 'spread')).not.toContain('read on its own')
    expect(reviewFallbackPreference(4).sentence).not.toContain('read on its own')
  })
})
