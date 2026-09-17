import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  HISTORY_FROM_YEAR,
  HISTORY_PATH,
  HISTORY_QUERY_KEYS,
  buildHistoryQuery,
  historyQueryFromFormData,
} from './history-query'

describe('buildHistoryQuery', () => {
  it('preserves the GET contract: year, city, type, fireplace, min, max', () => {
    expect(
      buildHistoryQuery({
        year: '2024',
        city: 'Bend',
        type: 'A',
        fireplace: true,
        min: 400000,
        max: 1000000,
      }),
    ).toBe(`${HISTORY_PATH}?year=2024&city=Bend&type=A&fireplace=1&min=400000&max=1000000`)
    expect(HISTORY_QUERY_KEYS).toEqual(['year', 'city', 'type', 'fireplace', 'min', 'max'])
  })

  it('omits empty, all, and fireplace-off so the URL stays clean', () => {
    expect(
      buildHistoryQuery({
        year: '2024',
        city: 'all',
        type: '',
        fireplace: '0',
        min: '',
        max: '',
      }),
    ).toBe(`${HISTORY_PATH}?year=2024`)
  })

  it('reads the same keys from a native GET form', () => {
    const data = new FormData()
    data.set('year', '1998')
    data.set('city', 'Sisters')
    data.set('type', 'D')
    data.set('fireplace', '1')
    data.set('min', '250000')
    data.set('max', '750000')
    expect(historyQueryFromFormData(data)).toBe(
      `${HISTORY_PATH}?year=1998&city=Sisters&type=D&fireplace=1&min=250000&max=750000`,
    )
  })
})

describe('closed-sales explorer filter bar', () => {
  it('starts the year picker at 1998', () => {
    expect(HISTORY_FROM_YEAR).toBe(1998)
  })

  it('is an inline bar, not a Step N of 4 sheet', () => {
    const src = readFileSync(resolve(__dirname, './HistoryFilterBar.client.tsx'), 'utf8')
    expect(src).toMatch(/name="year"/)
    expect(src).toMatch(/name="city"/)
    expect(src).toMatch(/name="type"/)
    expect(src).toMatch(/name="fireplace"/)
    expect(src).toMatch(/name="min"/)
    expect(src).toMatch(/name="max"/)
    expect(src).not.toMatch(/V3Sheet/)
    expect(src).not.toMatch(/Step \d+ of/)
    expect(src).not.toMatch(/Slice closed sales/)
  })
})
