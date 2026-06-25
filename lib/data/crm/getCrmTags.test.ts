import { describe, it, expect } from 'vitest'
import { tallyTagUsage } from './getCrmTags'

describe('tallyTagUsage', () => {
  it('counts each tag once per person', () => {
    const counts = tallyTagUsage([
      ['audience:seller', 'seller:hot'],
      ['audience:seller'],
      ['audience:buyer'],
    ])
    expect(counts.get('audience:seller')).toBe(2)
    expect(counts.get('seller:hot')).toBe(1)
    expect(counts.get('audience:buyer')).toBe(1)
  })

  it('counts a tag once even if it appears twice on one person', () => {
    const counts = tallyTagUsage([['dup', 'dup', 'other']])
    expect(counts.get('dup')).toBe(1)
    expect(counts.get('other')).toBe(1)
  })

  it('skips null/undefined arrays and empty strings', () => {
    const counts = tallyTagUsage([null, undefined, ['', 'real'], []])
    expect(counts.get('real')).toBe(1)
    expect(counts.has('')).toBe(false)
  })

  it('returns an empty map for no people', () => {
    expect(tallyTagUsage([]).size).toBe(0)
  })
})
