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

describe('one entity, one page', () => {
  it('never gives a Wikipedia or Wikidata entity to two paths', () => {
    const owner = new Map<string, string>()
    for (const row of PLACE_ENTITY_SAME_AS) {
      for (const href of row.sameAs) {
        if (!/wikipedia\.org|wikidata\.org/.test(href)) continue
        expect(owner.get(href), `${href} on ${row.path} and ${owner.get(href)}`).toBeUndefined()
        owner.set(href, row.path)
      }
    }
  })

  it('Sunriver: the community page (the town\'s one page) carries the town entity and names no resort business', () => {
    const sameAs = placeEntitySameAs('/communities/sunriver')
    expect(sameAs).toContain('https://www.wikidata.org/wiki/Q3459533')
    expect(sameAs).toContain('https://www.sunriverowners.org')
    expect(sameAs).not.toContain('https://www.wikidata.org/wiki/Q7641161')
    expect(sameAs).not.toContain('https://en.wikipedia.org/wiki/Sunriver_Resort')
    expect(placeEntitySameAs('/cities/sunriver')).toEqual([])
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
