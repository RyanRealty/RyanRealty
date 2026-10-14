import { describe, expect, it, vi } from 'vitest'
import { multiUnitSentence, multiUnitTrace, reviewFallbackMultiUnit, unitsFirst } from '@/lib/pricing/multi-unit-preference'

/**
 * A MULTI-UNIT HOME PRICES FROM SALES OF THE SAME KIND (Matt 2026-10-14): the
 * same-units pass, the class fallback, the no-count run, the review fallback
 * and the one sentence the letter prints.
 */
const set = (n: number, label: string) => ({ comps: Array.from({ length: n }, (_, i) => `${label}-${i}`), trace: [`${label} pass`] })

describe('unitsFirst', () => {
  it('five duplex sales on the same-units pass are the set', async () => {
    const run = vi.fn(async (sameUnitsOnly: boolean) => (sameUnitsOnly ? set(5, 'duplex') : set(9, 'class')))
    const { result, preference } = await unitsFirst({ propertySubType: 'Duplex', units: 2, run })
    expect(run.mock.calls.map(([only]) => only)).toEqual([true])
    expect(result.comps).toHaveLength(5)
    expect(preference).toMatchObject({ outcome: 'same-units', units: 2, noun: 'duplex', same_unit_sales_held: 5, minimum: 5 })
    expect(preference.fallback_reason).toBeUndefined()
    expect(preference.sentence).toBe('This home is a duplex, so its price is read from closed duplex sales only. No single-family sale sets it.')
  })

  it('under five, the whole 2-4 unit class prices the home and the first pass is kept on the trace', async () => {
    const run = vi.fn(async (sameUnitsOnly: boolean) => (sameUnitsOnly ? set(3, 'triplex') : set(6, 'class')))
    const { result, preference } = await unitsFirst({ propertySubType: 'Triplex', units: 3, run })
    expect(run.mock.calls.map(([only]) => only)).toEqual([true, false])
    expect(result.comps).toHaveLength(6)
    expect(preference).toMatchObject({ outcome: 'class', fallback_reason: 'short', units: 3, noun: 'triplex', same_unit_sales_held: 3 })
    expect(preference.first_pass_trace).toEqual(['triplex pass'])
    expect(preference.sentence).toBe(
      'This home is a triplex. Fewer than five closed triplexes were found to set its price, so the price is read from closed sales of two- to four-unit buildings. No single-family sale sets it.',
    )
  })

  it('with no unit count on record the class run is the only one', async () => {
    const run = vi.fn(async () => set(7, 'class'))
    const { preference } = await unitsFirst({ propertySubType: 'Multi Family', units: null, run })
    expect(run.mock.calls.map(([only]) => only)).toEqual([false])
    expect(preference).toMatchObject({ outcome: 'class', fallback_reason: 'no-count', units: null, noun: 'multi-unit home', same_unit_sales_held: 0 })
    expect(preference.sentence).toBe(
      'This home is a multi-unit building, so its price is read from closed sales of two- to four-unit buildings only. No single-family sale sets it.',
    )
  })

  it('the minimum is the one five-sale floor', async () => {
    const run = vi.fn(async (sameUnitsOnly: boolean) => (sameUnitsOnly ? set(4, 'fourplex') : set(5, 'class')))
    const { preference } = await unitsFirst({ propertySubType: 'Quadruplex', units: 4, run })
    expect(preference.outcome).toBe('class')
    expect(preference.noun).toBe('fourplex')
    expect(preference.minimum).toBe(5)
  })
})

describe('reviewFallbackMultiUnit and the trace', () => {
  it('stamps the review fallback a build re-enters on', () => {
    const p = reviewFallbackMultiUnit({ propertySubType: 'Duplex', units: 2, heldAfterReview: 4 })
    expect(p).toMatchObject({ outcome: 'class', fallback_reason: 'review', units: 2, noun: 'duplex', same_unit_sales_held: 4, minimum: 5 })
    expect(p.sentence).toBe(multiUnitSentence({ outcome: 'class', noun: 'duplex', minimum: 5, fallback_reason: 'review' }))
    expect(multiUnitTrace(p)).toContain('held 4 duplexes after the comparability review, under the 5 the rule needs')
  })

  it('names the pass on every trace line', () => {
    const same = multiUnitTrace({ outcome: 'same-units', units: 2, noun: 'duplex', same_unit_sales_held: 6, minimum: 5, sentence: '' })
    expect(same).toContain('Multi-unit home (duplex, 2 units): priced on the multi-unit ladder over PropertyType C closes')
    expect(same).toContain('6 closed duplexes set the price, at or above the 5 the rule needs')
    const short = multiUnitTrace({ outcome: 'class', fallback_reason: 'short', units: 3, noun: 'triplex', same_unit_sales_held: 2, minimum: 5, sentence: '' })
    expect(short).toContain('Only 2 closed triplexes could set the price, under the 5 the rule needs, so every two- to four-unit sale prices the home')
    const none = multiUnitTrace({ outcome: 'class', fallback_reason: 'no-count', units: null, noun: 'multi-unit home', same_unit_sales_held: 0, minimum: 5, sentence: '' })
    expect(none).toContain('No record states its unit count, so every two- to four-unit sale is admitted')
  })

  it('no sentence carries an em dash', () => {
    for (const s of [
      multiUnitSentence({ outcome: 'same-units', noun: 'duplex', minimum: 5 }),
      multiUnitSentence({ outcome: 'class', noun: 'fourplex', minimum: 5, fallback_reason: 'short' }),
      multiUnitSentence({ outcome: 'class', noun: 'multi-unit home', minimum: 5, fallback_reason: 'no-count' }),
    ]) {
      expect(s).not.toMatch(/[—–]/)
    }
  })
})
