import { describe, expect, it } from 'vitest'
import {
  buildCompArea,
  compAreaBounds,
  compAreaContains,
  compAreaIn,
  compAreaPhrase,
  compAreaSlug,
  resolveCompetitionArea,
  rungRadiusMiles,
  type CompAreaKeptComp,
  type CompAreaRung,
} from '@/lib/pricing/comp-area'

const REDMOND = { latitude: 44.2726, longitude: -121.1739 }
// Inside the Old Bend polygon (data/bend/bend-neighborhood-polygons.json).
const OLD_BEND = { latitude: 44.0554, longitude: -121.3153 }
// Inside the Broken Top community polygon.
const BROKEN_TOP = { latitude: 44.044831, longitude: -121.372874 }

function rung(key: string, kept: number, added = kept): CompAreaRung {
  return { key, kept, added }
}

function comp(
  subdivision: string | null,
  selectionTier: string,
  at: { latitude: number; longitude: number } = REDMOND,
): CompAreaKeptComp {
  return { subdivision, selectionTier, latitude: at.latitude, longitude: at.longitude }
}

describe('rungRadiusMiles', () => {
  it('parses the miles the rung name carries', () => {
    expect(rungRadiusMiles('nearby-2mi-6mo')).toBe(2)
    expect(rungRadiusMiles('city-5mi-9mo')).toBe(5)
    expect(rungRadiusMiles('rural-15mi-24mo')).toBe(15)
  })

  it('knows the listings-ladder rungs whose cap is not in the name', () => {
    expect(rungRadiusMiles('competing-area-12mo')).toBe(2)
    expect(rungRadiusMiles('citywide-12mo')).toBe(5)
    expect(rungRadiusMiles('rural-county-12mo')).toBe(10)
    expect(rungRadiusMiles('rural-county-24mo')).toBe(15)
    expect(rungRadiusMiles('similar-sub-6mo')).toBe(4)
  })

  it('is null on the rungs that are not bounded by distance', () => {
    expect(rungRadiusMiles('subdivision-3mo')).toBeNull()
    expect(rungRadiusMiles('neighborhood-6mo')).toBeNull()
    expect(rungRadiusMiles('broker-selected')).toBeNull()
  })
})

describe('buildCompArea — every kept sale came from a subdivision rung', () => {
  it('names the one subdivision', () => {
    const area = buildCompArea({
      subject: { ...REDMOND, subdivision: 'Diamond Bar Ranch', city: 'Redmond' },
      rungs: [rung('subdivision-3mo', 3), rung('subdivision-6mo', 2)],
      keptComps: [
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-6mo'),
        comp('Diamond Bar Ranch', 'subdivision-6mo'),
      ],
    })
    expect(area).not.toBeNull()
    expect(area!.kind).toBe('subdivision')
    expect(area!.names).toEqual(['Diamond Bar Ranch'])
    expect(area!.radiusMiles).toBeNull()
    expect(area!.sentence).toBe('Diamond Bar Ranch, your own subdivision.')
  })

  it('names the union when similar subdivisions carried some of the sales', () => {
    const area = buildCompArea({
      subject: { ...REDMOND, subdivision: 'Diamond Bar Ranch', city: 'Redmond' },
      rungs: [rung('subdivision-3mo', 2), rung('similar-sub-6mo', 2)],
      keptComps: [
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Obsidian Estates', 'similar-sub-6mo'),
        comp('Cascade View', 'similar-sub-6mo'),
      ],
    })
    expect(area!.kind).toBe('subdivisions')
    expect(area!.names).toEqual(['Diamond Bar Ranch', 'Obsidian Estates', 'Cascade View'])
    expect(area!.sentence).toBe('Diamond Bar Ranch and the two subdivisions next to it.')
  })

  it('does not let an MLS placeholder become a place', () => {
    const area = buildCompArea({
      subject: { ...REDMOND, subdivision: 'N/A', city: 'Redmond' },
      rungs: [rung('nearby-1mi-6mo', 3)],
      keptComps: [
        comp('N/A', 'nearby-1mi-6mo'),
        comp('N/A', 'nearby-1mi-6mo'),
        comp(null, 'nearby-1mi-6mo'),
      ],
    })
    expect(area!.kind).toBe('radius')
    expect(area!.names).toEqual([])
    expect(area!.radiusMiles).toBe(1)
  })
})

