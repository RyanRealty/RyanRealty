import { describe, expect, it } from 'vitest'
import { FACTS_STANDALONE_MIN } from '@/lib/pricing/ladder'
import { MIN_COMPS } from '@/lib/cma/comps'
import {
  JUDGMENT_PRUNE_FLOOR,
  isHardProductExclusion,
  pricedSetAfterJudgment,
  pricingCompsAfterJudgment,
} from '@/lib/cma/judgment-prune'
import { isPriceTierExclusion } from '@/lib/cma/judge-consistency'

describe('pricedSetAfterJudgment — Matt ≥5 when the ladder already filled', () => {
  it('uses the document floor (5), not the pricing-unit floor (3)', () => {
    expect(JUDGMENT_PRUNE_FLOOR).toBe(FACTS_STANDALONE_MIN)
    expect(JUDGMENT_PRUNE_FLOOR).toBe(5)
    expect(MIN_COMPS).toBe(3)
    expect(JUDGMENT_PRUNE_FLOOR).toBeGreaterThan(MIN_COMPS)
  })

  it('refuses a 3-sale prune when the ladder already supplied eight', () => {
    const selected = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const vetted = ['a', 'b', 'c']
    expect(pricedSetAfterJudgment(selected, vetted)).toEqual(selected)
  })

  it('accepts a prune that still holds five closed sales', () => {
    const selected = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    const vetted = ['a', 'b', 'c', 'd', 'e']
    expect(pricedSetAfterJudgment(selected, vetted)).toEqual(vetted)
  })
})

const sale = (listingKey: string, yearBuilt: number, propertySubType = 'Townhouse') => ({
  listingKey,
  yearBuilt,
  propertySubType,
})

describe('pricing comps stay on the product the audit can defend', () => {
  const subject = { propertySubType: 'Townhouse', yearBuilt: 2015, newConstructionYn: false }
  const asOfYear = 2026

  it('does not price a new townhome the judge excluded when the keep list is under the floor', () => {
    const selected = [1, 2, 3, 4, 5].map((n) => sale(`new-${n}`, 2026))
    const verdicts = selected.map((c) => ({
      listingKey: c.listingKey,
      tier: 'exclude',
      basis: 'structure-type',
      reason: 'New townhome, not this rowhouse.',
    }))
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: [],
      verdicts,
      subject,
      minComps: MIN_COMPS,
      asOfYear,
    })
    expect(gated.comps).toEqual([])
    expect(gated.shortage).toBe(true)
    expect(gated.droppedProduct).toBe(5)
  })

  it('shortages when the only product-matched sale is one and the weighted one is a different product', () => {
    const matched = sale('mews', 2018, 'Condominium')
    const other = sale('pines', 2001, 'Condominium')
    const gated = pricingCompsAfterJudgment({
      selected: [other, matched],
      vetted: [matched],
      verdicts: [
        { listingKey: 'pines', tier: 'exclude', basis: 'structure-type', reason: 'Different condo product.' },
        { listingKey: 'mews', tier: 'weak', basis: 'not-excluded', reason: 'Same project.' },
      ],
      subject: { propertySubType: 'Condominium', yearBuilt: 2018, newConstructionYn: false },
      minComps: MIN_COMPS,
      asOfYear,
    })
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['mews'])
    expect(gated.shortage).toBe(true)
  })

  it('still prices a filled ladder when the judge keep is a price cut, not a product cut', () => {
    const selected = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((id, i) => sale(id, 2008 + i, 'Single Family Residence'))
    const vetted = selected.slice(0, 3)
    const verdicts = selected.map((c) => ({
      listingKey: c.listingKey,
      tier: vetted.some((v) => v.listingKey === c.listingKey) ? 'strong' : 'exclude',
      basis: vetted.some((v) => v.listingKey === c.listingKey) ? 'not-excluded' : 'price-tier',
      reason: 'Sold outside the dollar band.',
    }))
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted,
      verdicts,
      subject: { propertySubType: 'Single Family Residence', yearBuilt: 2010, newConstructionYn: false },
      minComps: MIN_COMPS,
      asOfYear,
    })
    expect(gated.shortage).toBe(false)
    expect(gated.droppedProduct).toBe(0)
    expect(gated.comps.map((c) => c.listingKey)).toEqual(selected.map((c) => c.listingKey))
  })

  it('drops a new build against a resale even when the judge kept it', () => {
    const selected = [sale('new', 2026), sale('resale', 2014), sale('resale-2', 2012), sale('resale-3', 2010)]
    const gated = pricingCompsAfterJudgment({
      selected,
      vetted: selected,
      verdicts: selected.map((c) => ({
        listingKey: c.listingKey,
        tier: 'strong',
        basis: 'not-excluded',
        reason: 'Kept.',
      })),
      subject,
      minComps: MIN_COMPS,
      asOfYear,
    })
    expect(gated.comps.map((c) => c.listingKey)).toEqual(['resale', 'resale-2', 'resale-3'])
    expect(gated.shortage).toBe(false)
    expect(gated.droppedProduct).toBe(1)
  })

  it('does not treat a same-street price cut as a product exclusion', () => {
    const price = {
      listingKey: 'twin',
      tier: 'exclude' as const,
      basis: 'price-tier' as const,
      reason: 'Sold at $246 a foot, outside the band.',
    }
    const product = {
      listingKey: 'pines',
      tier: 'exclude' as const,
      basis: 'structure-type' as const,
      reason: 'Different product on a street that shares the first word.',
    }
    expect(isPriceTierExclusion(price)).toBe(true)
    expect(isHardProductExclusion(price)).toBe(false)
    expect(isPriceTierExclusion(product)).toBe(false)
    expect(isHardProductExclusion(product)).toBe(true)
  })
})
