import { describe, expect, it } from 'vitest'
import {
  canonicalPlacePath,
  mergePlaceSameAs,
  PLACE_ENTITY_SAME_AS,
  placeEntitySameAs,
} from './place-entity-same-as'

describe('placeEntitySameAs', () => {
  it('resolves Bend by relative and absolute URL', () => {
    const relative = placeEntitySameAs('/cities/bend')
    const absolute = placeEntitySameAs('https://ryan-realty.com/cities/bend')
    expect(relative).toEqual(absolute)
    expect(relative).toContain('https://en.wikipedia.org/wiki/Bend,_Oregon')
    expect(relative).toContain('https://www.wikidata.org/wiki/Q671288')
  })

  it('resolves Tetherow to the official origin, not a blog path', () => {
    expect(placeEntitySameAs('/communities/tetherow')).toEqual(['https://tetherow.com'])
  })

  it('returns empty for an unmapped plat or unknown path', () => {
    expect(placeEntitySameAs('/subdivisions/deschutes-river-woods')).toEqual([])
    expect(placeEntitySameAs(undefined)).toEqual([])
  })

  it('every mapped path is unique and every sameAs is https', () => {
    const paths = PLACE_ENTITY_SAME_AS.map((row) => row.path)
    expect(new Set(paths).size).toBe(paths.length)
    for (const row of PLACE_ENTITY_SAME_AS) {
      expect(row.path.startsWith('/')).toBe(true)
      expect(row.sameAs.length).toBeGreaterThan(0)
      for (const href of row.sameAs) {
        expect(href.startsWith('https://')).toBe(true)
      }
    }
  })
})

describe('canonicalPlacePath', () => {
  it('strips origin and trailing slash', () => {
    expect(canonicalPlacePath('https://ryan-realty.com/cities/Bend/')).toBe('/cities/bend')
  })
})

describe('mergePlaceSameAs', () => {
  it('dedupes caller extras against the verified map', () => {
    const merged = mergePlaceSameAs('/cities/bend', [
      'https://en.wikipedia.org/wiki/Bend,_Oregon/',
      'https://www.bendoregon.gov',
    ])
    expect(merged?.filter((h) => h.includes('Bend,_Oregon'))).toHaveLength(1)
    expect(merged?.filter((h) => h.includes('bendoregon.gov'))).toHaveLength(1)
  })
})