describe('buildCompArea — a boundary rung supplied a kept sale', () => {
  it('takes the neighborhood the subject sits in', () => {
    const area = buildCompArea({
      subject: { ...OLD_BEND, subdivision: null, city: 'Bend' },
      rungs: [rung('subdivision-6mo', 1), rung('neighborhood-12mo', 4)],
      keptComps: [
        comp('Park Addition', 'subdivision-6mo', OLD_BEND),
        comp('Park Addition', 'neighborhood-12mo', OLD_BEND),
        comp(null, 'neighborhood-12mo', OLD_BEND),
        comp(null, 'neighborhood-12mo', OLD_BEND),
        comp(null, 'neighborhood-12mo', OLD_BEND),
      ],
    })
    expect(area!.kind).toBe('neighborhood')
    expect(area!.names).toEqual(['Old Bend'])
    expect(area!.centre).toEqual({ lat: OLD_BEND.latitude, lng: OLD_BEND.longitude })
    expect(area!.sentence).toBe('Old Bend, the neighborhood around your home.')
  })

  it('calls a resort community a community', () => {
    const area = buildCompArea({
      subject: { ...BROKEN_TOP, subdivision: null, city: 'Bend' },
      rungs: [rung('neighborhood-6mo', 3)],
      keptComps: [
        comp(null, 'neighborhood-6mo', BROKEN_TOP),
        comp(null, 'neighborhood-6mo', BROKEN_TOP),
        comp(null, 'neighborhood-6mo', BROKEN_TOP),
      ],
    })
    expect(area!.kind).toBe('community')
    expect(area!.names).toEqual(['Broken Top'])
    expect(area!.sentence).toBe('Broken Top, the community your home sits in.')
  })
})

describe('buildCompArea — otherwise the radius the widest kept rung used', () => {
  it('takes the widest rung that actually kept a sale, not the widest that ran', () => {
    const area = buildCompArea({
      subject: { ...REDMOND, subdivision: 'Diamond Bar Ranch', city: 'Redmond' },
      rungs: [rung('subdivision-3mo', 2), rung('nearby-1mi-6mo', 2), rung('city-5mi-9mo', 0, 6)],
      keptComps: [
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Hayloft', 'nearby-1mi-6mo'),
        comp('Hayloft', 'nearby-1mi-6mo'),
      ],
    })
    expect(area!.kind).toBe('radius')
    expect(area!.radiusMiles).toBe(1)
    expect(area!.sentence).toBe('Within one mile of your home.')
  })

  it('spells the miles the way a seller reads them', () => {
    const area = buildCompArea({
      subject: { ...REDMOND, subdivision: null, city: 'Redmond' },
      rungs: [rung('nearby-2mi-9mo', 4)],
      keptComps: [comp(null, 'nearby-2mi-9mo'), comp(null, 'nearby-2mi-9mo')],
    })
    expect(area!.sentence).toBe('Within two miles of your home.')
  })

  it('falls back to the city when nothing bounds the search', () => {
    const area = buildCompArea({
      subject: { latitude: null, longitude: null, subdivision: null, city: 'Redmond' },
      rungs: [rung('broker-selected', 3)],
      keptComps: [comp(null, 'broker-selected'), comp(null, 'broker-selected')],
    })
    expect(area!.kind).toBe('city')
    expect(area!.names).toEqual(['Redmond'])
    expect(area!.radiusMiles).toBeNull()
  })

  it('is null when no sale was kept', () => {
    expect(
      buildCompArea({
        subject: { ...REDMOND, subdivision: null, city: 'Redmond' },
        rungs: [rung('subdivision-3mo', 0, 4)],
        keptComps: [],
      }),
    ).toBeNull()
  })

  it('carries a source trace naming the rungs and the counts', () => {
    const area = buildCompArea({
      subject: { ...REDMOND, subdivision: 'Diamond Bar Ranch', city: 'Redmond' },
      rungs: [rung('subdivision-3mo', 3)],
      keptComps: [
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
      ],
    })
    expect(area!.source).toContain('subdivision-3mo')
    expect(area!.source).toContain('3 of 3')
  })
})

