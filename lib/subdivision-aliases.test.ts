import { describe, expect, it } from 'vitest'
import { getSubdivisionMatchNames } from './subdivision-aliases'

describe('getSubdivisionMatchNames', () => {
  it('merges Crooked River Ranch registry Crr aliases', () => {
    const names = getSubdivisionMatchNames('Crooked River Ranch')
    expect(names).toEqual(expect.arrayContaining(['Crooked River Ranch', 'Crr', 'Crr 8', 'Crr3_C']))
  })

  it('still returns the hardcoded Pronghorn set', () => {
    expect(getSubdivisionMatchNames('Pronghorn')).toEqual(
      expect.arrayContaining(['Pronghorn', 'Pronghorn Resort', 'Pronghorn Golf Club']),
    )
  })
})
