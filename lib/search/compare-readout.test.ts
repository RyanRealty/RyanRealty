import { describe, expect, it } from 'vitest'
import { bandReadout } from './compare-readout'
import type { PpsfBand } from '@/components/search/ppsf-band'

const BAND: PpsfBand = { min: 200, max: 600, q1: 300, q3: 500, n: 12 }

describe('bandReadout', () => {
  it('says typical inside the middle half', () => {
    expect(bandReadout(BAND, 400)).toBe('Typical $/sqft for 12 homes on this map')
  })

  it('says lower below the middle half', () => {
    expect(bandReadout(BAND, 250)).toBe('Lower $/sqft than most of 12 homes on this map')
  })

  it('says higher above the middle half', () => {
    expect(bandReadout(BAND, 550)).toBe('Higher $/sqft than most of 12 homes on this map')
  })

  it('names a missing living area', () => {
    expect(bandReadout(BAND, null)).toBe('No living area reported')
  })
})
