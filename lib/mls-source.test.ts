import { describe, it, expect } from 'vitest'
import { getMlsSourceMeta, normalizeMlsDisplayNumber } from './mls-source'

describe('getMlsSourceMeta', () => {
  it('maps known sources regardless of spacing/case', () => {
    expect(getMlsSourceMeta('central_oregon').label).toBe('Oregon Data Share')
    expect(getMlsSourceMeta('Oregon Data Share').label).toBe('Oregon Data Share')
    expect(getMlsSourceMeta('Morgan-Data-Shuttle').label).toBe('Morgan Data Shuttle')
  })
  it('defaults empty to Oregon Data Share, title-cases unknown', () => {
    expect(getMlsSourceMeta(null).label).toBe('Oregon Data Share')
    expect(getMlsSourceMeta('').label).toBe('Oregon Data Share')
    const other = getMlsSourceMeta('some_other_mls')
    expect(other.label).toBe('Some Other Mls')
    expect(other.logoPath).toBeNull()
  })
})

describe('normalizeMlsDisplayNumber', () => {
  it('accepts 5-12 alphanumeric and trims', () => {
    expect(normalizeMlsDisplayNumber('220189422')).toBe('220189422')
    expect(normalizeMlsDisplayNumber('  220189422  ')).toBe('220189422')
    expect(normalizeMlsDisplayNumber('AB12345')).toBe('AB12345')
  })
  it('rejects too-short / too-long / non-alphanumeric / empty', () => {
    expect(normalizeMlsDisplayNumber('1234')).toBeNull()
    expect(normalizeMlsDisplayNumber('1234567890123')).toBeNull()
    expect(normalizeMlsDisplayNumber('12-34')).toBeNull()
    expect(normalizeMlsDisplayNumber('')).toBeNull()
    expect(normalizeMlsDisplayNumber(null)).toBeNull()
  })
})
