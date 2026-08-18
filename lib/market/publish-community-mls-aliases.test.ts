import { describe, expect, it } from 'vitest'
import {
  communityAliasTilesForEntry,
  communityMlsAliasInventory,
  isCrrFamilySubdivisionName,
  isOrphanCrrIndexSubdivision,
  publishCanonicalCommunityName,
  publishedAliasAwareSet,
  registryEntryUsesMlsAliasScan,
  subdivisionMatchesCommunityAlias,
} from './publish-community-mls-aliases'

describe('subdivisionMatchesCommunityAlias', () => {
  it('matches Crr3_C and Crr 8 against the Crr family prefix', () => {
    expect(subdivisionMatchesCommunityAlias('Crr3_C', 'Crr')).toBe(true)
    expect(subdivisionMatchesCommunityAlias('Crr 8', 'Crr')).toBe(true)
    expect(subdivisionMatchesCommunityAlias('Crr10_C', 'Crr')).toBe(true)
    expect(subdivisionMatchesCommunityAlias('Crr', 'Crr')).toBe(true)
  })

  it('does not match unrelated prefixes', () => {
    expect(subdivisionMatchesCommunityAlias('Crosswater', 'Crr')).toBe(false)
    expect(subdivisionMatchesCommunityAlias('Crystal Ridge', 'Crr')).toBe(false)
  })

  it('keeps token-boundary matching for a full name', () => {
    expect(subdivisionMatchesCommunityAlias('Crooked River Ranch', 'Crooked River Ranch')).toBe(true)
    expect(subdivisionMatchesCommunityAlias('Crooked River Ranch North', 'Crooked River Ranch')).toBe(
      true,
    )
  })
})

describe('communityAliasTilesForEntry', () => {
  const entry = {
    slug: 'crooked-river-ranch',
    is_resort: false,
    subdivision_aliases: ['Crooked River Ranch', 'Crr', 'Crr 8'],
  }

  it('keeps this community’s Crr* tiles only', () => {
    const tiles = communityAliasTilesForEntry(entry, [
      { subdivisionName: 'Crr 8', listingKey: 'a' },
      { subdivisionName: 'Crr3_C', listingKey: 'b' },
      { subdivisionName: 'Terrebonne', listingKey: 'c' },
    ])
    expect(tiles.map((t) => t.listingKey)).toEqual(['a', 'b'])
  })
})

describe('registryEntryUsesMlsAliasScan', () => {
  it('is true only for non-resort Crr-family rows', () => {
    expect(
      registryEntryUsesMlsAliasScan({
        is_resort: false,
        subdivision_aliases: ['Crooked River Ranch', 'Crr'],
      }),
    ).toBe(true)
    expect(
      registryEntryUsesMlsAliasScan({
        is_resort: true,
        subdivision_aliases: ['Crr'],
      }),
    ).toBe(false)
    expect(
      registryEntryUsesMlsAliasScan({
        is_resort: false,
        subdivision_aliases: ['Oww', 'DrrhTrs'],
      }),
    ).toBe(false)
  })
})

describe('publishedAliasAwareSet', () => {
  it('pairs Crr-family tiles with the alias count, not an empty resort set', () => {
    const aliasTiles = [{ listPrice: 425_000 }, { listPrice: 399_000 }]
    expect(
      publishedAliasAwareSet({
        resortTiles: [],
        aliasTiles,
        resortCount: null,
      }),
    ).toEqual({ count: 2, tiles: aliasTiles })
  })
})

describe('communityMlsAliasInventory', () => {
  it('returns tiles for a non-resort Crr registry row', () => {
    const { tiles, useAliasTiles } = communityMlsAliasInventory(
      { is_resort: false, subdivision_aliases: ['Crr'] },
      [{ subdivisionName: 'Crr3_C' }, { subdivisionName: 'Tetherow' }],
    )
    expect(useAliasTiles).toBe(true)
    expect(tiles).toEqual([{ subdivisionName: 'Crr3_C' }])
  })
})

describe('publishCanonicalCommunityName', () => {
  it('rolls Crr* onto Crooked River Ranch and leaves other names', () => {
    expect(publishCanonicalCommunityName('Crr 10')).toBe('Crooked River Ranch')
    expect(publishCanonicalCommunityName('Tetherow')).toBe('Tetherow')
    expect(isCrrFamilySubdivisionName('Crr9_C')).toBe(true)
    expect(isOrphanCrrIndexSubdivision('Crr 2')).toBe(true)
    expect(isOrphanCrrIndexSubdivision('Crooked River Ranch')).toBe(false)
  })
})
