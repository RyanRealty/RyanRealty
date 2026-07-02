import { describe, it, expect } from 'vitest'
import { isWithinOfficeHours, localDayMinutes, parseHm } from './office-hours'
import type { OfficeHoursBlock } from '@/lib/data/crm/getCrmCompanySettings'

const TZ = 'America/Los_Angeles'

// 2026-07-01 is a Wednesday. 18:00 UTC = 11:00 PDT.
const WED_11AM_PT = new Date('2026-07-01T18:00:00Z')
// 2026-07-01 05:00 UTC = 2026-06-30 22:00 PDT (Tuesday night).
const TUE_10PM_PT = new Date('2026-07-01T05:00:00Z')
// 2026-07-04 is a Saturday. 17:00 UTC = 10:00 PDT.
const SAT_10AM_PT = new Date('2026-07-04T17:00:00Z')

const WEEKDAYS: OfficeHoursBlock = { days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], start_time: '08:00', end_time: '18:00' }
const SAT_MORNING: OfficeHoursBlock = { days: ['Sat'], start_time: '09:00', end_time: '12:00' }

describe('parseHm', () => {
  it('parses HH:MM into minutes', () => {
    expect(parseHm('08:00')).toBe(480)
    expect(parseHm('18:30')).toBe(1110)
    expect(parseHm('0:05')).toBe(5)
  })
  it('rejects malformed values', () => {
    expect(parseHm('')).toBeNull()
    expect(parseHm('25:00')).toBeNull()
    expect(parseHm('8am')).toBeNull()
    expect(parseHm(null)).toBeNull()
  })
})

describe('localDayMinutes', () => {
  it('resolves the local weekday + minutes in the company zone', () => {
    expect(localDayMinutes(WED_11AM_PT, TZ)).toEqual({ day: 'Wed', minutes: 660 })
    expect(localDayMinutes(TUE_10PM_PT, TZ)).toEqual({ day: 'Tue', minutes: 1320 })
  })
})

describe('isWithinOfficeHours', () => {
  it('empty blocks = always open (pre-config behavior unchanged)', () => {
    expect(isWithinOfficeHours([], TZ, TUE_10PM_PT)).toBe(true)
    expect(isWithinOfficeHours(null, TZ, TUE_10PM_PT)).toBe(true)
  })
  it('inside a weekday block', () => {
    expect(isWithinOfficeHours([WEEKDAYS], TZ, WED_11AM_PT)).toBe(true)
  })
  it('outside hours on a configured day', () => {
    expect(isWithinOfficeHours([WEEKDAYS], TZ, TUE_10PM_PT)).toBe(false)
  })
  it('day not in any block', () => {
    expect(isWithinOfficeHours([WEEKDAYS], TZ, SAT_10AM_PT)).toBe(false)
  })
  it('multiple blocks cover different days', () => {
    expect(isWithinOfficeHours([WEEKDAYS, SAT_MORNING], TZ, SAT_10AM_PT)).toBe(true)
  })
  it('overnight block spills past midnight', () => {
    const overnight: OfficeHoursBlock = { days: ['Tue'], start_time: '20:00', end_time: '06:00' }
    expect(isWithinOfficeHours([overnight], TZ, TUE_10PM_PT)).toBe(true)
  })
  it('malformed block is skipped, not fatal', () => {
    const bad = { days: ['Wed'], start_time: 'nope', end_time: '18:00' } as OfficeHoursBlock
    expect(isWithinOfficeHours([bad], TZ, WED_11AM_PT)).toBe(false)
    expect(isWithinOfficeHours([bad, WEEKDAYS], TZ, WED_11AM_PT)).toBe(true)
  })
})
