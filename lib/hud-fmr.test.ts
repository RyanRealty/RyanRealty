import { describe, it, expect } from 'vitest'
import { getAreaRentEstimate, countyFipsForCity } from './hud-fmr'

describe('countyFipsForCity', () => {
  it('maps service-area cities to their county FIPS', () => {
    expect(countyFipsForCity('Bend')).toBe('41017')
    expect(countyFipsForCity('redmond')).toBe('41017') // case-insensitive
    expect(countyFipsForCity('Powell Butte')).toBe('41013')
    expect(countyFipsForCity('Madras')).toBe('41031')
  })
  it('returns null for cities outside the mapped service area', () => {
    expect(countyFipsForCity('Portland')).toBeNull()
    expect(countyFipsForCity(null)).toBeNull()
    expect(countyFipsForCity('')).toBeNull()
  })
})

describe('getAreaRentEstimate (HUD FMR)', () => {
  it('returns the county FMR for the listing bedroom count', () => {
    const bend3 = getAreaRentEstimate('Bend', 3)
    expect(bend3?.value).toBe(2336) // Deschutes 3BR FY2025
    expect(bend3?.county).toBe('Deschutes')
    expect(bend3?.source).toBe('hud-fmr')
    expect(bend3?.label).toContain('HUD Fair Market Rent')
    expect(bend3?.label).toContain('3BR')

    expect(getAreaRentEstimate('Prineville', 2)?.value).toBe(1257) // Crook 2BR
    expect(getAreaRentEstimate('Madras', 1)?.value).toBe(871) // Jefferson 1BR
  })

  it('clamps bedrooms to HUD studio..4BR bands', () => {
    expect(getAreaRentEstimate('Bend', 0)?.value).toBe(1285) // studio
    expect(getAreaRentEstimate('Bend', 6)?.value).toBe(2799) // capped at 4BR
    expect(getAreaRentEstimate('Bend', 0)?.label).toContain('studio')
  })

  it('defaults missing bedrooms to 2BR', () => {
    expect(getAreaRentEstimate('Bend', null)?.value).toBe(1667) // Deschutes 2BR
  })

  it('provides a low/high range around the value', () => {
    const e = getAreaRentEstimate('Bend', 2)!
    expect(e.low).toBeLessThan(e.value)
    expect(e.high).toBeGreaterThan(e.value)
  })

  it('returns null outside the service area (caller falls back)', () => {
    expect(getAreaRentEstimate('Seattle', 2)).toBeNull()
    expect(getAreaRentEstimate(null, 2)).toBeNull()
  })
})
