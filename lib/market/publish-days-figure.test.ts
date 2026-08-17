import { describe, expect, it } from 'vitest'
import { publishDaysFigure, publishDaysLabel } from './publish-days-figure'

describe('publishDaysFigure', () => {
  it('keeps the half-day the FAQ already prints (Black Butte founding)', () => {
    expect(publishDaysFigure(39.5)).toBe('39.5')
    expect(publishDaysLabel(39.5)).toBe('39.5 days')
    expect(publishDaysFigure(39.5)).not.toBe(String(Math.round(39.5)))
  })

  it('prints whole days without a trailing .0', () => {
    expect(publishDaysFigure(18)).toBe('18')
    expect(publishDaysLabel(50)).toBe('50 days')
  })

  it('normalizes float noise to tenths', () => {
    expect(publishDaysFigure(19.5000000001)).toBe('19.5')
    expect(publishDaysFigure(10.49)).toBe('10.5')
  })

  it('withholds non-positive and non-finite values', () => {
    expect(publishDaysFigure(null)).toBeNull()
    expect(publishDaysFigure(0)).toBeNull()
    expect(publishDaysFigure(-4)).toBeNull()
    expect(publishDaysFigure(Number.NaN)).toBeNull()
    expect(publishDaysLabel(undefined)).toBeNull()
  })
})
