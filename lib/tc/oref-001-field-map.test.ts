import { describe, expect, it } from 'vitest'
import { fieldRectToPdf } from './seal-pdf'
import {
  OREF_001_PAGE_HEIGHT,
  OREF_001_PAGE_WIDTH,
  isOref001OverlayApplicable,
  oref001FieldFromPdfPoints,
  oref001OverlayFieldMap,
} from './oref-001-field-map'

describe('isOref001OverlayApplicable', () => {
  it('matches form 001 with the measured 15-page blank', () => {
    expect(isOref001OverlayApplicable('001', 15)).toBe(true)
    expect(isOref001OverlayApplicable('001', null)).toBe(true)
  })

  it('refuses a different form or a revised page count', () => {
    expect(isOref001OverlayApplicable('110', 15)).toBe(false)
    expect(isOref001OverlayApplicable('001', 16)).toBe(false)
  })
})

describe('oref001OverlayFieldMap', () => {
  it('binds deal-fact blanks and never includes listing price', () => {
    const map = oref001OverlayFieldMap()
    const bindings = map.map((f) => f.binding)
    expect(bindings).toEqual(
      expect.arrayContaining([
        'PropertyAddress',
        'PropertyCity',
        'SalePrice',
        'Buyer1Name',
        'Seller1Name',
      ]),
    )
    expect(bindings.join(' ').toLowerCase()).not.toMatch(/listprice|listingprice/)
    expect(map.length).toBeGreaterThanOrEqual(5)
    expect(map.every((f) => f.page && f.x != null && f.y != null && f.w && f.h)).toBe(true)
  })

  it('round-trips measured PDF points through sealer geometry', () => {
    const field = oref001FieldFromPdfPoints(2, 505, 405, 68, 'SalePrice', 'Sale price')
    const box = fieldRectToPdf(
      { x: field.x!, y: field.y!, w: field.w!, h: field.h! },
      OREF_001_PAGE_WIDTH,
      OREF_001_PAGE_HEIGHT,
    )
    expect(box.x).toBeCloseTo(505, 5)
    expect(box.y).toBeCloseTo(403, 5)
    expect(box.w).toBeCloseTo(68, 5)
  })
})
