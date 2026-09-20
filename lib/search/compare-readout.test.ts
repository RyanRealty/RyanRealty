import { describe, expect, it } from 'vitest'
import { bandReadout } from './compare-readout'
import type { PpsfBand } from '@/components/search/ppsf-band'

const BAND: PpsfBand = { min: 200, max: 600, q1: 300, q3: 500, n: 12 }

describe('bandReadout', () => {
  it('names the visible set and the dollars', () => {
    expect(bandReadout(BAND, 400)).toBe('$400/sqft · middle half of 12 on this map')
  })

  it('says below the middle half', () => {
    expect(bandReadout(BAND, 250)).toBe('$250/sqft · below middle half of 12 on this map')
  })

  it('says above the middle half', () => {
    expect(bandReadout(BAND, 550)).toBe('$550/sqft · above middle half of 12 on this map')
  })

  it('names a missing living area', () => {
    expect(bandReadout(BAND, null)).toBe('No living area vs 12 on this map')
  })
})
