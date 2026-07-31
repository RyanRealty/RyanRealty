import { describe, expect, it } from 'vitest'
import {
  CULPRIT_MAX_CANDIDATES,
  culpritCandidates,
  draftWithoutCandidate,
  pickCulprit,
} from '@/components/search/zero-culprit'

describe('culpritCandidates', () => {
  it('lists active draft filters with the params to remove', () => {
    const candidates = culpritCandidates({
      minPrice: '500000',
      maxPrice: '750000',
      hasPool: '1',
      heatingTypes: 'Forced Air,Heat Pump',
      keywords: 'shop',
    })
    const byKey = Object.fromEntries(candidates.map((c) => [c.key, c]))
    expect(byKey.price?.params).toEqual(['minPrice', 'maxPrice'])
    expect(byKey.hasPool?.params).toEqual(['hasPool'])
    expect(byKey.heatingTypes?.params).toEqual(['heatingTypes'])
    expect(byKey.keywords?.params).toEqual(['keywords'])
  })

  it('puts propertyType first — class narrowing is the most common zeroer', () => {
    const candidates = culpritCandidates({ propertyType: 'multi-family', hasPool: '1' })
    expect(candidates[0]).toMatchObject({ key: 'propertyType', label: 'Multi-family' })
  })

  it('ignores empty and whitespace values', () => {
    expect(culpritCandidates({ hasPool: '', keywords: '  ' })).toEqual([])
  })

  it('caps the candidate list', () => {
    const draft: Record<string, string> = { propertyType: 'A' }
    for (const key of [
      'hasPool', 'hasView', 'hasWaterfront', 'hasFireplace', 'hasGolfCourse',
      'newConstruction', 'basement', 'horseProperty', 'seniorCommunity', 'noHoa',
    ]) {
      draft[key] = '1'
    }
    expect(culpritCandidates(draft).length).toBe(CULPRIT_MAX_CANDIDATES)
  })
})

describe('draftWithoutCandidate', () => {
  it('removes exactly the candidate params, leaving the rest', () => {
    const draft = { minPrice: '500000', maxPrice: '750000', hasPool: '1' }
    const [price] = culpritCandidates(draft)
    const next = draftWithoutCandidate(draft, price)
    expect(next).toEqual({ hasPool: '1' })
    // Pure: the input draft is untouched.
    expect(draft.minPrice).toBe('500000')
  })
})

describe('pickCulprit', () => {
  const candidate = (key: string) => ({ key, label: key, params: [key] })

  it('names the filter whose removal recovers the most matches', () => {
    const winner = pickCulprit([
      { candidate: candidate('a'), count: 12 },
      { candidate: candidate('b'), count: 240 },
      { candidate: candidate('c'), count: 3 },
    ])
    expect(winner).toMatchObject({ recovered: 240 })
    expect(winner?.candidate.key).toBe('b')
  })

  it('never suggests an action that itself yields zero or unknown', () => {
    expect(
      pickCulprit([
        { candidate: candidate('a'), count: 0 },
        { candidate: candidate('b'), count: null },
      ]),
    ).toBeNull()
  })
})
