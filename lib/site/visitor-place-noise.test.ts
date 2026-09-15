import { describe, expect, it } from 'vitest'
import {
  firstVisitorPlaceLabel,
  isPermitGluedPlatSlug,
  isVisitorPlaceNoiseLabel,
  isVisitorPlaceNoiseSlug,
} from './visitor-place-noise'

describe('visitor-place-noise', () => {
  it('treats Undesignated in any case as noise', () => {
    expect(isVisitorPlaceNoiseLabel('Undesignated')).toBe(true)
    expect(isVisitorPlaceNoiseSlug('bend-undesignated')).toBe(true)
    expect(firstVisitorPlaceLabel('Undesignated', 'Stevens Ranch')).toBe('Stevens Ranch')
  })

  it('flags permit-glued plat slugs', () => {
    expect(isPermitGluedPlatSlug('stevens-ranch-phase-rs-1-plld20211070')).toBe(true)
    expect(isPermitGluedPlatSlug('stevens-ranch')).toBe(false)
  })
})
