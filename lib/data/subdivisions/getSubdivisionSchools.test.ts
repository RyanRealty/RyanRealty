/**
 * Unit test for applySchoolThreshold (W2.4 schools leg) — the pure §0 honesty
 * gate between the modal-aggregate RPC and the page. Pins the properties the
 * live data demanded:
 *   - a clear majority (>=70% of >=10) is claimed
 *   - a MIXED assignment is omitted, never guessed (Rivers Edge Village
 *     elementary splits 691/1164 = 59.4% across a boundary — real case)
 *   - a thin sample (<10) is omitted even at 100% agreement
 *   - masked/junk MLS values ("********") are dropped (real case: district
 *     fields, n<=6)
 */
import { describe, expect, it } from 'vitest'
import { applySchoolThreshold, SCHOOL_MIN_AGREEMENT, SCHOOL_MIN_SAMPLES } from './getSubdivisionSchools'

describe('applySchoolThreshold (W2.4)', () => {
  it('claims a clear majority and orders levels for display', () => {
    const out = applySchoolThreshold([
      { level: 'high', modal_name: 'Summit High', modal_n: 2646, total_n: 2652 },
      { level: 'elementary', modal_name: 'High Lakes Elem', modal_n: 2333, total_n: 2642 },
    ])
    expect(out.map((s) => s.level)).toEqual(['elementary', 'high'])
    expect(out[0].name).toBe('High Lakes Elem')
    expect(out[0].modalCount).toBe(2333)
    expect(out[0].totalCount).toBe(2642)
  })

  it('omits a mixed assignment (the real Rivers Edge Village elementary split)', () => {
    const out = applySchoolThreshold([
      { level: 'elementary', modal_name: 'High Lakes Elem', modal_n: 691, total_n: 1164 }, // 59.4%
    ])
    expect(out).toEqual([])
  })

  it('omits a thin sample even at full agreement', () => {
    const out = applySchoolThreshold([
      { level: 'middle', modal_name: 'Tiny School', modal_n: SCHOOL_MIN_SAMPLES - 1, total_n: SCHOOL_MIN_SAMPLES - 1 },
    ])
    expect(out).toEqual([])
  })

  it('drops masked/junk MLS values (the real "********" district rows)', () => {
    const out = applySchoolThreshold([
      { level: 'district', modal_name: '********', modal_n: 20, total_n: 20 },
    ])
    expect(out).toEqual([])
  })

  it('claims exactly at the boundary (70% of 10)', () => {
    const out = applySchoolThreshold([
      { level: 'high', modal_name: 'Edge High', modal_n: Math.ceil(SCHOOL_MIN_SAMPLES * SCHOOL_MIN_AGREEMENT), total_n: SCHOOL_MIN_SAMPLES },
    ])
    expect(out.length).toBe(1)
  })
})
