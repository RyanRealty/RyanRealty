import { describe, expect, it } from 'vitest'
import { aduFirst, aduPreferenceSentence, aduPreferenceTrace, isAduSale, reviewFallbackPreference, subjectHasAdu } from './adu-preference'

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
