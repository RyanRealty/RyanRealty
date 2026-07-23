import { describe, it, expect } from 'vitest'
import {
  isPlausibleCityKey,
  isOutOfAreaCityKey,
  outOfAreaCitySlug,
  pickIndexableOutOfAreaCities,
  countOutOfAreaCitiesWithActiveAtLeast,
  OUT_OF_AREA_INDEXABLE_MIN_ACTIVE,
  OUT_OF_AREA_INDEXABLE_TOP_N,
  type OutOfAreaCity,
} from './out-of-area-cities'

function city(partial: Partial<OutOfAreaCity> & { name: string; activeAllCount: number }): OutOfAreaCity {
  return {
    slug: outOfAreaCitySlug(partial.name),
    activeSfrCount: partial.activeAllCount,
    medianListPrice: 400000,
    refreshedAt: '2026-07-22T00:00:00Z',
    ...partial,
  }
}

// Fixture mirroring the live feed's verified shape (audit 2026-06-10: medford
// 672 active, grants pass 619, klamath falls 589, ashland 246, plus long tail).
const FIXTURE: OutOfAreaCity[] = [
  city({ name: 'Medford', activeAllCount: 672 }),
  city({ name: 'Grants Pass', activeAllCount: 619 }),
  city({ name: 'Klamath Falls', activeAllCount: 589 }),
  city({ name: 'Ashland', activeAllCount: 246 }),
  city({ name: 'Chiloquin', activeAllCount: 38 }),
  city({ name: 'Winston', activeAllCount: 5 }),
  city({ name: 'Tiller', activeAllCount: 4 }),
  city({ name: 'Ashwood Flats', activeAllCount: 1 }),
]

describe('isPlausibleCityKey', () => {
  it('accepts real city keys', () => {
    for (const k of ['medford', 'klamath falls', "john day", 'coos bay', "o'brien", 'mt. angel']) {
      expect(isPlausibleCityKey(k), k).toBe(true)
    }
  })
  it('rejects feed noise and malformed keys', () => {
    for (const k of ['', ' ', 'other', 'unknown', 'n/a', 'see remarks', 'out of area', '97701', '12 oaks', 'x', 'a'.repeat(41), null, undefined]) {
      expect(isPlausibleCityKey(k as string | null | undefined), String(k)).toBe(false)
    }
  })
})

describe('isOutOfAreaCityKey', () => {
  it('marks service-area cities as in-area (space AND hyphen forms)', () => {
    for (const k of ['bend', 'la pine', 'la-pine', 'powell butte', 'black butte ranch', 'crooked river ranch']) {
      expect(isOutOfAreaCityKey(k), k).toBe(false)
    }
  })
  it('marks statewide feed cities as out-of-area', () => {
    for (const k of ['medford', 'grants pass', 'klamath falls', 'ashland', 'portland']) {
      expect(isOutOfAreaCityKey(k), k).toBe(true)
    }
  })
  it('handles null/empty as not out-of-area (nothing to build a page from)', () => {
    expect(isOutOfAreaCityKey(null)).toBe(false)
    expect(isOutOfAreaCityKey('')).toBe(false)
  })
})

describe('pickIndexableOutOfAreaCities', () => {
  it('keeps only cities with >= MIN_ACTIVE, sorted by count desc', () => {
    const picked = pickIndexableOutOfAreaCities(FIXTURE)
    expect(picked.map((c) => c.slug)).toEqual([
      'medford', 'grants-pass', 'klamath-falls', 'ashland', 'chiloquin', 'winston',
    ])
    // Winston sits exactly AT the threshold and stays; Tiller (4) is out.
    expect(picked.some((c) => c.slug === 'tiller')).toBe(false)
    expect(OUT_OF_AREA_INDEXABLE_MIN_ACTIVE).toBe(5)
  })

  it('is WIDENED to a 100-city cap (W12.4) — the ≥5-active threshold is the real bar', () => {
    // Pin the widened value so a regression to the old arbitrary top-25 fails CI.
    expect(OUT_OF_AREA_INDEXABLE_TOP_N).toBe(100)
  })

  it('caps at TOP_N with stable name tiebreak', () => {
    // Enough cities to actually exercise the cap regardless of its value.
    const many = Array.from({ length: OUT_OF_AREA_INDEXABLE_TOP_N + 20 }, (_, i) =>
      city({ name: `Town ${String(i).padStart(3, '0')}`, activeAllCount: 10 }),
    )
    const picked = pickIndexableOutOfAreaCities(many)
    expect(picked).toHaveLength(OUT_OF_AREA_INDEXABLE_TOP_N)
    // Equal counts -> alphabetical, so the emission set is deterministic.
    expect(picked[0].name).toBe('Town 000')
    expect(picked[picked.length - 1].name).toBe(`Town ${String(OUT_OF_AREA_INDEXABLE_TOP_N - 1).padStart(3, '0')}`)
  })

  it('does not mutate the input', () => {
    const copy = [...FIXTURE]
    pickIndexableOutOfAreaCities(FIXTURE)
    expect(FIXTURE).toEqual(copy)
  })
})

describe('countOutOfAreaCitiesWithActiveAtLeast', () => {
  it('counts the >= 5 cohort (the W12 prod-verifiable number)', () => {
    expect(countOutOfAreaCitiesWithActiveAtLeast(FIXTURE)).toBe(6)
    expect(countOutOfAreaCitiesWithActiveAtLeast(FIXTURE, 100)).toBe(4)
    expect(countOutOfAreaCitiesWithActiveAtLeast([], 5)).toBe(0)
  })
})