describe('resolveCompetitionArea', () => {
  it('is the neighborhood the subject sits in, even when the comps came from one subdivision', () => {
    const compArea = buildCompArea({
      subject: { ...OLD_BEND, subdivision: 'Park Addition', city: 'Bend' },
      rungs: [rung('subdivision-6mo', 3)],
      keptComps: [
        comp('Park Addition', 'subdivision-6mo', OLD_BEND),
        comp('Park Addition', 'subdivision-6mo', OLD_BEND),
        comp('Park Addition', 'subdivision-6mo', OLD_BEND),
      ],
    })!
    const rings = resolveCompetitionArea({
      compArea,
      subject: { ...OLD_BEND, city: 'Bend' },
      keptComps: [comp('Park Addition', 'subdivision-6mo', OLD_BEND)],
    })
    // A mapped boundary never widens — there is exactly one ring to try.
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe('neighborhood')
    expect(rings[0]!.names).toEqual(['Old Bend'])
  })

  it('is a single radius ring when the comp search itself never reached five miles', () => {
    const compArea = buildCompArea({
      subject: { ...REDMOND, subdivision: 'Diamond Bar Ranch', city: 'Redmond' },
      rungs: [rung('subdivision-3mo', 3)],
      keptComps: [
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
        comp('Diamond Bar Ranch', 'subdivision-3mo'),
      ],
    })!
    const rings = resolveCompetitionArea({
      compArea,
      subject: { ...REDMOND, city: 'Redmond' },
      keptComps: [
        // Half a mile north of the subject.
        comp('Diamond Bar Ranch', 'subdivision-3mo', {
          latitude: REDMOND.latitude + 0.0072,
          longitude: REDMOND.longitude,
        }),
      ],
    })
    // The comp search's own reach here is one mile — under five, so the
    // competition uses that one mile directly, nothing to widen into.
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe('radius')
    expect(rings[0]!.radiusMiles).toBe(1)
    expect(rings[0]!.centre).toEqual({ lat: REDMOND.latitude, lng: REDMOND.longitude })
  })

  it('never proposes a ring past the comp search reach it measured', () => {
    const compArea = buildCompArea({
      subject: { ...REDMOND, subdivision: null, city: 'Redmond' },
      rungs: [rung('nearby-1mi-6mo', 2)],
      keptComps: [comp(null, 'nearby-1mi-6mo'), comp(null, 'nearby-1mi-6mo')],
    })!
    const rings = resolveCompetitionArea({
      compArea,
      subject: { ...REDMOND, city: 'Redmond' },
      keptComps: [
        // ~2.4 miles north.
        comp(null, 'nearby-1mi-6mo', { latitude: REDMOND.latitude + 0.035, longitude: REDMOND.longitude }),
      ],
    })
    // Comp search reach rounds up to 2.5 miles here — still under five, so a
    // single ring at that reach, never widened past it.
    expect(rings).toHaveLength(1)
    expect(rings[0]!.radiusMiles).toBeGreaterThanOrEqual(2.5)
  })

  it('starts at five miles and widens toward ten, then the comp search reach, never past it', () => {
    const compArea = buildCompArea({
      subject: { ...REDMOND, subdivision: null, city: 'Redmond' },
      rungs: [rung('rural-15mi-24mo', 2)],
      keptComps: [comp(null, 'rural-15mi-24mo'), comp(null, 'rural-15mi-24mo')],
    })!
    expect(compArea.radiusMiles).toBe(15)
    const rings = resolveCompetitionArea({
      compArea,
      subject: { ...REDMOND, city: 'Redmond' },
      keptComps: [comp(null, 'rural-15mi-24mo', REDMOND)],
    })
    expect(rings.map((r) => r.radiusMiles)).toEqual([5, 10, 15])
    for (const r of rings) {
      expect(r.kind).toBe('radius')
      expect(r.centre).toEqual({ lat: REDMOND.latitude, lng: REDMOND.longitude })
    }
  })

  it('drops ten from the ladder when the comp search reach sits between five and ten', () => {
    const compArea = buildCompArea({
      subject: { ...REDMOND, subdivision: null, city: 'Redmond' },
      rungs: [rung('nearby-2mi-6mo', 2)],
      keptComps: [comp(null, 'nearby-2mi-6mo'), comp(null, 'nearby-2mi-6mo')],
    })!
    const rings = resolveCompetitionArea({
      compArea,
      subject: { ...REDMOND, city: 'Redmond' },
      keptComps: [
        // ~7.3 miles north — pushes the comp search reach to 7.5.
        comp(null, 'nearby-2mi-6mo', { latitude: REDMOND.latitude + 0.1058, longitude: REDMOND.longitude }),
      ],
    })
    expect(rings.map((r) => r.radiusMiles)).toEqual([5, 7.5])
  })

  it('never widens to the whole city', () => {
    const compArea = buildCompArea({
      subject: { latitude: null, longitude: null, subdivision: null, city: 'Redmond' },
      rungs: [rung('broker-selected', 2)],
      keptComps: [comp(null, 'broker-selected')],
    })!
    expect(compArea.kind).toBe('city')
    const rings = resolveCompetitionArea({
      compArea,
      subject: { latitude: null, longitude: null, city: 'Redmond' },
      keptComps: [comp(null, 'broker-selected')],
    })
    // With no coordinates there is no circle to draw, so the city is all that
    // is left — and it says so rather than pretending to a radius. Exactly
    // one ring: there is nothing to widen into.
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe('city')
  })
})

