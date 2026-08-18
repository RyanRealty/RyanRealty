import { describe, expect, it } from 'vitest'
import {
  communityAliasTilesForEntry,
  isCrrFamilySubdivisionName,
  isOrphanCrrIndexSubdivision,
  publishCanonicalCommunityName,
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

describe('publishCanonicalCommunityName', () => {
  it('rolls Crr* onto Crooked River Ranch and leaves other names', () => {
    expect(publishCanonicalCommunityName('Crr 10')).toBe('Crooked River Ranch')
    expect(publishCanonicalCommunityName('Tetherow')).toBe('Tetherow')
    expect(isCrrFamilySubdivisionName('Crr9_C')).toBe(true)
    expect(isOrphanCrrIndexSubdivision('Crr 2')).toBe(true)
    expect(isOrphanCrrIndexSubdivision('Crooked River Ranch')).toBe(false)
  })
})
