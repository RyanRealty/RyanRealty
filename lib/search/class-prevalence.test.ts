import { describe, expect, it } from 'vitest'
import {
  PROPERTY_CLASS_LABELS,
  PROPERTY_CLASS_ORDER,
  SHOWN_MIN_COUNT,
  SHOWN_MIN_SHARE,
  assessValue,
  autoNarrowPropertyType,
  bestClassForValue,
  classesForPropertyType,
  classesOfSubTypes,
  countForClasses,
  propertyTypeCovers,
  propertyTypeDisplayLabel,
  propertyTypeValueForClass,
  shownThreshold,
  type ClassPrevalenceArtifact,
} from './class-prevalence'
import { SUBTYPE_TO_CLASS } from '@/lib/property-type'
import artifactJson from '@/data/search-metadata/class-prevalence.json'

const artifact = artifactJson as unknown as ClassPrevalenceArtifact

/** Minimal fixture so threshold tests do not depend on live data. */
const fixture: ClassPrevalenceArtifact = {
  generatedAt: '2026-07-30T00:00:00.000Z',
  rowTotals: { A: 6000, B: 300, C: 200, D: 2000, other: 500, total: 9000 },
  fields: {
    heatingTypes: {
      kind: 'multi',
      mv: 'heating_types',
      values: {
        'Forced Air': { counts: [4000, 200, 150, 0], total: 4400 },
        Geothermal: { counts: [10, 0, 0, 0], total: 10 },
        'Class B Only': { counts: [0, 40, 0, 0], total: 40, hint: ['B'] },
        'Hinted Everywhere': { counts: [0, 0, 0, 0], total: 0, hint: ['A', 'B'] },
      },
    },
    hasPool: {
      kind: 'boolean',
      mv: 'pool_yn',
      values: { true: { counts: [1100, 50, 10, 200], total: 1400 } },
    },
  },
}

describe('shownThreshold', () => {
  it('is the LOWER of 0.5% of class rows and 25 (plan §5)', () => {
    expect(shownThreshold(6000)).toBe(25) // 0.5% = 30 > 25
    expect(shownThreshold(200)).toBe(1) // 0.5% = 1
    expect(shownThreshold(2000)).toBe(10) // 0.5% = 10 < 25
  })
  it('never drops below 1, so a zero count is never prominent', () => {
    expect(shownThreshold(0)).toBe(1)
    expect(shownThreshold(50)).toBe(1)
  })
  it('constants match the plan §5 numbers', () => {
    expect(SHOWN_MIN_SHARE).toBe(0.005)
    expect(SHOWN_MIN_COUNT).toBe(25)
  })
})

describe('assessValue', () => {
  it('marks a live value shown and prominent at or above the threshold', () => {
    const a = assessValue(fixture, 'heatingTypes', 'Forced Air', ['A'])
    expect(a).toMatchObject({ state: 'shown', count: 4000, prominent: true })
  })
  it('keeps a below-threshold live value shown but not prominent (never a fabricated dead end)', () => {
    const a = assessValue(fixture, 'heatingTypes', 'Geothermal', ['A'])
    expect(a).toMatchObject({ state: 'shown', count: 10, prominent: false })
    expect(a?.threshold).toBe(25)
  })
  it('marks a zero-for-class value disabled-zero when the hint does not agree it is absent', () => {
    // No hint at all -> cannot agree -> disabled, never hidden.
    const a = assessValue(fixture, 'heatingTypes', 'Forced Air', ['D'])
    expect(a).toMatchObject({ state: 'disabled-zero', count: 0 })
  })
  it('hides only when zero AND the metadata hint excludes every selected class', () => {
    const hidden = assessValue(fixture, 'heatingTypes', 'Class B Only', ['A'])
    expect(hidden?.state).toBe('hidden')
    // Hint includes B -> under B..: zero does not apply (count 40), and under
    // a hinted-but-zero class the value stays disabled, not hidden.
    const disabled = assessValue(fixture, 'heatingTypes', 'Hinted Everywhere', ['A'])
    expect(disabled?.state).toBe('disabled-zero')
  })
  it('sums counts across a multi-class scope', () => {
    const a = assessValue(fixture, 'heatingTypes', 'Forced Air', ['A', 'B', 'C'])
    expect(a?.count).toBe(4350)
  })
  it('uses the artifact total under a null scope', () => {
    const a = assessValue(fixture, 'heatingTypes', 'Forced Air', null)
    expect(a?.count).toBe(4400)
  })
  it('returns null for a value the census has no entry for', () => {
    expect(assessValue(fixture, 'heatingTypes', 'Nonexistent', ['A'])).toBeNull()
    expect(assessValue(fixture, 'unknownField', 'Forced Air', ['A'])).toBeNull()
  })
  it('assesses booleans via their true entry', () => {
    const a = assessValue(fixture, 'hasPool', 'true', ['C'])
    expect(a).toMatchObject({ state: 'shown', count: 10 })
  })
})

describe('countForClasses', () => {
  it('sums the selected class counts', () => {
    const entry = fixture.fields.heatingTypes.values['Forced Air']
    expect(countForClasses(entry, ['B', 'C'])).toBe(350)
    expect(countForClasses(entry, null)).toBe(4400)
  })
})

