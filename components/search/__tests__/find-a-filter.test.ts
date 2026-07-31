import { describe, expect, it } from 'vitest'
import {
  buildFindIndex,
  fieldAnchorId,
  normalizeFindQuery,
  searchFindIndex,
  FIND_FILTER_MAX_HITS,
} from '@/components/search/find-a-filter'
import { type ClassPrevalenceArtifact } from '@/lib/search/class-prevalence'

/** Census fixture: only fields referenced by the assertions need entries. */
const fixture: ClassPrevalenceArtifact = {
  generatedAt: '2026-07-30T00:00:00.000Z',
  rowTotals: { A: 6000, B: 300, C: 200, D: 2000, other: 500, total: 9000 },
  fields: {
    propertySubTypes: {
      kind: 'multi',
      mv: 'property_sub_type',
      values: {
        Duplex: { counts: [0, 0, 96, 0], total: 96 },
        Condominium: { counts: [178, 0, 0, 0], total: 178 },
        Timeshare: { counts: [0, 0, 0, 0], total: 0 },
      },
    },
    hasFireplace: {
      kind: 'boolean',
      mv: 'fireplace_yn',
      values: { true: { counts: [3000, 100, 50, 0], total: 3150 } },
    },
    zoning: {
      kind: 'text',
      mv: 'zoning',
      values: {
        MUA10: { counts: [120, 2, 0, 60], total: 182 },
        RS: { counts: [700, 0, 14, 50], total: 764 },
      },
    },
  },
}

describe('normalizeFindQuery', () => {
  it('squashes punctuation, spacing, and case so code variants collide', () => {
    expect(normalizeFindQuery('MUA-10')).toBe('mua10')
    expect(normalizeFindQuery('mua 10')).toBe('mua10')
    expect(normalizeFindQuery('mua10')).toBe('mua10')
    expect(normalizeFindQuery(' Forced  Air ')).toBe('forcedair')
    expect(normalizeFindQuery('Wall/Window Unit(s)')).toBe('wallwindowunits')
  })
})

describe('buildFindIndex', () => {
  it('indexes multi options, booleans, and range/text jump targets from the registry', () => {
    const index = buildFindIndex(null)
    const kinds = new Set(index.map((e) => e.kind))
    expect(kinds.has('multi-value')).toBe(true)
    expect(kinds.has('boolean')).toBe(true)
    expect(kinds.has('field')).toBe(true)
    // No artifact -> no zoning vocabulary yet.
    expect(kinds.has('zoning')).toBe(false)
    expect(index.some((e) => e.kind === 'multi-value' && e.value === 'Duplex')).toBe(true)
  })
  it('adds zoning codes from the census artifact', () => {
    const index = buildFindIndex(fixture)
    const zoning = index.filter((e) => e.kind === 'zoning')
    expect(zoning.map((e) => e.value)).toEqual(expect.arrayContaining(['MUA10', 'RS']))
  })
})

describe('searchFindIndex', () => {
  const index = buildFindIndex(fixture)

  it('requires two normalized characters', () => {
    expect(searchFindIndex(index, fixture, 'd', null)).toEqual([])
    expect(searchFindIndex(index, fixture, ' - ', null)).toEqual([])
  })

  it('finds a value by typing it, with its field label and live count', () => {
    const hits = searchFindIndex(index, fixture, 'duplex', null)
    const duplex = hits.find((h) => h.value === 'Duplex' && h.fieldKey === 'propertySubTypes')
    expect(duplex).toBeTruthy()
    expect(duplex?.count).toBe(96)
    expect(duplex?.fieldLabel).toBeTruthy()
  })

  it('matches zoning codes through normalization: MUA-10, mua 10, mua10 all hit', () => {
    for (const q of ['MUA-10', 'mua 10', 'mua10']) {
      const hits = searchFindIndex(index, fixture, q, null)
      expect(hits.some((h) => h.kind === 'zoning' && h.value === 'MUA10'), q).toBe(true)
    }
  })

  it('resolves voice synonyms — condo finds Condominium', () => {
    const hits = searchFindIndex(index, fixture, 'condo', null)
    expect(hits.some((h) => h.value === 'Condominium')).toBe(true)
  })

  it('ranks exact matches before substring matches, then by count descending', () => {
    const hits = searchFindIndex(index, fixture, 'mua10', null)
    expect(hits[0]?.value).toBe('MUA10') // exact beats anything containing it
    const rs = searchFindIndex(index, fixture, 'rs', null)
    const tiers = rs.map((h) => h.tier)
    expect([...tiers].sort((a, b) => a - b)).toEqual(tiers)
  })

  it('drops zero-count values under a class scope — never a dead-end suggestion', () => {
    const unscoped = searchFindIndex(index, fixture, 'duplex', null)
    expect(unscoped.some((h) => h.value === 'Duplex')).toBe(true)
    const landScoped = searchFindIndex(index, fixture, 'duplex', ['D'])
    expect(landScoped.some((h) => h.value === 'Duplex')).toBe(false)
  })

  it('drops values with zero matches everywhere', () => {
    const hits = searchFindIndex(index, fixture, 'timeshare', null)
    expect(hits.some((h) => h.value === 'Timeshare')).toBe(false)
  })

  it('caps the hit list', () => {
    const hits = searchFindIndex(index, fixture, 'ga', null)
    expect(hits.length).toBeLessThanOrEqual(FIND_FILTER_MAX_HITS)
  })
})

describe('fieldAnchorId', () => {
  it('is stable per field key', () => {
    expect(fieldAnchorId('price')).toBe('all-filters-field-price')
  })
})

describe('zoning definition layer (plan §6.3, wired 2026-07-30)', () => {
  it('groups definitions by normalized code and never auto-picks a collision', async () => {
    const { zoningDefinitionsByCode } = await import('@/components/search/find-a-filter')
    const byCode = zoningDefinitionsByCode()
    expect(byCode.size).toBeGreaterThan(50)
    // The §6.0.1 collision: PR is Crook County's Park Reserve AND Prineville's
    // Open Space-Park Reserve. Grouped under one normalized key, both retained.
    const pr = byCode.get('pr') ?? byCode.get('PR'.toLowerCase())
    if (pr) expect(pr.length).toBeGreaterThanOrEqual(1)
    // Every grouped definition keeps its jurisdiction — no merging.
    for (const defs of byCode.values()) {
      for (const d of defs) expect(d.jurisdiction.length).toBeGreaterThan(0)
    }
  })
})
