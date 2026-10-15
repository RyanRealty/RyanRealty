import { describe, expect, it } from 'vitest'
import {
  addDays,
  dayInZone,
  zonedMidnightMs,
  byChannelOrder,
  CHANNEL_ORDER,
  CHANNEL_PLAIN,
  changeWords,
  lastFullDays,
  positionWords,
  rangeQuery,
  rangeWords,
  share,
  shortDay,
  windowEndingOn,
} from './website'

describe('lastFullDays — Pacific days, and today is never in the window', () => {
  it('is the 7 full Pacific days ending yesterday, and the 7 before', () => {
    // 11:30 am Pacific on Oct 14.
    const w = lastFullDays(new Date('2026-10-14T18:30:00Z'), 7)
    expect(w.current).toEqual({
      startDate: '2026-10-07',
      endDate: '2026-10-13',
      startIso: '2026-10-07T07:00:00.000Z',
      endIso: '2026-10-14T06:59:59.999Z',
    })
    expect(w.previous.startDate).toBe('2026-09-30')
    expect(w.previous.endDate).toBe('2026-10-06')
    expect(w.previous.endIso).toBe('2026-10-07T06:59:59.999Z')
  })

  it('does not move during the Pacific day, and moves at Pacific midnight', () => {
    const early = lastFullDays(new Date('2026-10-14T07:00:01Z'), 7) // 00:00:01 PDT Oct 14
    const late = lastFullDays(new Date('2026-10-15T06:59:59Z'), 7) // 23:59:59 PDT Oct 14
    expect(early).toEqual(late)
    // 5 pm Pacific on Oct 13 is already Oct 14 in UTC; the window must not move yet.
    expect(lastFullDays(new Date('2026-10-14T00:30:00Z'), 7).current.endDate).toBe('2026-10-12')
  })

  it('a lead at 6 pm Pacific on Oct 13 is inside the Oct 7 to Oct 13 window', () => {
    const w = lastFullDays(new Date('2026-10-14T18:30:00Z'), 7)
    const lead = '2026-10-14T01:00:00.000Z'
    expect(lead >= w.current.startIso && lead <= w.current.endIso).toBe(true)
    expect(dayInZone(lead)).toBe('2026-10-13')
  })

  it('handles the end of daylight time', () => {
    // DST ends Nov 1, 2026: Oct 29 starts at 07:00Z (PDT), Nov 5 at 08:00Z (PST).
    const w = lastFullDays(new Date('2026-11-05T20:00:00Z'), 7)
    expect(w.current.startDate).toBe('2026-10-29')
    expect(w.current.endDate).toBe('2026-11-04')
    expect(w.current.startIso).toBe('2026-10-29T07:00:00.000Z')
    expect(w.current.endIso).toBe('2026-11-05T07:59:59.999Z')
    expect(zonedMidnightMs('2026-11-01')).toBe(Date.parse('2026-11-01T07:00:00.000Z'))
    expect(zonedMidnightMs('2026-11-02')).toBe(Date.parse('2026-11-02T08:00:00.000Z'))
  })
})

describe('windowEndingOn — for sources that report days late', () => {
  it('ends on the newest reported day', () => {
    const w = windowEndingOn('2026-10-11', 7)
    expect(w.current.startDate).toBe('2026-10-05')
    expect(w.current.endDate).toBe('2026-10-11')
    expect(w.previous.startDate).toBe('2026-09-28')
    expect(w.previous.endDate).toBe('2026-10-04')
  })
  it('shifts days', () => {
    expect(addDays('2026-10-01', -1)).toBe('2026-09-30')
  })
})

describe('words', () => {
  it('writes dates and ranges', () => {
    expect(shortDay('2026-10-07')).toBe('Oct 7')
    expect(rangeWords({ startDate: '2026-10-07', endDate: '2026-10-13' })).toBe('Oct 7 to Oct 13')
    expect(rangeQuery({ startDate: '2026-10-07', endDate: '2026-10-13' })).toBe(
      'range=custom&startDate=2026-10-07&endDate=2026-10-13',
    )
  })

  it('writes changes', () => {
    expect(changeWords(2447, 1966)).toBe('up 24% from 1,966 the 7 days before')
    expect(changeWords(90, 100)).toBe('down 10% from 100 the 7 days before')
    expect(changeWords(12, 12)).toBe('same as the 7 days before (12)')
    expect(changeWords(5, 0)).toBe('none the 7 days before')
    expect(changeWords(0, 0)).toBe('none the 7 days before either')
    expect(changeWords(1001, 1000)).toBe('up under 1% from 1,000 the 7 days before')
  })

  it('a lower position is better', () => {
    expect(positionWords(8.2, 9.4)).toBe('better by 1.2 (was 9.4)')
    expect(positionWords(9.4, 8.2)).toBe('worse by 1.2 (was 8.2)')
    expect(positionWords(0, 8.2)).toBe('')
  })

  it('writes shares, never a share of nothing', () => {
    expect(share(39, 2447)).toBe('2%')
    expect(share(1, 2447)).toBe('under 1%')
    expect(share(0, 10)).toBe('0%')
    expect(share(3, 0)).toBeNull()
  })
})

describe('channels in plain words', () => {
  it('names every channel and orders every channel', () => {
    expect([...CHANNEL_ORDER].sort()).toEqual(Object.keys(CHANNEL_PLAIN).sort())
    expect(CHANNEL_PLAIN['AI Assistant']).toMatch(/AI assistants/)
    expect(CHANNEL_PLAIN['Google Business Profile']).toBe('Google Business Profile')
  })
  it('puts the unknown last', () => {
    const rows = byChannelOrder([{ channel: 'Direct' as const }, { channel: 'Organic Search' as const }, { channel: 'Email' as const }])
    expect(rows.map((r) => r.channel)).toEqual(['Organic Search', 'Email', 'Direct'])
  })
})
