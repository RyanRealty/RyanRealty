import { describe, it, expect } from 'vitest'
import {
  dayOfWeek,
  shiftDays,
  shiftMonths,
  weekRange,
  monthRange,
  monthGrid,
  taskGroupLabel,
  monthLabel,
  dayColumnLabel,
  time12,
  wallDateKey,
  wallMinutes,
  eventsByDate,
  type CalEvent,
} from './calendar'

describe('lib/crm/calendar — §09 calendar math', () => {
  it('dayOfWeek matches known dates', () => {
    expect(dayOfWeek('2026-07-01')).toBe(3) // Wednesday
    expect(dayOfWeek('2026-06-30')).toBe(2) // Tuesday
    expect(dayOfWeek('2026-06-28')).toBe(0) // Sunday
  })

  it('shiftDays crosses month + year boundaries', () => {
    expect(shiftDays('2026-06-30', 1)).toBe('2026-07-01')
    expect(shiftDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(shiftDays('2026-07-01', 7)).toBe('2026-07-08')
  })

  it('shiftMonths clamps to the first of the target month', () => {
    expect(shiftMonths('2026-07-15', 1)).toBe('2026-08-01')
    expect(shiftMonths('2026-01-31', -1)).toBe('2025-12-01')
  })

  it('weekRange is Sunday-anchored (§2.5.2)', () => {
    expect(weekRange('2026-07-01')).toEqual({ from: '2026-06-28', to: '2026-07-04' })
    expect(weekRange('2026-06-28')).toEqual({ from: '2026-06-28', to: '2026-07-04' })
  })

  it('monthRange handles 30/31/28-day months', () => {
    expect(monthRange('2026-06-15')).toEqual({ from: '2026-06-01', to: '2026-06-30' })
    expect(monthRange('2026-07-01')).toEqual({ from: '2026-07-01', to: '2026-07-31' })
    expect(monthRange('2026-02-10')).toEqual({ from: '2026-02-01', to: '2026-02-28' })
  })

  it('monthGrid includes Sunday-aligned overflow days (§2.5.3)', () => {
    const g = monthGrid('2026-07-01') // Jul 2026: 1st is a Wednesday
    expect(g.from).toBe('2026-06-28') // Sunday before
    expect(g.to).toBe('2026-08-01') // Saturday after Jul 31 (Friday)
    expect(g.cells.length % 7).toBe(0)
    expect(g.cells[0]).toBe('2026-06-28')
    expect(g.cells[g.cells.length - 1]).toBe('2026-08-01')
  })

  it('labels match the spec formats', () => {
    expect(taskGroupLabel('2026-06-23')).toBe('Tuesday, Jun 23') // §1.5.2
    expect(monthLabel('2026-06-15')).toBe('June 2026')
    expect(dayColumnLabel('2026-06-30')).toBe('Tuesday 30') // §2.5.1
  })

  it('time12 uses lowercase am/pm with no leading zero (§1.5.3)', () => {
    expect(time12(12 * 60 + 12)).toBe('12:12pm')
    expect(time12(6 * 60 + 27)).toBe('6:27am')
    expect(time12(15 * 60 + 30)).toBe('3:30pm')
    expect(time12(0)).toBe('12am')
    expect(time12(12 * 60)).toBe('12pm')
  })

  it('wall-clock parsing reads the stored wall time, not a converted instant', () => {
    expect(wallDateKey('2026-07-04T09:30:00+00:00')).toBe('2026-07-04')
    expect(wallMinutes('2026-07-04T09:30:00+00:00')).toBe(9 * 60 + 30)
    expect(wallMinutes('2026-07-04T00:00:00Z')).toBe(0)
  })

  it('eventsByDate groups per day with all-day first, then start time', () => {
    const ev = (id: string, dateKey: string, startMin: number, allDay = false): CalEvent => ({
      id, kind: 'appointment', title: id, dateKey, startMin, endMin: startMin + 30,
      allDay, timeLabel: '', personId: null, personName: null, broker: null, apptId: null,
    })
    const map = eventsByDate([
      ev('b', '2026-07-01', 600),
      ev('c', '2026-07-01', -1, true),
      ev('a', '2026-07-01', 480),
      ev('d', '2026-07-02', 60),
    ])
    expect(map.get('2026-07-01')!.map((e) => e.id)).toEqual(['c', 'a', 'b'])
    expect(map.get('2026-07-02')!.map((e) => e.id)).toEqual(['d'])
  })
})
