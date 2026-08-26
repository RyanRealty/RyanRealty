import { describe, expect, it } from 'vitest'
import { parseGBPTimeSeries, type GBPPerformanceApiResponse } from './google-business-profile'

const day = (d: number, value?: string) => ({
  date: { year: 2026, month: 8, day: d },
  ...(value === undefined ? {} : { value }),
})

describe('parseGBPTimeSeries — a day Google has not computed is absent, never 0', () => {
  // THE DEFECT. Google's daily metrics land about five days late, and an
  // uncomputed day comes back as a dated entry with NO `value` field. The old
  // parse read `dv.value ?? '0'`, so it wrote 0. The daily cron only ever asked
  // for yesterday — always inside the lag — so EVERY GBP row it wrote was a
  // fabricated zero, 1,602 of them, while the API held real numbers for the
  // same dates. Nine metrics reported "healthy, zero" for thirty days straight.
  it('keeps a real measurement', () => {
    const json: GBPPerformanceApiResponse = {
      timeSeries: { datedValues: [day(10, '3'), day(11, '4'), day(12, '11')] },
    }
    const pts = parseGBPTimeSeries(json, 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH')
    expect(pts.map((p) => p.value)).toEqual([3, 4, 11])
    expect(pts[0].date).toBe('2026-08-10')
  })

  it('DROPS a day with no value rather than writing 0', () => {
    const json: GBPPerformanceApiResponse = {
      timeSeries: { datedValues: [day(20, '4'), day(21, '6'), day(22), day(23), day(24)] },
    }
    const pts = parseGBPTimeSeries(json, 'CALL_CLICKS')
    expect(pts.map((p) => p.date)).toEqual(['2026-08-20', '2026-08-21'])
    expect(pts.some((p) => p.value === 0)).toBe(false)
  })

  it('keeps a genuine zero — Google saying "0" is a measurement', () => {
    const json: GBPPerformanceApiResponse = { timeSeries: { datedValues: [day(20, '0')] } }
    const pts = parseGBPTimeSeries(json, 'BUSINESS_BOOKINGS')
    expect(pts).toHaveLength(1)
    expect(pts[0].value).toBe(0)
  })

  it('drops an empty string, which is not a measurement either', () => {
    const json: GBPPerformanceApiResponse = { timeSeries: { datedValues: [day(20, '')] } }
    expect(parseGBPTimeSeries(json, 'WEBSITE_CLICKS')).toEqual([])
  })

  it('drops an unparseable value instead of coercing it to 0', () => {
    const json: GBPPerformanceApiResponse = { timeSeries: { datedValues: [day(20, 'n/a')] } }
    expect(parseGBPTimeSeries(json, 'WEBSITE_CLICKS')).toEqual([])
  })

  it('drops an entry with an incomplete date', () => {
    const json = { timeSeries: { datedValues: [{ date: { year: 2026, month: 8 }, value: '5' }] } }
    expect(parseGBPTimeSeries(json as GBPPerformanceApiResponse, 'CALL_CLICKS')).toEqual([])
  })

  it('an entirely uncomputed window writes NOTHING, not a row of zeros', () => {
    const json: GBPPerformanceApiResponse = {
      timeSeries: { datedValues: [day(22), day(23), day(24), day(25), day(26)] },
    }
    expect(parseGBPTimeSeries(json, 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS')).toEqual([])
  })

  it('an empty response is empty, not a zero', () => {
    expect(parseGBPTimeSeries({}, 'CALL_CLICKS')).toEqual([])
    expect(parseGBPTimeSeries({ timeSeries: {} }, 'CALL_CLICKS')).toEqual([])
  })
})
