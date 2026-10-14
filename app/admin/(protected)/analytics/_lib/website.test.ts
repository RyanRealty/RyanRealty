import { describe, expect, it } from 'vitest'
import {
  addDays,
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

describe('lastFullDays — today is never in the window', () => {
  it('is the 7 full UTC days ending yesterday, and the 7 before', () => {
    const w = lastFullDays(new Date('2026-10-14T18:30:00Z'), 7)
    expect(w.current).toEqual({
      startDate: '2026-10-07',
      endDate: '2026-10-13',
      startIso: '2026-10-07T00:00:00.000Z',
      endIso: '2026-10-13T23:59:59.999Z',
    })
    expect(w.previous.startDate).toBe('2026-09-30')
    expect(w.previous.endDate).toBe('2026-10-06')
  })

  it('does not move during the day', () => {
    const a = lastFullDays(new Date('2026-10-14T00:00:01Z'), 7)
    const b = lastFullDays(new Date('2026-10-14T23:59:59Z'), 7)
    expect(a).toEqual(b)
  })

  it('crosses a month boundary', () => {
    const w = lastFullDays(new Date('2026-11-03T10:00:00Z'), 7)
    expect(w.current.startDate).toBe('2026-10-27')
    expect(w.current.endDate).toBe('2026-11-02')
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
