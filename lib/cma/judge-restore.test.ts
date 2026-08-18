import { describe, expect, it } from 'vitest'
import { pricingKeysFromJudgment, restoreSoftExcludesToTarget } from '@/lib/cma/judge'
import type { CompVerdict } from '@/lib/cma/judge-consistency'

function v(over: Partial<CompVerdict> & Pick<CompVerdict, 'listingKey' | 'tier'>): CompVerdict {
  return { reason: 'fixture', ...over }
}

describe('restoreSoftExcludesToTarget', () => {
  it('restores a vintage exclude to weak when the kept set is under five', () => {
    const verdicts: CompVerdict[] = [
      v({ listingKey: 'A', tier: 'strong' }),
      v({ listingKey: 'B', tier: 'strong' }),
      v({ listingKey: 'C', tier: 'weak' }),
      v({ listingKey: 'D', tier: 'exclude', basis: 'vintage', reason: 'Built 1992.' }),
    ]
    const notes = restoreSoftExcludesToTarget(verdicts)
    expect(verdicts.find((x) => x.listingKey === 'D')?.tier).toBe('weak')
    expect(notes).toHaveLength(1)
  })

  it('restores an exclude with no basis when the set is under five', () => {
    const verdicts: CompVerdict[] = [
      v({ listingKey: 'A', tier: 'strong' }),
      v({ listingKey: 'B', tier: 'strong' }),
      v({ listingKey: 'C', tier: 'strong' }),
      v({ listingKey: 'D', tier: 'exclude', reason: 'Built 1992.' }),
    ]
    restoreSoftExcludesToTarget(verdicts)
    expect(verdicts.find((x) => x.listingKey === 'D')?.tier).toBe('weak')
  })

  it('restores a location or lot exclude when the set is under five', () => {
    const verdicts: CompVerdict[] = [
      v({ listingKey: 'A', tier: 'strong' }),
      v({ listingKey: 'B', tier: 'strong' }),
      v({ listingKey: 'C', tier: 'strong' }),
      v({ listingKey: 'LOT', tier: 'exclude', basis: 'lot', reason: 'Larger lot.' }),
      v({ listingKey: 'LOC', tier: 'exclude', basis: 'location', reason: '1.4 miles.' }),
    ]
    restoreSoftExcludesToTarget(verdicts)
    expect(verdicts.find((x) => x.listingKey === 'LOT')?.tier).toBe('weak')
    expect(verdicts.find((x) => x.listingKey === 'LOC')?.tier).toBe('weak')
  })

  it('leaves a different structure type out', () => {
    const verdicts: CompVerdict[] = [
      v({ listingKey: 'A', tier: 'strong' }),
      v({ listingKey: 'B', tier: 'strong' }),
      v({ listingKey: 'C', tier: 'strong' }),
      v({ listingKey: 'DUPLEX', tier: 'exclude', basis: 'structure-type', reason: 'Duplex.' }),
    ]
    restoreSoftExcludesToTarget(verdicts)
    expect(verdicts.find((x) => x.listingKey === 'DUPLEX')?.tier).toBe('exclude')
  })
})

describe('pricingKeysFromJudgment', () => {
  it('keeps a four-sale search when the judge calls the fourth a different location', () => {
    const keys = pricingKeysFromJudgment(['A', 'B', 'C', 'D'], [
      v({ listingKey: 'A', tier: 'strong' }),
      v({ listingKey: 'B', tier: 'strong' }),
      v({ listingKey: 'C', tier: 'weak' }),
      v({ listingKey: 'D', tier: 'exclude', basis: 'location', reason: 'Different market segment.' }),
    ])
    expect(keys).toEqual(['A', 'B', 'C', 'D'])
  })

  it('drops only a different structure type', () => {
    const keys = pricingKeysFromJudgment(['A', 'B', 'C', 'DUPLEX'], [
      v({ listingKey: 'A', tier: 'strong' }),
      v({ listingKey: 'B', tier: 'strong' }),
      v({ listingKey: 'C', tier: 'strong' }),
      v({ listingKey: 'DUPLEX', tier: 'exclude', basis: 'structure-type', reason: 'Duplex.' }),
    ])
    expect(keys).toEqual(['A', 'B', 'C'])
  })
})

describe('restoreSoftExcludesToTarget — already at five', () => {
  it('does nothing once five sales are already kept', () => {
    const verdicts: CompVerdict[] = [
      v({ listingKey: 'A', tier: 'strong' }),
      v({ listingKey: 'B', tier: 'strong' }),
      v({ listingKey: 'C', tier: 'strong' }),
      v({ listingKey: 'D', tier: 'strong' }),
      v({ listingKey: 'E', tier: 'strong' }),
      v({ listingKey: 'F', tier: 'exclude', basis: 'vintage', reason: 'Newer.' }),
    ]
    restoreSoftExcludesToTarget(verdicts)
    expect(verdicts.find((x) => x.listingKey === 'F')?.tier).toBe('exclude')
  })
})
