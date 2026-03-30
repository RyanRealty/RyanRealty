import { describe, it, expect } from 'vitest'
import { getPropertyTypeLabel } from './property-type-labels'

describe('getPropertyTypeLabel (property-type-labels)', () => {
  it('maps SFR to Single Family Residential', () => {
    expect(getPropertyTypeLabel('SFR')).toBe('Single Family Residential')
  })

  it('maps CONDO to Condominium', () => {
    expect(getPropertyTypeLabel('CONDO')).toBe('Condominium')
  })

  it('maps TWNHS to Townhouse', () => {
    expect(getPropertyTypeLabel('TWNHS')).toBe('Townhouse')
  })

  it('maps MFR to Multi-Family', () => {
    expect(getPropertyTypeLabel('MFR')).toBe('Multi-Family')
  })

  it('maps LAND to Land', () => {
    expect(getPropertyTypeLabel('LAND')).toBe('Land')
  })

  it('maps MH to Manufactured Home', () => {
    expect(getPropertyTypeLabel('MH')).toBe('Manufactured Home')
  })

  it('maps numeric code 433 to Manufactured Home', () => {
    expect(getPropertyTypeLabel('433')).toBe('Manufactured Home')
  })

  it('is case insensitive (lowercase input)', () => {
    expect(getPropertyTypeLabel('sfr')).toBe('Single Family Residential')
  })

  it('handles mixed case input', () => {
    expect(getPropertyTypeLabel('Condo')).toBe('Condominium')
  })

  it('title-cases unknown codes', () => {
    expect(getPropertyTypeLabel('VILLA')).toBe('Villa')
  })

  it('returns dash for null', () => {
    expect(getPropertyTypeLabel(null)).toBe('—')
  })

  it('returns dash for undefined', () => {
    expect(getPropertyTypeLabel(undefined)).toBe('—')
  })

  it('returns dash for empty string', () => {
    expect(getPropertyTypeLabel('')).toBe('—')
  })

  it('returns dash for whitespace-only', () => {
    expect(getPropertyTypeLabel('  ')).toBe('—')
  })

  it('trims whitespace before matching', () => {
    expect(getPropertyTypeLabel('  SFR  ')).toBe('Single Family Residential')
  })
})