describe('compAreaPhrase', () => {
  it('reads inside a sentence', () => {
    expect(
      compAreaPhrase({
        kind: 'subdivision',
        names: ['Diamond Bar Ranch'],
        radiusMiles: null,
        centre: null,
        source: '',
        sentence: '',
      }),
    ).toBe('Diamond Bar Ranch')
    expect(
      compAreaPhrase({
        kind: 'radius',
        names: [],
        radiusMiles: 1,
        centre: { lat: 1, lng: 2 },
        source: '',
        sentence: '',
      }),
    ).toBe('within one mile of your home')
    expect(
      compAreaPhrase({
        kind: 'subdivisions',
        names: ['Diamond Bar Ranch', 'Obsidian Estates'],
        radiusMiles: null,
        centre: null,
        source: '',
        sentence: '',
      }),
    ).toBe('Diamond Bar Ranch and Obsidian Estates')
  })
})

describe('compAreaContains — one membership test for every read', () => {
  const subdivisions = buildCompArea({
    subject: { ...REDMOND, subdivision: 'Diamond Bar Ranch', city: 'Redmond' },
    rungs: [rung('subdivision-3mo', 2), rung('similar-sub-6mo', 1)],
    keptComps: [
      comp('Diamond Bar Ranch', 'subdivision-3mo'),
      comp('Diamond Bar Ranch', 'subdivision-3mo'),
      comp('Obsidian Estates', 'similar-sub-6mo'),
    ],
  })!

  it('keeps a row in one of the named subdivisions and drops the rest', () => {
    expect(compAreaContains(subdivisions, { subdivision: 'Diamond Bar Ranch' })).toBe(true)
    expect(compAreaContains(subdivisions, { subdivision: 'Obsidian Estates' })).toBe(true)
    expect(compAreaContains(subdivisions, { subdivision: 'Somewhere Else' })).toBe(false)
    expect(compAreaContains(subdivisions, { subdivision: 'N/A' })).toBe(false)
    expect(compAreaContains(subdivisions, { subdivision: null })).toBe(false)
  })

  const boundary = buildCompArea({
    subject: { ...OLD_BEND, subdivision: null, city: 'Bend' },
    rungs: [rung('neighborhood-6mo', 3)],
    keptComps: [
      comp(null, 'neighborhood-6mo', OLD_BEND),
      comp(null, 'neighborhood-6mo', OLD_BEND),
      comp(null, 'neighborhood-6mo', OLD_BEND),
    ],
  })!

  it('runs the same point-in-polygon the subject was placed by', () => {
    expect(compAreaSlug(boundary)).toBe('bend-old-bend')
    expect(compAreaContains(boundary, { latitude: OLD_BEND.latitude, longitude: OLD_BEND.longitude })).toBe(true)
    // Broken Top is a different polygon entirely.
    expect(compAreaContains(boundary, { latitude: BROKEN_TOP.latitude, longitude: BROKEN_TOP.longitude })).toBe(false)
    expect(compAreaContains(boundary, { latitude: null, longitude: null })).toBe(false)
  })

  it('gives the boundary a bounding box that is a superset of it', () => {
    const b = compAreaBounds(boundary)
    expect(b).not.toBeNull()
    expect(OLD_BEND.latitude).toBeGreaterThanOrEqual(b!.latMin)
    expect(OLD_BEND.latitude).toBeLessThanOrEqual(b!.latMax)
    expect(OLD_BEND.longitude).toBeGreaterThanOrEqual(b!.lngMin)
    expect(OLD_BEND.longitude).toBeLessThanOrEqual(b!.lngMax)
  })

  const circle = buildCompArea({
    subject: { ...REDMOND, subdivision: null, city: 'Redmond' },
    rungs: [rung('nearby-1mi-6mo', 3)],
    keptComps: [comp(null, 'nearby-1mi-6mo'), comp(null, 'nearby-1mi-6mo'), comp(null, 'nearby-1mi-6mo')],
  })!

  it('measures the radius in miles, not degrees', () => {
    // Half a mile north: in. Two miles north: out.
    expect(
      compAreaContains(circle, { latitude: REDMOND.latitude + 0.0072, longitude: REDMOND.longitude }),
    ).toBe(true)
    expect(
      compAreaContains(circle, { latitude: REDMOND.latitude + 0.029, longitude: REDMOND.longitude }),
    ).toBe(false)
    expect(compAreaBounds(circle)).not.toBeNull()
  })

  it('has no bounding box for an area scoped by name', () => {
    expect(compAreaBounds(subdivisions)).toBeNull()
  })
})

