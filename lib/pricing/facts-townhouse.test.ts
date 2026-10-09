import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  CONDO_FACTS_OR,
  factsProductClauses,
  productClassFromFactsRow,
  productCompatible,
  TOWNHOUSE_FACTS_OR,
} from '@/lib/pricing/classes'
import { walkPricingLadder, type PricingSale, type PricingSubject } from '@/lib/pricing/match'

function subject(over: Partial<PricingSubject> = {}): PricingSubject {
  return {
    listingKey: 'SUBJ',
    streetAddress: '1 Test St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    latitude: 44.06,
    longitude: -121.3,
    beds: 3,
    baths: 2,
    sqft: 1500,
    lotAcres: 0.05,
    yearBuilt: 2018,
    storyClass: 'two',
    productClass: 'townhouse',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'hoa',
    lotClass: 'in_town',
    ruralAcreage: false,
    marketArea: null,
    ...over,
  }
}

function sale(over: Partial<PricingSale> = {}): PricingSale {
  return {
    listingKey: 'K1',
    listNumber: null,
    address: '11 Comp St',
    city: 'Bend',
    citySlug: 'bend',
    subdivision: 'Kenwood',
    subdivisionNorm: 'kenwood',
    latitude: 44.061,
    longitude: -121.301,
    beds: 3,
    baths: 2,
    sqft: 1480,
    lotAcres: 0.05,
    yearBuilt: 2019,
    storyClass: 'two',
    productClass: 'townhouse',
    waterClass: 'public',
    sewerClass: 'public',
    hoaClass: 'hoa',
    lotClass: 'in_town',
    closePrice: 550_000,
    concessionsAmount: null,
    concessionsYn: null,
    closeDate: '2026-06-01',
    originalAsk: 560_000,
    lastAsk: 555_000,
    daysToOffer: 12,
    cdom: 20,
    dropCount: 0,
    closePpsf: 371,
    photoUrl: null,
    publicRemarks: null,
    ...over,
  }
}

const asOf = '2026-10-03'

describe('townhouse facts pool — stored product_class is attached', () => {
  it('does not query product_class townhouse, and does not open the whole attached bucket', () => {
    const town = factsProductClauses('townhouse')
    expect(town.or).toBe(TOWNHOUSE_FACTS_OR)
    expect(town.or).toContain('product_class.eq.attached')
    expect(town.or).toContain('property_sub_type.ilike.%town%')
    expect(town.or).not.toContain('Condominium')
    expect(town.eq).toBeUndefined()
    expect(town.or).not.toBe('product_class.eq.townhouse')
    // A bare attached equality would pull condos. The subtype guard has to sit in the same AND.
    expect(town.or).toContain('and(product_class.eq.attached,property_sub_type.ilike.%town%)')
  })

  it('asks for attached condo rows, and does not open the whole attached bucket', () => {
    const condo = factsProductClauses('condo')
    expect(condo.or).toBe(CONDO_FACTS_OR)
    expect(condo.or).toContain('product_class.eq.attached')
    expect(condo.or).toContain('property_sub_type.ilike.%condo%')
    expect(condo.or).not.toContain('%town%')
    expect(condo.eq).toBeUndefined()
    expect(condo.or).toContain('and(product_class.eq.attached,property_sub_type.ilike.%condo%)')
  })

  it('leaves single-family on its own product_class', () => {
    expect(factsProductClauses('detached')).toEqual({ eq: ['product_class', 'detached'] })
    expect(factsProductClauses('unknown')).toEqual({})
    expect(factsProductClauses(null)).toEqual({})
  })

  it('wires both facts reads through that clause, not eq(product_class, subject class)', () => {
    const src = readFileSync('lib/data/pricing/facts.ts', 'utf8')
    expect(src).toContain('applyFactsProductClause')
    expect(src).not.toContain(".eq('product_class', opts.productClass)")
    expect(src.match(/applyFactsProductClause\(q, opts\.productClass\)/g)).toHaveLength(2)
  })

  it('classes a townhouse stored as attached as a townhouse, and a condo stored as attached as a condo', () => {
    expect(productClassFromFactsRow('attached', 'Townhouse')).toBe('townhouse')
    expect(productClassFromFactsRow('attached', 'Townhome')).toBe('townhouse')
    expect(productClassFromFactsRow('attached', 'Condominium')).toBe('condo')
    expect(productClassFromFactsRow('attached', 'Apartment')).toBe('attached')
    expect(productClassFromFactsRow('attached', 'Tenancy in Common')).toBe('attached')
    expect(productClassFromFactsRow('detached', 'Single Family Residence')).toBe('detached')
    expect(productCompatible('townhouse', productClassFromFactsRow('attached', 'Townhouse'))).toBe(true)
    expect(productCompatible('townhouse', productClassFromFactsRow('attached', 'Condominium'))).toBe(false)
    expect(productCompatible('townhouse', productClassFromFactsRow('attached', 'Apartment'))).toBe(false)
    expect(productCompatible('detached', productClassFromFactsRow('detached', 'Single Family Residence'))).toBe(true)
  })

  it('lets a townhouse subject match a closed townhouse stored as attached, and not a condo stored as attached', () => {
    const town = sale({
      listingKey: 'TOWN',
      address: '11 Industrial',
      productClass: productClassFromFactsRow('attached', 'Townhouse'),
    })
    const condo = sale({
      listingKey: 'CONDO',
      address: '10 Industrial',
      productClass: productClassFromFactsRow('attached', 'Condominium'),
    })
    const out = walkPricingLadder(subject(), [town, condo], { asOf })
    expect(out.comps.map((c) => c.listingKey)).toEqual(['TOWN'])
    expect(out.comps.map((c) => c.listingKey)).not.toContain('CONDO')
  })

  it('keeps another unit in the same condo building, stored as attached', () => {
    const otherUnit = sale({
      listingKey: 'UNIT207',
      address: '2745 Ordway',
      unitNumber: '207',
      subdivision: 'NorthWest Crossing',
      subdivisionNorm: 'northwest crossing',
      subdivisionSlug: 'arete',
      beds: 1,
      baths: 1,
      sqft: 578,
      yearBuilt: 2023,
      productClass: productClassFromFactsRow('attached', 'Condominium'),
      closePrice: 485_000,
      lastAsk: 499_000,
      closePpsf: 839,
    })
    const sameUnit = sale({
      ...otherUnit,
      listingKey: 'UNIT104',
      unitNumber: '104',
      closePrice: 480_000,
    })
    const town = sale({
      listingKey: 'TOWN',
      address: '11 Industrial',
      productClass: productClassFromFactsRow('attached', 'Townhouse'),
      beds: 1,
      baths: 1,
      sqft: 578,
      yearBuilt: 2023,
    })
    const out = walkPricingLadder(
      subject({
        streetAddress: '2745 Ordway',
        unitNumber: '104',
        subdivision: 'NorthWest Crossing',
        subdivisionNorm: 'northwest crossing',
        subdivisionSlug: 'arete',
        beds: 1,
        baths: 1,
        sqft: 578,
        yearBuilt: 2023,
        productClass: 'condo',
        propertySubType: 'Condominium',
      }),
      [otherUnit, sameUnit, town],
      { asOf: '2026-10-09' },
    )
    expect(out.comps.map((c) => c.listingKey)).toContain('UNIT207')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('UNIT104')
    expect(out.comps.map((c) => c.listingKey)).not.toContain('TOWN')
  })
})
