import { describe, it, expect } from 'vitest'
import { toNum, toInt, toTimestamp, toDate, toBool, toText } from './listing-mapper'

// The MLS feed masks private values with "****"/"********"; these coercers must
// return null for the sentinel (a known crash source — see the jsonb-sentinel-cast
// memory) instead of producing NaN / invalid casts. Audit p3.2.
describe('Spark sanitizers — "********" privacy sentinel + coercion', () => {
  describe('toNum', () => {
    it('passes numbers, nulls invalid', () => {
      expect(toNum(42)).toBe(42)
      expect(toNum('12.5')).toBe(12.5)
      expect(toNum(null)).toBeNull()
      expect(toNum('')).toBeNull()
      expect(toNum('abc')).toBeNull()
      expect(toNum(Number.NaN)).toBeNull()
      expect(toNum({})).toBeNull()
    })
    it('returns null for the masked "****" / "********" sentinel', () => {
      expect(toNum('****')).toBeNull()
      expect(toNum('********')).toBeNull()
    })
  })

  describe('toInt', () => {
    it('rounds and guards the sentinel', () => {
      expect(toInt('3.7')).toBe(4)
      expect(toInt(5)).toBe(5)
      expect(toInt('********')).toBeNull()
      expect(toInt(null)).toBeNull()
    })
  })

  describe('toTimestamp', () => {
    it('returns the string for valid dates, null for masked/invalid', () => {
      expect(toTimestamp('2026-06-22T10:00:00Z')).toBe('2026-06-22T10:00:00Z')
      expect(toTimestamp('********')).toBeNull()
      expect(toTimestamp('not-a-date')).toBeNull()
      expect(toTimestamp('')).toBeNull()
      expect(toTimestamp(123)).toBeNull()
    })
  })

  describe('toDate', () => {
    it('normalizes to YYYY-MM-DD, null for masked', () => {
      expect(toDate('2026-06-22T23:00:00Z')).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(toDate('****')).toBeNull()
    })
  })

  describe('toBool', () => {
    it('coerces yes/no/true/false/1/0, null for masked', () => {
      expect(toBool(true)).toBe(true)
      expect(toBool('Yes')).toBe(true)
      expect(toBool('no')).toBe(false)
      expect(toBool('1')).toBe(true)
      expect(toBool('0')).toBe(false)
      expect(toBool('****')).toBeNull()
      expect(toBool(null)).toBeNull()
    })
  })

  describe('toText', () => {
    it('trims, nulls masked, flattens Spark feature objects + arrays', () => {
      expect(toText('  Bend  ')).toBe('Bend')
      expect(toText('****')).toBeNull()
      expect(toText('{"Frame":true,"Concrete":true}')).toBe('Frame, Concrete')
      expect(toText(['Frame', 'Stone'])).toBe('Frame, Stone')
    })
  })
})
