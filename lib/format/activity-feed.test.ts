import { describe, it, expect } from 'vitest'
import type { ActivityFeedItem } from '@/lib/data/crm/getContactActivityFeed'
import { relativeTime, dayKey, dayLabel, groupByDay } from './activity-feed'

// Fixed reference instant: 2026-06-22T20:00:00Z == Jun 22, 2026, 1:00 PM PT.
const NOW = new Date('2026-06-22T20:00:00.000Z').getTime()

describe('relativeTime', () => {
  it('returns just now under a minute', () => {
    expect(relativeTime('2026-06-22T19:59:40.000Z', NOW)).toBe('just now')
  })
  it('returns minutes under an hour', () => {
    expect(relativeTime('2026-06-22T19:48:00.000Z', NOW)).toBe('12m')
  })
  it('returns hours under a day', () => {
    expect(relativeTime('2026-06-22T17:00:00.000Z', NOW)).toBe('3h')
  })
  it('returns days under a week', () => {
    expect(relativeTime('2026-06-17T20:00:00.000Z', NOW)).toBe('5d')
  })
  it('returns a short same-year date past a week', () => {
    // 30 days earlier, same calendar year, so no year shown.
    expect(relativeTime('2026-05-23T20:00:00.000Z', NOW)).toBe('May 23')
  })
  it('shows the year when not the current year', () => {
    expect(relativeTime('2025-12-01T20:00:00.000Z', NOW)).toBe('Dec 1, 2025')
  })
  it('treats clock-skewed future rows as just now', () => {
    expect(relativeTime('2026-06-22T20:05:00.000Z', NOW)).toBe('just now')
  })
  it('returns empty for null or invalid input', () => {
    expect(relativeTime(null, NOW)).toBe('')
    expect(relativeTime('not-a-date', NOW)).toBe('')
  })
})

describe('dayKey', () => {
  it('keys by brand timezone day', () => {
    // 06:00Z is still Jun 21 in PT (UTC-7).
    expect(dayKey('2026-06-22T06:00:00.000Z')).toBe('2026-06-21')
    expect(dayKey('2026-06-22T20:00:00.000Z')).toBe('2026-06-22')
  })
  it('returns unknown for invalid input', () => {
    expect(dayKey('not-a-date')).toBe('unknown')
  })
})

describe('dayLabel', () => {
  it('labels today and yesterday', () => {
    expect(dayLabel('2026-06-22T20:00:00.000Z', NOW)).toBe('Today')
    expect(dayLabel('2026-06-21T20:00:00.000Z', NOW)).toBe('Yesterday')
  })
  it('labels older days with a weekday and short date', () => {
    expect(dayLabel('2026-06-16T20:00:00.000Z', NOW)).toBe('Tue, Jun 16')
  })
})

describe('groupByDay', () => {
  function item(id: number, ts: string): ActivityFeedItem {
    return {
      id,
      ts,
      kind: 'note',
      category: 'note',
      direction: null,
      label: 'Note',
      snippet: null,
      broker: null,
      source: 'app',
    }
  }

  it('buckets consecutive same-day items together, preserving order', () => {
    const items = [
      item(1, '2026-06-22T20:00:00.000Z'),
      item(2, '2026-06-22T18:00:00.000Z'),
      item(3, '2026-06-21T20:00:00.000Z'),
      item(4, '2026-06-16T20:00:00.000Z'),
    ]
    const groups = groupByDay(items, NOW)
    expect(groups.map((g) => g.label)).toEqual(['Today', 'Yesterday', 'Tue, Jun 16'])
    expect(groups[0].items.map((i) => i.id)).toEqual([1, 2])
    expect(groups[1].items.map((i) => i.id)).toEqual([3])
    expect(groups[2].items.map((i) => i.id)).toEqual([4])
  })

  it('returns an empty array for no items', () => {
    expect(groupByDay([], NOW)).toEqual([])
  })
})
