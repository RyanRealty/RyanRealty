import { describe, expect, it } from 'vitest'
import {
  evidenceLine,
  overUnderPhrase,
  refuseCopy,
  listedReadSentence,
} from '@/lib/pricing/public-read-copy'

describe('overUnderPhrase', () => {
  it('names under, over, and in-line without a single public dollar', () => {
    expect(overUnderPhrase((700_000 - 725_000) / 725_000)).toBe('3% under the ask')
    expect(overUnderPhrase((750_000 - 725_000) / 725_000)).toBe('3% over the ask')
    expect(overUnderPhrase(0.004)).toBe('in line with the ask')
  })
})

describe('listedReadSentence', () => {
  it('talks about a range, not the comps close as the price', () => {
    expect(listedReadSentence(5, (700_000 - 725_000) / 725_000)).toBe(
      'Nearby sales put a close in this range. That is 3% under the ask.',
    )
  })
})

describe('evidenceLine', () => {
  it('counts the set', () => {
    expect(evidenceLine(5)).toBe('From 5 closed sales. The full analysis names each one.')
    expect(evidenceLine(1)).toBe('From 1 closed sale. The full analysis names each one.')
  })
})

describe('refuseCopy', () => {
  it('explains the three public refuses and hides the rest', () => {
    expect(refuseCopy('thin-set')).toMatch(/Not enough nearby sales/)
    expect(refuseCopy('new-construction')).toMatch(/new construction/)
    expect(refuseCopy('builder-phase')).toMatch(/builder phase/)
    expect(refuseCopy('facts-not-ready')).toBeNull()
    expect(refuseCopy('no-gla')).toBeNull()
  })
})