describe('compAreaIn', () => {
  it('does not put a preposition in front of one that has its own', () => {
    const named = {
      kind: 'neighborhood' as const,
      names: ['Old Bend'],
      radiusMiles: null,
      centre: null,
      source: '',
      sentence: '',
    }
    expect(compAreaIn(named)).toBe('in Old Bend')
    expect(
      compAreaIn({ ...named, kind: 'radius', names: [], radiusMiles: 2, centre: { lat: 1, lng: 2 } }),
    ).toBe('within two miles of your home')
  })
})

describe('the adjacent-plat rungs are boundary rungs', () => {
  it('a sale from a touching plat makes the area the neighborhood, and carries a 2-mile cap', () => {
    expect(rungRadiusMiles('adjacent-subdivision-6mo')).toBe(2)
    expect(rungRadiusMiles('adjacent-sub-12mo')).toBe(2)
    const area = buildCompArea({
      subject: { ...OLD_BEND, subdivision: 'Kenwood', city: 'Bend' },
      rungs: [rung('subdivision-6mo', 1), rung('adjacent-sub-6mo', 3)],
      keptComps: [
        comp('Kenwood', 'subdivision-6mo', OLD_BEND),
        comp('Roanoke', 'adjacent-sub-6mo', OLD_BEND),
        comp('Bend View Addition', 'adjacent-sub-6mo', OLD_BEND),
      ],
    })!
    expect(area.kind).toBe('neighborhood')
  })
})
