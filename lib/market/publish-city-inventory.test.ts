import { describe, expect, it } from 'vitest'
import { CITY_TILE_FETCH_LIMIT, publishCityInventory } from './publish-city-inventory'

describe('publishCityInventory', () => {
  it('uses the complete tile set when it is under the fetch cap (Terrebonne founding)', () => {
    expect(
      publishCityInventory({
        pulseCount: 6,
        pulseMedian: 725_000,
        tileCount: 24,
        tileMedian: 689_000,
        tileLimit: CITY_TILE_FETCH_LIMIT,
        tileFetchOk: true,
      }),
    ).toEqual({ count: 24, medianListPrice: 689_000, source: 'tiles' })
  })

  it('keeps the pulse when the tile fetch is empty or failed', () => {
    expect(
      publishCityInventory({
        pulseCount: 6,
        pulseMedian: 725_000,
        tileCount: 0,
        tileMedian: null,
        tileLimit: CITY_TILE_FETCH_LIMIT,
        tileFetchOk: false,
      }),
    ).toEqual({ count: 6, medianListPrice: 725_000, source: 'pulse' })
  })

  it('keeps the pulse when the tile fetch hit the cap', () => {
    expect(
      publishCityInventory({
        pulseCount: 1014,
        pulseMedian: 899_000,
        tileCount: CITY_TILE_FETCH_LIMIT,
        tileMedian: 880_000,
        tileLimit: CITY_TILE_FETCH_LIMIT,
        tileFetchOk: true,
      }),
    ).toEqual({ count: 1014, medianListPrice: 899_000, source: 'pulse' })
  })

  it('does not invent zero when pulse is missing and tiles are empty', () => {
    expect(
      publishCityInventory({
        pulseCount: null,
        pulseMedian: null,
        tileCount: 0,
        tileMedian: null,
        tileLimit: CITY_TILE_FETCH_LIMIT,
        tileFetchOk: false,
      }),
    ).toEqual({ count: null, medianListPrice: null, source: 'pulse' })
  })
})
