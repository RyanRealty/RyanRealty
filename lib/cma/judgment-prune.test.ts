import { describe, expect, it } from 'vitest'
import { FACTS_STANDALONE_MIN } from '@/lib/pricing/ladder'
import { MIN_COMPS } from '@/lib/cma/comps'
import { JUDGMENT_PRUNE_FLOOR, pricedSetAfterJudgment } from '@/lib/cma/judgment-prune'

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
