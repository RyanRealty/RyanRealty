import { describe, expect, it } from 'vitest'
import {
  isLandListingFace,
  listingFace,
  publishLandFacts,
  publishLandLineTwo,
  publishLandPlaceName,
  publishLandPropertyTypeLabel,
} from './listing-face'

describe('listingFace', () => {
  it('treats Residential Lots and MLS D as land', () => {
    expect(
      isLandListingFace({
        propertyType: 'D',
        propertySubType: 'Residential Lots',
        beds: null,
      }),
    ).toBe(true)
    expect(listingFace({ propertyType: 'D', propertySubType: 'Residential Lots' })).toBe('land')
    expect(isLandListingFace({ propertyType: 'A', propertySubType: 'Single Family Residence', beds: 3 })).toBe(
      false,
    )
  })

  it('does not flip a house to land just because beds are missing', () => {
    expect(
      isLandListingFace({
        propertyType: 'A',
        propertySubType: 'Single Family Residence',
        beds: null,
      }),
    ).toBe(false)
  })

  it('prints the land line two once for Awbrey Butte', () => {
    expect(
      publishLandLineTwo({
        acres: 0.48,
        neighborhood: 'Awbrey Butte',
        subdivision: 'Awbrey Butte',
        city: 'Bend',
      }),
    ).toBe('0.48 acres · Awbrey Butte · Bend')
    expect(
      publishLandPlaceName({ neighborhood: 'Awbrey Butte', subdivision: 'Awbrey Butte' }),
    ).toBe('Awbrey Butte')
  })

  it('labels the lot type as Residential lot and lists facts first', () => {
    expect(
      publishLandPropertyTypeLabel({ propertyType: 'D', propertySubType: 'Residential Lots' }),
    ).toBe('Residential lot')
    const facts = publishLandFacts({
      acres: 0.48,
      propertyType: 'D',
      propertySubType: 'Residential Lots',
      daysOnMarket: 149,
      taxAnnualAmount: 3044,
      hoaMonthly: 15,
    })
    expect(facts.map((row) => row.label)).toEqual(['Acres', 'Property type', 'DOM', 'Taxes', 'HOA'])
    expect(facts.map((row) => row.value)).toEqual([
      '0.48 acres',
      'Residential lot',
      '149 DOM',
      '$3,044 / year',
      '$15 per month',
    ])
    expect(facts.some((row) => /bed/i.test(row.label) || /bed/i.test(row.value))).toBe(false)
  })
})

describe('listing land face wiring', () => {
  const { readFileSync } = require('node:fs') as typeof import('node:fs')
  const { join } = require('node:path') as typeof import('node:path')
  const page = readFileSync(join(__dirname, '../../app/listing/[listingKey]/page.tsx'), 'utf8')

  it('branches the existing listing-detail page, not a second template', () => {
    expect(page).toMatch(/listingFace\(/)
    expect(page).toMatch(/Land for sale/)
    expect(page).toMatch(/Where this lot sits/)
    expect(page).toMatch(/This lot sits in/)
    expect(page).toMatch(/Get alerts for land like this|face=\{face\}/)
    expect(page).toMatch(/isHouse \? \(/)
    expect(page).toMatch(/<RoomRestyle/)
    expect(page).toMatch(/<RentalAnalysis/)
  })
})
