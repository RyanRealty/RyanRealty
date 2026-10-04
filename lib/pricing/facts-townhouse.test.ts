import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
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

  it('leaves single-family and condo queries on their own product_class', () => {
    expect(factsProductClauses('detached')).toEqual({ eq: ['product_class', 'detached'] })
    expect(factsProductClauses('condo')).toEqual({ eq: ['product_class', 'condo'] })
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
})
