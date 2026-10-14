import { describe, expect, it } from 'vitest'
import {
  buildCompArea,
  compAreaBounds,
  compAreaContains,
  compAreaIn,
  compAreaPhrase,
  compAreaSlug,
  parentPlaceArea,
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
    // A similar-price plat is capped at four miles, not a touching plat
    // (3037 Purcell, 2026-10-07: "next to it" only where the plat touches).
    expect(area!.sentence).toBe(
      'Diamond Bar Ranch, your own subdivision, with Obsidian Estates and Cascade View within four miles of your home.',
    )
    expect(area!.sentence).not.toMatch(/next to it/)
  })

  it('keeps pocket rungs as named subdivisions, not a radius', () => {
    const sisters = { latitude: 44.2908, longitude: -121.5493 }
    const area = buildCompArea({
      subject: { ...sisters, subdivision: 'Rolling Horse Meadow', city: 'Sisters' },
      rungs: [rung('subdivision-3mo', 3), rung('pocket-6mo', 1)],
      keptComps: [
        comp('Rolling Horse Meadow', 'subdivision-3mo', sisters),
        comp('Rolling Horse Meadow', 'subdivision-3mo', sisters),
        comp('Rolling Horse Meadow', 'subdivision-3mo', sisters),
        comp('SaddleStone', 'pocket-6mo', sisters),
      ],
    })
    expect(area).not.toBeNull()
    expect(area!.kind).toBe('subdivisions')
    expect(area!.names).toEqual(['Rolling Horse Meadow', 'SaddleStone'])
    expect(area!.radiusMiles).toBeNull()
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
  it('names the subdivisions the printed sales sit in, and the ring that found the plat outside the subject\'s', () => {
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
    expect(area!.kind).toBe('subdivisions')
    expect(area!.names).toEqual(['Diamond Bar Ranch', 'Hayloft'])
    expect(area!.radiusMiles).toBeNull()
    // Hayloft was reached only by a distance rung, so it is not "next to"
    // Diamond Bar Ranch; it is named with the ring that found it (rule 17).
    expect(area!.sentence).toBe('Diamond Bar Ranch, your own subdivision, with Hayloft within one mile of your home.')
    expect(area!.sentence).not.toMatch(/next to it/)
  })

  it('keeps "next to it" for a touching plat and names the ring only for the plat a ring reached', () => {
    const area = buildCompArea({
      subject: { ...REDMOND, subdivision: 'Deschutes', city: 'Bend' },
      rungs: [rung('subdivision-12mo-wide', 2), rung('adjacent-sub-12mo', 1), rung('nearby-0.5mi-12mo', 1)],
      keptComps: [
        comp('Deschutes', 'subdivision-12mo-wide'),
        comp('Deschutes', 'subdivision-12mo-wide'),
        comp('Park Addition', 'adjacent-sub-12mo'),
        comp('Staats', 'nearby-0.5mi-12mo'),
      ],
    })
    expect(area!.kind).toBe('subdivisions')
    expect(area!.names).toEqual(['Deschutes', 'Park Addition', 'Staats'])
    expect(area!.sentence).toBe(
      'Deschutes, your own subdivision, with Park Addition next to it and Staats within 0.5 miles of your home.',
    )
  })

  it('names the subdivision when every sale is there, even if the rungs were a street and a distance ring', () => {
    const area = buildCompArea({
      subject: { ...REDMOND, subdivision: 'Copperstone', city: 'Bend' },
      rungs: [rung('own-street-24mo', 1), rung('beyond-2mi-12mo', 2)],
      keptComps: [
        comp('Copperstone', 'beyond-2mi-12mo'),
        comp('Copperstone', 'beyond-2mi-12mo'),
        comp('Copperstone', 'own-street-24mo'),
      ],
    })
    expect(area!.kind).toBe('subdivision')
    expect(area!.names).toEqual(['Copperstone'])
    expect(area!.radiusMiles).toBeNull()
    expect(area!.sentence).toBe('Copperstone, your own subdivision.')
    expect(area!.sentence).not.toMatch(/mile/)
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

describe('parentPlaceArea', () => {
  it('names the parent for the map label, never a competition area (Matt 2026-10-07)', () => {
    const area = parentPlaceArea({ latitude: 44.08554, longitude: -121.325841 })
    expect(area).not.toBeNull()
    expect(area!.kind).toBe('neighborhood')
    expect(area!.names).toEqual(['Awbrey Butte'])
    expect(area!.radiusMiles).toBeNull()
  })
})

describe('resolveCompetitionArea', () => {
  it('Bend: the sales plat is the one ring, never a radius ladder, the neighborhood polygon or the city (Matt 2026-10-07)', () => {
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
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe('subdivision')
    expect(rings[0]!.names).toEqual(['Park Addition'])
    expect(rings.filter((r) => r.kind === 'radius')).toEqual([])
    expect(rings.some((r) => r.kind === 'city' || r.kind === 'neighborhood')).toBe(false)
  })

  it('starts at the pocket and stops at the comp search reach when that reach is under five miles', () => {
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
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe('subdivision')
    expect(rings[0]!.names).toEqual(['Diamond Bar Ranch'])
    expect(rings.filter((r) => r.kind === 'radius')).toEqual([])
    expect(rings[0]!.centre).toBeTruthy()
  })

  it('keeps the one ring the sales already measured', () => {
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
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe(compArea.kind)
    expect(rings[0]!.radiusMiles).toBe(compArea.radiusMiles)
    expect(rings[0]!.names).toEqual(compArea.names)
  })

  it('widens a rural reach through five and ten, then the comp search, and stops at 15', () => {
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
    expect(rings).toHaveLength(1)
    expect(rings[0]!.radiusMiles).toBe(15)
    expect(rings[0]!.kind).toBe('radius')
    expect(rings[0]!.centre).toEqual({ lat: REDMOND.latitude, lng: REDMOND.longitude })
  })

  it('does not add a wider ring when the sales reach sits between five and ten', () => {
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
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe(compArea.kind)
    expect(rings[0]!.radiusMiles).toBe(compArea.radiusMiles)
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
    // No coordinates, no circle. The city is not a substitute.
    expect(rings).toEqual([])
    expect(rings.some((r) => r.kind === 'city')).toBe(false)
  })

  it('Oakside shape: Bend cap is 5 miles, so a 25 mile active cannot be a comp', () => {
    const compArea = buildCompArea({
      subject: { latitude: 44.06, longitude: -121.31, subdivision: 'Meridian', city: 'Bend' },
      rungs: [rung('subdivision-12mo', 4)],
      keptComps: [comp('Meridian', 'subdivision-12mo', { latitude: 44.06, longitude: -121.31 })],
    })!
    const rings = resolveCompetitionArea({
      compArea,
      subject: { latitude: 44.06, longitude: -121.31, city: 'Bend' },
      keptComps: [comp('Meridian', 'subdivision-12mo', { latitude: 44.061, longitude: -121.31 })],
    })
    expect(rings).toHaveLength(1)
    expect(rings[0]!.kind).toBe('subdivision')
    expect(rings.filter((r) => r.kind === 'radius')).toEqual([])
    expect(rings.some((r) => r.kind === 'city')).toBe(false)
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

  it('joins the plats on "or" for a negative sentence, and leaves one name and a radius alone (Matt 2026-10-07)', () => {
    const twoPlats = {
      kind: 'subdivisions' as const,
      names: ['Rooster Rock', 'Madison Park'],
      radiusMiles: null,
      centre: null,
      source: '',
      sentence: '',
    }
    expect(compAreaIn(twoPlats, { negative: true })).toBe('in Rooster Rock or Madison Park')
    expect(compAreaIn(twoPlats)).toBe('in Rooster Rock and Madison Park')
    expect(compAreaIn({ ...twoPlats, kind: 'subdivision', names: ['Purcell'] }, { negative: true })).toBe('in Purcell')
    expect(
      compAreaIn({ ...twoPlats, kind: 'radius', names: [], radiusMiles: 2, centre: { lat: 1, lng: 2 } }, { negative: true }),
    ).toBe('within two miles of your home')
  })
})

describe('the adjacent-plat rungs stay on those plats', () => {
  it('a sale from a touching plat names those subdivisions, and does not open the neighborhood', () => {
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
    expect(area.kind).toBe('subdivisions')
    expect(area.names).toEqual(['Kenwood', 'Roanoke', 'Bend View Addition'])
    expect(area.sentence).toBe('Kenwood, your own subdivision, with Roanoke and Bend View Addition next to it.')
  })

  it('stays on one subdivision when every sale carries that name, including a later phase', () => {
    const area = buildCompArea({
      subject: { ...OLD_BEND, subdivision: 'Copperstone', city: 'Bend' },
      rungs: [
        rung('own-street-24mo', 1),
        rung('subdivision-6mo', 1),
        rung('adjacent-sub-3mo', 2),
        rung('adjacent-sub-18mo', 1),
      ],
      keptComps: [
        comp('Copperstone', 'own-street-24mo', OLD_BEND),
        comp('Copperstone', 'subdivision-6mo', OLD_BEND),
        comp('Copperstone', 'adjacent-sub-3mo', OLD_BEND),
        comp('Copperstone', 'adjacent-sub-3mo', OLD_BEND),
        comp('Copperstone', 'adjacent-sub-18mo', OLD_BEND),
      ],
    })!
    expect(area.kind).toBe('subdivision')
    expect(area.names).toEqual(['Copperstone'])
    expect(area.sentence).toBe('Copperstone, your own subdivision.')
  })
})

/**
 * The reader review of 2026-10-07: 20676 Wild Rose, 3037 Purcell, 2382 Jackson.
 * Coordinates and recorded plat slugs are the stored render_args and the
 * geo_assign_batch reads of that day.
 */
describe('rule 24: the area is the subject plat and the plats the sales sit in, by polygon (2026-10-07)', () => {
  const WILD_ROSE = { latitude: 44.021047, longitude: -121.290318 }
  const wildRose = buildCompArea({
    subject: {
      ...WILD_ROSE,
      subdivision: 'Larkspur',
      subdivisionSlug: 'larkspur-village-phases-iii-and-iv',
      streetAddress: '20676 Wild Rose',
      city: 'Bend',
    },
    rungs: [
      rung('subdivision-24mo', 0),
      rung('adjacent-sub-12mo', 1),
      rung('closer-sub-9mo', 1),
      rung('closer-sub-18mo', 1),
      rung('pocket-6mo', 1),
      rung('nearby-1.25mi-3mo', 1),
    ],
    keptComps: [
      { subdivision: 'Chloe Estates', subdivisionSlug: 'chloe-estates', selectionTier: 'nearby-1.25mi-3mo', latitude: 44.023187, longitude: -121.282816 },
      { subdivision: 'South Point', subdivisionSlug: 'south-point', selectionTier: 'closer-sub-9mo', latitude: 44.02062, longitude: -121.294318 },
      { subdivision: 'Foxborough', subdivisionSlug: 'foxborough-phase-3', selectionTier: 'pocket-6mo', latitude: 44.023789, longitude: -121.292997 },
      { subdivision: 'Copper Springs', subdivisionSlug: 'copper-springs-estates-phase-1', selectionTier: 'adjacent-sub-12mo', latitude: 44.021491, longitude: -121.295155 },
      { subdivision: 'South Point', subdivisionSlug: 'south-point', selectionTier: 'closer-sub-18mo', latitude: 44.019928, longitude: -121.295156 },
    ],
  })!

  it("20676 Wild Rose: the subject's own subdivision is named first, though no sale sits there", () => {
    expect(wildRose.kind).toBe('subdivisions')
    expect(wildRose.names[0]).toBe('Larkspur')
    expect(wildRose.names).toEqual(['Larkspur', 'Chloe Estates', 'South Point', 'Foxborough', 'Copper Springs'])
    expect(wildRose.platSlugs).toContain('larkspur-village-phases-iii-and-iv')
    expect(wildRose.sentence).toBe(
      'Larkspur, your own subdivision, with Copper Springs next to it, South Point one subdivision further out, Foxborough within 0.35 miles of your home and Chloe Estates within 1.25 miles of your home.',
    )
    expect(wildRose.source).toContain('own subdivision Larkspur is in the area')
  })

  it('20676 Wild Rose: a Foxborough listing in a Foxborough plat no sale sits in is outside, by its polygon', () => {
    // Expired i (20653 Foxborough, foxborough-phase-1) and ii and pending C
    // (foxborough-phase-6) carry the MLS name the area names.
    expect(compAreaContains(wildRose, { subdivision: 'Foxborough', platSlug: 'foxborough-phase-1' })).toBe(false)
    expect(compAreaContains(wildRose, { subdivision: 'Foxborough', platSlug: 'foxborough-phase-6' })).toBe(false)
    // Active B sits in the plat the pocket sale sits in.
    expect(compAreaContains(wildRose, { subdivision: 'Foxborough', platSlug: 'foxborough-phase-3' })).toBe(true)
    // A home in the subject's own plat is in the area.
    expect(compAreaContains(wildRose, { subdivision: 'Larkspur', platSlug: 'larkspur-village-phases-iii-and-iv' })).toBe(true)
    // A phase of the subject's own ordinary subdivision is that plat (samePlat).
    expect(compAreaContains(wildRose, { subdivision: 'Larkspur', platSlug: 'larkspur-village-phases-i-and-ii' })).toBe(true)
    // No polygon holds the row, or nobody tested it: the MLS name decides.
    expect(compAreaContains(wildRose, { subdivision: 'Foxborough', platSlug: null })).toBe(true)
    expect(compAreaContains(wildRose, { subdivision: 'Foxborough' })).toBe(true)
    expect(compAreaContains(wildRose, { subdivision: 'Somewhere Else', platSlug: null })).toBe(false)
  })

  const PURCELL = { latitude: 44.080952, longitude: -121.272517 }
  const purcell = buildCompArea({
    subject: {
      ...PURCELL,
      subdivision: 'Silver Sage',
      subdivisionSlug: 'silver-sage-phase-i',
      streetAddress: '3037 Purcell',
      city: 'Bend',
    },
    rungs: [
      rung('own-street-24mo', 1),
      rung('subdivision-3mo', 1),
      rung('subdivision-6mo', 1),
      rung('subdivision-24mo', 1),
      rung('adjacent-sub-6mo', 1),
    ],
    keptComps: [
      { subdivision: 'Silver Sage', subdivisionSlug: 'silver-sage-phase-2', selectionTier: 'subdivision-3mo', latitude: 44.080803, longitude: -121.273575 },
      { subdivision: 'Silver Sage', subdivisionSlug: 'silver-sage-phase-i', selectionTier: 'subdivision-6mo', latitude: 44.082282, longitude: -121.272738 },
      { subdivision: 'Tamarack Park', subdivisionSlug: 'tamarack-park-east-phase-vi', selectionTier: 'adjacent-sub-6mo', latitude: 44.08161, longitude: -121.274366 },
      { subdivision: 'Silver Sage', subdivisionSlug: 'silver-sage-phase-i', selectionTier: 'subdivision-24mo', latitude: 44.081817, longitude: -121.272599 },
      { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-iii', selectionTier: 'own-street-24mo', latitude: 44.074665, longitude: -121.269784 },
    ],
  })!

  it('3037 Purcell: a plat only the own-street sale reached is named as the homes on your street, not as next to it', () => {
    expect(purcell.names).toEqual(['Silver Sage', 'Tamarack Park', 'Holliday Park'])
    expect(purcell.sentence).toBe(
      'Silver Sage, your own subdivision, with Tamarack Park next to it and the Holliday Park homes on your street.',
    )
    expect(purcell.sentence).not.toMatch(/two subdivisions next to it/)
    expect(purcell.street).toEqual({
      key: 'purcell',
      names: ['Holliday Park'],
      platSlugs: ['holliday-park-third-addition-phase-iii'],
    })
    expect(purcell.platSlugs).not.toContain('holliday-park-third-addition-phase-iii')
    expect(compAreaPhrase(purcell)).toBe('Silver Sage, Tamarack Park and your street in Holliday Park')
  })

  it('3037 Purcell: the own-street plat is not a whole-polygon license for the actives and expireds', () => {
    // 2382 Jackson and 2260 Indigo: Holliday Park, not on Purcell.
    expect(
      compAreaContains(purcell, { subdivision: 'Holliday Park', platSlug: 'holliday-park-third-addition-phase-iii', address: '2382 Jackson' }),
    ).toBe(false)
    expect(
      compAreaContains(purcell, { subdivision: 'Holliday Park', platSlug: 'holliday-park-third-addition-phase-ii', address: '2260 Indigo' }),
    ).toBe(false)
    // 2020 Hall: the older Holliday Park plat, not on Purcell.
    expect(compAreaContains(purcell, { subdivision: 'Holliday Park', platSlug: 'holliday-park', address: '2020 Hall' })).toBe(false)
    // A Holliday Park home on Purcell is on the street the sale was.
    expect(
      compAreaContains(purcell, { subdivision: 'Holliday Park', platSlug: 'holliday-park-third-addition-phase-iii', address: '2350 Purcell' }),
    ).toBe(true)
    // By name alone (no polygon) the street still binds.
    expect(compAreaContains(purcell, { subdivision: 'Holliday Park', platSlug: null, address: '2020 Hall' })).toBe(false)
    expect(compAreaContains(purcell, { subdivision: 'Holliday Park', platSlug: null, address: '2591 NE Purcell Blvd' })).toBe(true)
    // The touching plat is whole: a Tamarack Park East phase is in.
    expect(
      compAreaContains(purcell, { subdivision: 'Tamarack Park', platSlug: 'tamarack-park-east-phase-iv', address: '2923 Deborah' }),
    ).toBe(true)
    expect(compAreaContains(purcell, { subdivision: 'Silver Sage', platSlug: 'silver-sage-phase-i', address: '2110 Carrie' })).toBe(true)
  })

  const JACKSON = { latitude: 44.075079, longitude: -121.268868 }
  const jackson = buildCompArea({
    subject: {
      ...JACKSON,
      subdivision: 'Holliday Park',
      subdivisionSlug: 'holliday-park-third-addition-phase-iii',
      streetAddress: '2382 Jackson',
      city: 'Bend',
    },
    rungs: [rung('own-street-24mo', 1), rung('subdivision-9mo', 2), rung('subdivision-24mo', 1), rung('subdivision-24mo-wide', 1)],
    keptComps: [
      { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-ii', selectionTier: 'subdivision-9mo', latitude: 44.075936, longitude: -121.271063 },
      { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-ii', selectionTier: 'subdivision-9mo', latitude: 44.076059, longitude: -121.269702 },
      { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-iii', selectionTier: 'own-street-24mo', latitude: 44.075276, longitude: -121.270033 },
      { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-ii', selectionTier: 'subdivision-24mo-wide', latitude: 44.075577, longitude: -121.271089 },
      { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-iii', selectionTier: 'subdivision-24mo', latitude: 44.074665, longitude: -121.269784 },
    ],
  })!

  it("2382 Jackson: the subject's own street sale is not a street-only plat, and Holliday Park's plats are the area", () => {
    expect(jackson.kind).toBe('subdivision')
    expect(jackson.sentence).toBe('Holliday Park, your own subdivision.')
    expect(jackson.street).toBeNull()
    // 2574 Robinson sits in Phase I of the same Third Addition: one ordinary subdivision.
    expect(
      compAreaContains(jackson, { subdivision: 'Holliday Park', platSlug: 'holliday-park-third-addition-phase-i', address: '2574 Robinson' }),
    ).toBe(true)
    // 2020 Hall sits in the Holliday Park base plat, of which the Third
    // Addition is an addition: one subdivision family, inside the subject's
    // own neighborhood (Mountain View). Reader review 2026-10-08 (the letter
    // names the area "Holliday Park"; the MLS files 2020 Hall as Holliday
    // Park). It was outside before the family counted.
    expect(
      compAreaContains(jackson, {
        subdivision: 'Holliday Park',
        platSlug: 'holliday-park',
        address: '2020 Hall',
        latitude: 44.0764,
        longitude: -121.273521,
      }),
    ).toBe(true)
    // A family member is admitted only where its point sits inside the
    // subject's neighborhood polygon; a row with no point is not.
    expect(compAreaContains(jackson, { subdivision: 'Holliday Park', platSlug: 'holliday-park', address: '2020 Hall' })).toBe(false)
  })

  it('an area stored before plat keys existed still tests by name', () => {
    const legacy = { ...jackson, platSlugs: undefined, namesWithoutPlat: undefined, street: undefined }
    expect(compAreaContains(legacy, { subdivision: 'Holliday Park', platSlug: 'holliday-park' })).toBe(true)
  })

  it('a plat with no recorded polygon is tested by its name, even for a row a polygon holds', () => {
    const area = buildCompArea({
      subject: { ...JACKSON, subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-iii', city: 'Bend' },
      rungs: [rung('subdivision-9mo', 1), rung('adjacent-sub-6mo', 1)],
      keptComps: [
        { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-iii', selectionTier: 'subdivision-9mo' },
        { subdivision: 'Unplatted Acres', subdivisionSlug: null, selectionTier: 'adjacent-sub-6mo' },
      ],
    })!
    expect(area.namesWithoutPlat).toEqual(['Unplatted Acres'])
    expect(compAreaContains(area, { subdivision: 'Unplatted Acres', platSlug: 'some-other-plat' })).toBe(true)
    expect(compAreaContains(area, { subdivision: 'Holliday Park', platSlug: 'some-other-plat' })).toBe(false)
  })
})

describe('the area is the plats and their family, by polygon, whatever the MLS spelling (reader review 2026-10-08)', () => {
  // cma-915-saginaw's stored area: the subject's plat and the plats the five
  // printed sales sit in.
  const SAGINAW = { latitude: 44.06569, longitude: -121.32545 }
  const saginaw = buildCompArea({
    subject: { ...SAGINAW, subdivision: 'Park Place', subdivisionSlug: 'park-place', streetAddress: '915 Saginaw', city: 'Bend' },
    rungs: [rung('own-street-24mo', 1), rung('closer-sub-9mo', 1), rung('nearby-1.25mi-3mo', 3)],
    keptComps: [
      { subdivision: 'Miller Heights', subdivisionSlug: 'miller-heights-phase-ii', selectionTier: 'nearby-1.25mi-3mo' },
      { subdivision: 'Kenwood', subdivisionSlug: 'kenwood', selectionTier: 'closer-sub-9mo' },
      { subdivision: 'West Hills', subdivisionSlug: 'west-hills-fifth-addition', selectionTier: 'nearby-1.25mi-3mo' },
      { subdivision: 'Bend View', subdivisionSlug: 'bend-view-addition', selectionTier: 'nearby-1.25mi-3mo' },
      { subdivision: 'Bend View', subdivisionSlug: 'bend-view-addition', selectionTier: 'own-street-24mo' },
    ],
  })!

  it('733 Saginaw (MLS "Kenwood", recorded Kenwood First Addition, Pending $995,000) is in the area', () => {
    expect(saginaw.platSlugs).toContain('kenwood')
    expect(
      compAreaContains(saginaw, {
        subdivision: 'Kenwood',
        platSlug: 'kenwood-first-addition',
        latitude: 44.065697,
        longitude: -121.322645,
        address: '733 Saginaw',
      }),
    ).toBe(true)
  })

  it('1340 Trenton (MLS "West Hills", recorded West Hills, Pending $989,900) is in the area', () => {
    expect(saginaw.platSlugs).toContain('west-hills-fifth-addition')
    expect(
      compAreaContains(saginaw, {
        subdivision: 'West Hills',
        platSlug: 'west-hills',
        latitude: 44.06695,
        longitude: -121.331249,
        address: '1340 Trenton',
      }),
    ).toBe(true)
  })

  it('a namesake plat across town is not: Park Place Phase I sits in Southwest Bend', () => {
    expect(
      compAreaContains(saginaw, { subdivision: 'Park Place', platSlug: 'park-place-phase-i', latitude: 44.02324, longitude: -121.32792 }),
    ).toBe(false)
  })

  it('a plat no family ties to the area is still outside (Kenwood Gardens is not Kenwood)', () => {
    expect(
      compAreaContains(saginaw, { subdivision: 'Kenwood Gardens', platSlug: 'kenwood-gardens', latitude: 44.06411, longitude: -121.33142 }),
    ).toBe(false)
  })

  it('a street-only plat stays held to the street even through its family (3037 Purcell)', () => {
    const purcell = buildCompArea({
      subject: {
        latitude: 44.080952,
        longitude: -121.272517,
        subdivision: 'Silver Sage',
        subdivisionSlug: 'silver-sage-phase-i',
        streetAddress: '3037 Purcell',
        city: 'Bend',
      },
      rungs: [rung('own-street-24mo', 1), rung('subdivision-3mo', 1)],
      keptComps: [
        { subdivision: 'Silver Sage', subdivisionSlug: 'silver-sage-phase-2', selectionTier: 'subdivision-3mo' },
        { subdivision: 'Holliday Park', subdivisionSlug: 'holliday-park-third-addition-phase-iii', selectionTier: 'own-street-24mo' },
      ],
    })!
    // 2020 Hall: Holliday Park family, off Purcell.
    expect(
      compAreaContains(purcell, { subdivision: 'Holliday Park', platSlug: 'holliday-park', latitude: 44.0764, longitude: -121.273521, address: '2020 Hall' }),
    ).toBe(false)
  })
})

describe('a printed sale on the subject\'s own plat is named by the subject\'s subdivision (1355 Jacksonville)', () => {
  const JACKSONVILLE = { latitude: 44.058868, longitude: -121.331289 }
  it('"Northwest Townsite Co 2nd Addt" on the own plat is not a second place beside "Northwest Townsite"', () => {
    const area = buildCompArea({
      subject: { ...JACKSONVILLE, subdivision: 'Northwest Townsite', subdivisionSlug: 'northwest-townsite-second-addition', city: 'Bend' },
      rungs: [rung('subdivision-24mo', 1), rung('adjacent-subdivision-24mo', 1)],
      keptComps: [
        {
          subdivision: 'Northwest Townsite Co 2nd Addt',
          subdivisionSlug: 'northwest-townsite-second-addition',
          selectionTier: 'subdivision-24mo',
          ownPlat: true,
        },
        { subdivision: 'Grandview', subdivisionSlug: 'grandview', selectionTier: 'adjacent-subdivision-24mo' },
      ],
    })!
    expect(area.names).toEqual(['Northwest Townsite', 'Grandview'])
    expect(area.sentence).toBe('Northwest Townsite, your own subdivision, with Grandview next to it.')
    // And a listing on the own plat under either spelling is inside.
    expect(
      compAreaContains(area, {
        subdivision: 'Northwest Townsite Co 2nd Addt',
        platSlug: 'northwest-townsite-second-addition',
        latitude: 44.055588,
        longitude: -121.332439,
        address: '1425 Fresno',
      }),
    ).toBe(true)
  })

  it('a differently named sale off the own plat keeps its own name', () => {
    const area = buildCompArea({
      subject: { ...JACKSONVILLE, subdivision: 'Northwest Townsite', subdivisionSlug: 'northwest-townsite-second-addition', city: 'Bend' },
      rungs: [rung('adjacent-subdivision-24mo', 1)],
      keptComps: [{ subdivision: 'Highland', subdivisionSlug: 'highland', selectionTier: 'adjacent-subdivision-24mo', ownPlat: false }],
    })!
    expect(area.names).toEqual(['Northwest Townsite', 'Highland'])
  })
})
