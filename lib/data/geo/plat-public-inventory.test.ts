import { describe, expect, it } from 'vitest'
import {
  isDisplayablePlatName,
  platInventoryKey,
  registryChildPlats,
  rollupPlatPublicInventory,
  type RegistryPlat,
} from './plat-public-inventory'

const plats: RegistryPlat[] = [
  {
    slug: 'ridge-at-eagle-crest',
    name: 'Ridge At Eagle Crest',
    parent: 'Eagle Crest',
    parentSlug: 'eagle-crest',
    city: 'Redmond',
    citySlug: 'redmond',
  },
  {
    slug: 'the-ridge',
    name: 'The Ridge',
    parent: 'Sunriver',
    parentSlug: 'sunriver',
    city: 'Sunriver',
    citySlug: 'sunriver',
  },
]

describe('plat public inventory rollup', () => {
  it('keys a plat by city slug and plat slug', () => {
    expect(platInventoryKey('redmond', 'ridge-at-eagle-crest')).toBe(
      'redmond:ridge-at-eagle-crest',
    )
  })

  it('counts SFR rows per plat and medians the same priced set', () => {
    const rows = rollupPlatPublicInventory(
      [
        {
          listing_key: 'a',
          list_price: 800_000,
          subdivision_lower: 'ridge at eagle crest',
          city_lower: 'redmond',
        },
        {
          listing_key: 'b',
          list_price: 1_000_000,
          subdivision_lower: 'ridge at eagle crest',
          city_lower: 'redmond',
        },
        {
          listing_key: 'c',
          list_price: 1_200_000,
          subdivision_lower: 'ridge at eagle crest',
          city_lower: 'redmond',
        },
        {
          listing_key: 'd',
          list_price: null,
          subdivision_lower: 'the ridge',
          city_lower: 'sunriver',
        },
      ],
      plats,
    )
    const ridge = rows.find((r) => r.slug === 'ridge-at-eagle-crest')
    const theRidge = rows.find((r) => r.slug === 'the-ridge')
    expect(ridge?.activeCount).toBe(3)
    expect(ridge?.medianListPrice).toBe(1_000_000)
    expect(ridge?.listingKeys).toEqual(['a', 'b', 'c'])
    expect(ridge?.href).toBe('/subdivisions/ridge-at-eagle-crest')
    expect(theRidge?.activeCount).toBe(1)
    expect(theRidge?.medianListPrice).toBeNull()
  })

  it('does not mix a second plat or city into Ridge At Eagle Crest', () => {
    const rows = rollupPlatPublicInventory(
      [
        {
          listing_key: 'x',
          list_price: 500_000,
          subdivision_lower: 'the ridge',
          city_lower: 'sunriver',
        },
        {
          listing_key: 'y',
          list_price: 900_000,
          subdivision_lower: 'ridge at eagle crest',
          city_lower: 'redmond',
        },
        {
          listing_key: 'z',
          list_price: 700_000,
          subdivision_lower: 'ridge at eagle crest',
          city_lower: 'bend',
        },
      ],
      plats,
    )
    expect(rows.find((r) => r.slug === 'ridge-at-eagle-crest')?.activeCount).toBe(1)
    expect(rows.find((r) => r.slug === 'the-ridge')?.activeCount).toBe(1)
  })

  it('drops short MLS codes from the registry catalog', () => {
    expect(isDisplayablePlatName('BBR')).toBe(false)
    expect(isDisplayablePlatName('Ridge At Eagle Crest')).toBe(true)
    expect(registryChildPlats().some((p) => p.slug === 'ridge-at-eagle-crest')).toBe(true)
    expect(registryChildPlats().some((p) => p.slug === 'bbr')).toBe(false)
  })
})
