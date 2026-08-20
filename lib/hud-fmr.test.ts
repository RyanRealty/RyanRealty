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

  // Was "defaults missing bedrooms to 2BR". That default published a bedroom
  // count the feed never stated, under the label "HUD Fair Market Rent
  // (FY2025), Deschutes County, 2BR" — verified on the rendered page for MLS
  // 220218536, where the $1,667 below became "Gross rent $1,667", a 71.2% cap
  // rate and a 324.3% cash-on-cash return. 46 live Active class-A rows state no
  // bedroom count. §0.7: publish no figure.
  it('publishes nothing when the feed states no bedroom count', () => {
    expect(getAreaRentEstimate('Bend', null)).toBeNull()
    expect(getAreaRentEstimate('Bend', undefined)).toBeNull()
    expect(getAreaRentEstimate('Sunriver', null)).toBeNull()
    // A stated zero is a studio, which HUD prices — three Powder Village Condo
    // rows in Sunriver carry beds 0 over 392–448 sq ft.
    expect(getAreaRentEstimate('Sunriver', 0)?.value).toBe(1285)
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
