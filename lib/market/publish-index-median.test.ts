import { describe, expect, it } from 'vitest'
import { formatIndexMedianUsd } from './publish-index-median'

describe('formatIndexMedianUsd', () => {
  it('prints exact whole dollars (La Pine founding)', () => {
    expect(formatIndexMedianUsd(499_900)).toBe('$499,900')
    expect(formatIndexMedianUsd(499_900)).not.toBe('$500,000')
  })

  it('withholds empty or non-positive values', () => {
    expect(formatIndexMedianUsd(null)).toBeNull()
    expect(formatIndexMedianUsd(0)).toBeNull()
    expect(formatIndexMedianUsd(-1)).toBeNull()
  })
})