describe('classesForPropertyType', () => {
  it('resolves the human values and raw codes', () => {
    expect(classesForPropertyType('Residential')).toEqual(['A', 'B', 'C'])
    expect(classesForPropertyType('Land')).toEqual(['D'])
    expect(classesForPropertyType('multi-family')).toEqual(['C'])
    expect(classesForPropertyType('a')).toEqual(['A'])
    expect(classesForPropertyType('B')).toEqual(['B'])
  })
  it('returns null for no filter and for classes without census coverage', () => {
    expect(classesForPropertyType('')).toBeNull()
    expect(classesForPropertyType(undefined)).toBeNull()
    expect(classesForPropertyType('Commercial')).toBeNull() // E-H, no A-D data
  })
})

describe('propertyTypeDisplayLabel', () => {
  it('labels codes with the class table names', () => {
    expect(propertyTypeDisplayLabel('A')).toBe('Residential')
    expect(propertyTypeDisplayLabel('b')).toBe('Manufactured')
    expect(propertyTypeDisplayLabel('multi-family')).toBe('Multi-family')
    expect(propertyTypeDisplayLabel('Land')).toBe('Land')
    expect(propertyTypeDisplayLabel('')).toBeNull()
    expect(propertyTypeDisplayLabel('garbage')).toBeNull()
  })
})

describe('sub-type auto-narrow (plan §4.5.3)', () => {
  it('maps selections to their classes', () => {
    expect(classesOfSubTypes(['Duplex'])).toEqual(['C'])
    expect(classesOfSubTypes(['Duplex', 'Townhouse'])).toEqual(['A', 'C'])
    expect(classesOfSubTypes(['Unknown Value'])).toEqual([])
  })
  it('narrows a single-class selection to that class', () => {
    expect(autoNarrowPropertyType(['Duplex'])).toBe('multi-family')
    expect(autoNarrowPropertyType(['Townhouse'])).toBe('A')
    expect(autoNarrowPropertyType(['In Park'])).toBe('B')
    expect(autoNarrowPropertyType(['Residential Lots'])).toBe('Land')
  })
  it('widens across residential classes to Residential', () => {
    expect(autoNarrowPropertyType(['Duplex', 'Townhouse'])).toBe('Residential')
    expect(autoNarrowPropertyType(['In Park', 'Condominium'])).toBe('Residential')
  })
  it('clears the class when the selection spans Land plus another class', () => {
    expect(autoNarrowPropertyType(['Duplex', 'Residential Lots'])).toBe('')
  })
  it('leaves the class alone when nothing is selected', () => {
    expect(autoNarrowPropertyType([])).toBeNull()
  })
  it('round-trips every class through propertyTypeValueForClass', () => {
    for (const cls of PROPERTY_CLASS_ORDER) {
      expect(classesForPropertyType(propertyTypeValueForClass(cls))).toEqual([cls])
    }
  })
})

describe('propertyTypeCovers', () => {
  it('treats the empty param as covering everything', () => {
    expect(propertyTypeCovers('', ['A', 'D'])).toBe(true)
    expect(propertyTypeCovers(undefined, ['C'])).toBe(true)
  })
  it('checks the class subset otherwise', () => {
    expect(propertyTypeCovers('Residential', ['C'])).toBe(true)
    expect(propertyTypeCovers('Residential', ['D'])).toBe(false)
    expect(propertyTypeCovers('Land', ['D'])).toBe(true)
    expect(propertyTypeCovers('Commercial', ['A'])).toBe(false)
  })
})

describe('bestClassForValue', () => {
  it('returns the class holding the most live matches', () => {
    expect(bestClassForValue(fixture, 'heatingTypes', 'Class B Only')).toBe('B')
    expect(bestClassForValue(fixture, 'heatingTypes', 'Forced Air')).toBe('A')
  })
  it('returns null with no counts or no entry', () => {
    expect(bestClassForValue(fixture, 'heatingTypes', 'Hinted Everywhere')).toBeNull()
    expect(bestClassForValue(fixture, 'heatingTypes', 'Nope')).toBeNull()
  })
})

describe('committed census artifact', () => {
  it('has the fixed class order and positive row totals', () => {
    expect(artifact.rowTotals.total).toBeGreaterThan(0)
    for (const cls of PROPERTY_CLASS_ORDER) {
      expect(artifact.rowTotals[cls]).toBeGreaterThan(0)
    }
  })
  it('carries every sub type with counts concentrated in its SUBTYPE_TO_CLASS class', () => {
    const values = artifact.fields.propertySubTypes?.values ?? {}
    for (const [value, cls] of Object.entries(SUBTYPE_TO_CLASS)) {
      const entry = values[value]
      expect(entry, `census missing sub type '${value}'`).toBeTruthy()
      PROPERTY_CLASS_ORDER.forEach((c, i) => {
        if (c !== cls) {
          expect(
            entry.counts[i],
            `'${value}' observed under class ${c}, SUBTYPE_TO_CLASS says ${cls}`,
          ).toBe(0)
        }
      })
    }
  })
  it('includes zoning values with per-class counts, capped at 200', () => {
    const zoning = artifact.fields.zoning?.values ?? {}
    const keys = Object.keys(zoning)
    expect(keys.length).toBeGreaterThan(0)
    expect(keys.length).toBeLessThanOrEqual(200)
    for (const key of keys.slice(0, 5)) {
      expect(zoning[key].counts).toHaveLength(4)
    }
  })
  it('labels every class', () => {
    for (const cls of PROPERTY_CLASS_ORDER) {
      expect(PROPERTY_CLASS_LABELS[cls]).toBeTruthy()
    }
  })
})
