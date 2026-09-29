import { describe, expect, it } from 'vitest'
import { cityFieldCaption } from './city-sections'

// cityFieldItems (city-field-items.ts) was retired 2026-08-29 (4025ed199,
// "city first screen is leftover face plus flagship split") when the city
// opening moved to PlaceSplitView; page.tsx no longer imports it. This file
// keeps the cityFieldCaption coverage below, which tests the live
// city-sections.ts builder.

describe('cityFieldCaption', () => {
  it('names the listed set and the one MoS verdict', () => {
    expect(
      cityFieldCaption({
        cityName: 'Bend',
        count: 248,
        mosLabel: '3.6',
        verdictKind: 'sellers',
        verdictLabel: "seller's market",
      }),
    ).toBe('The 248 newest single-family listings in Bend · 3.6 months of supply · a seller\'s market')
  })

  it('omits a verdict when MoS is absent', () => {
    expect(
      cityFieldCaption({
        cityName: 'Bend',
        count: 12,
        mosLabel: null,
        verdictKind: 'unknown',
        verdictLabel: 'unknown',
      }),
    ).toBe('The 12 newest single-family listings in Bend')
  })

  it('prints nothing for an empty set', () => {
    expect(
      cityFieldCaption({
        cityName: 'Bend',
        count: 0,
        mosLabel: '3.6',
        verdictKind: 'sellers',
        verdictLabel: "seller's market",
      }),
    ).toBeNull()
  })
})
