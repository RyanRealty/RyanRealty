import { describe, expect, it } from 'vitest'
import {
  cmaSlugBase,
  cmaSlugForVersion,
  cmaSlugVersion,
  pickLatestCmaVersion,
  slugifyAddress,
} from './address-slug'

describe('slugifyAddress keeps street directionals', () => {
  it('keeps SE on 648 SE Douglas and does not collide with the stripped form', () => {
    expect(slugifyAddress('648 SE Douglas, Bend, OR 97702')).toBe('cma-648-se-douglas')
    expect(slugifyAddress('648 Douglas, Bend, OR 97702')).toBe('cma-648-douglas')
    expect(slugifyAddress('648 SE Douglas, Bend, OR 97702')).not.toBe(
      slugifyAddress('648 Douglas, Bend, OR 97702'),
    )
  })
})

describe('CMA slug version helpers', () => {
  it('version 1 is the bare base slug; later versions append -vN', () => {
    expect(cmaSlugForVersion('cma-123-main', 1)).toBe('cma-123-main')
    expect(cmaSlugForVersion('cma-123-main', 2)).toBe('cma-123-main--v2')
    expect(cmaSlugForVersion('cma-123-main', 10)).toBe('cma-123-main--v10')
  })

  it('cmaSlugBase strips the version suffix and is a no-op on base slugs', () => {
    expect(cmaSlugBase('cma-123-main--v2')).toBe('cma-123-main')
    expect(cmaSlugBase('cma-123-main--v10')).toBe('cma-123-main')
    expect(cmaSlugBase('cma-123-main')).toBe('cma-123-main')
  })

  it('cmaSlugVersion reads the version (1 when unversioned)', () => {
    expect(cmaSlugVersion('cma-123-main')).toBe(1)
    expect(cmaSlugVersion('cma-123-main--v2')).toBe(2)
    expect(cmaSlugVersion('cma-123-main--v12')).toBe(12)
  })

  it('round-trips with slugifyAddress output', () => {
    const base = slugifyAddress('20695 Town Dr, Bend')
    const v2 = cmaSlugForVersion(base, 2)
    expect(cmaSlugBase(v2)).toBe(base)
    expect(cmaSlugVersion(v2)).toBe(2)
  })

  it('pickLatestCmaVersion picks the highest version for the base only', () => {
    const rows = [
      { slug: 'cma-123-main' },
      { slug: 'cma-123-main--v3' },
      { slug: 'cma-123-main--v2' },
      // Prefix collisions must never match: a DIFFERENT address whose slug
      // merely starts with the base, and an unrelated versioned slug.
      { slug: 'cma-123-mainland' },
      { slug: 'cma-123-mainland--v5' },
    ]
    expect(pickLatestCmaVersion(rows, 'cma-123-main')?.slug).toBe('cma-123-main--v3')
    expect(pickLatestCmaVersion(rows, 'cma-123-mainland')?.slug).toBe('cma-123-mainland--v5')
    expect(pickLatestCmaVersion(rows, 'cma-nope')).toBeNull()
  })

  it('a real address ending in "V2" never reads as a version of another property', () => {
    // slugifyAddress collapses hyphen runs, so an address-derived slug can
    // contain a single-hyphen -v2 tail but NEVER the reserved --v2 suffix.
    const unitV2 = slugifyAddress('1500 NE Wells Acres Rd Unit V2, Bend')
    expect(unitV2.endsWith('-v2')).toBe(true)
    expect(unitV2.includes('--')).toBe(false)
    expect(cmaSlugVersion(unitV2)).toBe(1)
    expect(cmaSlugBase(unitV2)).toBe(unitV2)
    // And its own version chain works normally on top of that base.
    expect(cmaSlugForVersion(unitV2, 2)).toBe(`${unitV2}--v2`)
    expect(pickLatestCmaVersion([{ slug: unitV2 }], unitV2)?.slug).toBe(unitV2)
  })
})
