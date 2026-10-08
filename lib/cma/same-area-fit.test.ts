import { describe, expect, it } from 'vitest'
import { PRICE_SET_SQFT_BAND } from '@/lib/pricing/price-set'
import {
  roomNotedSentence,
  sameAreaAgeYears,
  sameAreaFit,
  SAME_AREA_AGE_YEARS,
  SAME_AREA_RADIUS_AGE_YEARS,
  SAME_AREA_SQFT_BAND,
  type SameAreaCandidate,
  type SameAreaSubject,
} from '@/lib/cma/same-area-fit'
import type { CompArea } from '@/lib/pricing/comp-area'

// 3177 Coho, the letter Matt read on 2026-10-07. Coordinates null so own
// ground is the plat or the street, not a GIS polygon.
const COHO: SameAreaSubject = {
  streetAddress: '3177 Coho',
  city: 'Bend',
  subdivision: 'Rooster Rock',
  subdivisionSlug: null,
  latitude: null,
  longitude: null,
  beds: 3,
  baths: 2,
  sqft: 1458,
  yearBuilt: 2018,
  propertySubType: 'Single Family Residence',
}

const AREA: CompArea = {
  kind: 'subdivisions',
  names: ['Rooster Rock', 'Madison Park'],
  radiusMiles: null,
  centre: { lat: 44.03, lng: -121.27 },
  source: 'test',
  sentence: 'Rooster Rock and the one subdivision next to it.',
}

// The one true competitor: 0.06 miles, 1,466 sqft, 2015, pending at $549K.
const ALDRICH: SameAreaCandidate = {
  address: '2820 Aldrich',
  city: 'Bend',
  subdivision: 'Rooster Rock',
  beds: 3,
  baths: 2,
  sqft: 1466,
  yearBuilt: 2015,
  propertySubType: 'Single Family Residence',
}

// Inside the Old Bend polygon (data/bend/bend-neighborhood-polygons.json).
const OLD_BEND: CompArea = {
  kind: 'neighborhood',
  names: ['Old Bend'],
  radiusMiles: null,
  centre: { lat: 44.0554, lng: -121.3153 },
  source: 'test',
  sentence: 'Old Bend, the neighborhood around your home.',
}

describe('sameAreaFit: the actives and expireds pass the area and the rules the sales passed (Matt 2026-10-07, rule 24)', () => {
  it('keeps 2820 Aldrich, the one true Coho competitor, with nothing to note', () => {
    expect(sameAreaFit(AREA, COHO, ALDRICH)).toEqual({ ok: true, ownPlat: true, roomDifference: [] })
  })

  it('refuses a home outside the sales area before it reads the rooms', () => {
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, subdivision: 'High Pointe' })).toEqual({
      ok: false,
      reason: 'area',
    })
    for (const plat of ['Owls', 'Oakview', "Eagle's Landing", 'Tamarack Park', 'Mountain View']) {
      expect(sameAreaFit(AREA, COHO, { ...ALDRICH, subdivision: plat, baths: 3 })).toEqual({
        ok: false,
        reason: 'area',
      })
    }
  })

  it('keeps a home in the other named plat, off the own plat', () => {
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, subdivision: 'Madison Park' })).toEqual({
      ok: true,
      ownPlat: false,
      roomDifference: [],
    })
  })

  it('applies rule 4: one room apart only on the own ground, kept and disclosed; two apart refused', () => {
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, baths: 3 })).toEqual({
      ok: true,
      ownPlat: true,
      roomDifference: ['baths'],
    })
    // No own ground without coordinates: not the plat, not the street.
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, baths: 3, subdivision: 'Madison Park' })).toEqual({
      ok: false,
      reason: 'rooms',
    })
    // One apart on both counts is two rooms.
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, beds: 2, baths: 3 })).toEqual({ ok: false, reason: 'rooms' })
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, beds: 5 })).toEqual({ ok: false, reason: 'rooms' })
  })

  it('holds the plat-wide living-area band, and lets an unknown size through', () => {
    // 2,100 against 1,458 is 44 percent.
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, sqft: 2100 })).toEqual({ ok: false, reason: 'size' })
    // 1,960 is 34.4 percent, inside the band.
    // 25% is the band for every home in the letter (Matt 2026-10-08): 1,960 sqft
    // is 34% over the 1,458 sqft subject and is no longer like yours; 1,800 (23%) is.
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, sqft: 1960 })).toEqual({ ok: false, reason: 'size' })
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, sqft: 1800 }).ok).toBe(true)
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, sqft: null }).ok).toBe(true)
  })

  it('holds the year band off the own plat, and never on it', () => {
    // 1988 against 2018 is 30 years, past the 25 the next-row rungs admit.
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, subdivision: 'Madison Park', yearBuilt: 1988 })).toEqual({
      ok: false,
      reason: 'age',
    })
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, yearBuilt: 1988 }).ok).toBe(true)
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, subdivision: 'Madison Park', yearBuilt: null }).ok).toBe(true)
  })

  it('refuses another product and lets a blank subtype through', () => {
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, propertySubType: 'Townhouse' })).toEqual({
      ok: false,
      reason: 'product',
    })
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, propertySubType: null }).ok).toBe(true)
  })

  it('applies the ADU wall the sales walk applies (Matt 2026-10-08, "ADU sale skips"), one way', () => {
    const adu = { ...ALDRICH, publicRemarks: 'Craftsman with a permitted detached ADU over the garage, both units rented.' }
    // A subject whose remarks state no ADU (or carry none) never shows an ADU home as like yours.
    expect(sameAreaFit(AREA, { ...COHO, publicRemarks: 'Space to build an ADU on the big lot.' }, adu)).toEqual({
      ok: false,
      reason: 'adu',
    })
    expect(sameAreaFit(AREA, COHO, adu)).toEqual({ ok: false, reason: 'adu' })
    // A subject with its own ADU keeps both kinds.
    const aduSubject = { ...COHO, publicRemarks: 'Home with a guest house out back.' }
    expect(sameAreaFit(AREA, aduSubject, adu).ok).toBe(true)
    expect(sameAreaFit(AREA, aduSubject, { ...ALDRICH, publicRemarks: 'Single level home.' }).ok).toBe(true)
    // A home whose remarks were not read states nothing, so it stays.
    expect(sameAreaFit(AREA, COHO, { ...ALDRICH, publicRemarks: null }).ok).toBe(true)
  })

  it('applies rule 23 off the remarks too: a duplex is another product, both ways, and unread remarks stay', () => {
    const duplex = { ...ALDRICH, publicRemarks: 'Updated duplex with an upper unit and a lower unit.' }
    expect(sameAreaFit(AREA, COHO, duplex)).toEqual({ ok: false, reason: 'product' })
    const duplexSubject = { ...COHO, publicRemarks: 'Duplex, both units rented.' }
    expect(sameAreaFit(AREA, duplexSubject, duplex).ok).toBe(true)
    expect(sameAreaFit(AREA, duplexSubject, { ...ALDRICH, publicRemarks: 'Single level home.' })).toEqual({
      ok: false,
      reason: 'product',
    })
    expect(sameAreaFit(AREA, duplexSubject, { ...ALDRICH, publicRemarks: null }).ok).toBe(true)
  })

  it('tests a neighborhood area by its polygon, with no year test, as the neighborhood rung has none', () => {
    const inside = { ...ALDRICH, subdivision: null, latitude: 44.0554, longitude: -121.3153 }
    expect(sameAreaFit(OLD_BEND, COHO, inside).ok).toBe(true)
    expect(sameAreaFit(OLD_BEND, COHO, { ...inside, yearBuilt: 1985 }).ok).toBe(true)
    expect(sameAreaFit(OLD_BEND, COHO, { ...inside, latitude: 44.2, longitude: -121.3 })).toEqual({
      ok: false,
      reason: 'area',
    })
  })

  it("holds the distance rungs' year band inside a radius area", () => {
    const circle: CompArea = {
      kind: 'radius',
      names: [],
      radiusMiles: 2,
      centre: { lat: 44.0554, lng: -121.3153 },
      source: 'test',
      sentence: 'Within two miles of your home.',
    }
    const inside = { ...ALDRICH, subdivision: null, latitude: 44.0554, longitude: -121.3153 }
    expect(sameAreaFit(circle, COHO, { ...inside, yearBuilt: 1990 }).ok).toBe(true)
    expect(sameAreaFit(circle, COHO, { ...inside, yearBuilt: 1985 })).toEqual({ ok: false, reason: 'age' })
  })

  it('skips the area test when there is no area', () => {
    expect(sameAreaFit(null, COHO, { ...ALDRICH, subdivision: 'High Pointe' }).ok).toBe(true)
  })

  it('reads its bands off the sales ladder, by the kind of area the sales sit in', () => {
    expect(SAME_AREA_AGE_YEARS).toBe(25)
    expect(SAME_AREA_RADIUS_AGE_YEARS).toBe(30)
    expect(SAME_AREA_SQFT_BAND).toBe(PRICE_SET_SQFT_BAND)
    expect(SAME_AREA_SQFT_BAND).toBe(0.25)
    expect(sameAreaAgeYears(AREA)).toBe(25)
    expect(sameAreaAgeYears(OLD_BEND)).toBeNull()
    expect(sameAreaAgeYears({ ...OLD_BEND, kind: 'community' })).toBeNull()
    expect(sameAreaAgeYears({ ...AREA, kind: 'radius', names: [], radiusMiles: 5 })).toBe(30)
    expect(sameAreaAgeYears({ ...AREA, kind: 'radius', names: [], radiusMiles: 15 })).toBeNull()
    expect(sameAreaAgeYears(null)).toBe(25)
  })

  it('keeps 1345 Jacksonville beside 1355 Jacksonville: a remarks list of options states no duplex and no ADU (reader review 2026-10-08)', () => {
    // The stored subject of cma-1355-jacksonville and its next-door
    // neighbor's MLS row (listing 220228911, Pending since Sep 21, 2026),
    // remarks as stored, line breaks included. The letter said "None are
    // under contract right now" because the fit refused this home as
    // another product.
    const area: CompArea = {
      kind: 'subdivisions',
      names: ['Northwest Townsite', 'Grandview', 'Highland', 'Bonne Home'],
      radiusMiles: null,
      centre: { lat: 44.058868, lng: -121.331289 },
      source: 'test',
      sentence: 'Northwest Townsite, your own subdivision, with Grandview, Highland and Bonne Home next to it.',
      platSlugs: ['northwest-townsite-second-addition'],
      namesWithoutPlat: ['Grandview', 'Highland', 'Bonne Home'],
    }
    const subject: SameAreaSubject = {
      streetAddress: '1355 Jacksonville',
      city: 'Bend',
      subdivision: 'Northwest Townsite',
      subdivisionSlug: 'northwest-townsite-second-addition',
      latitude: 44.058868,
      longitude: -121.331289,
      beds: 3,
      baths: 2,
      sqft: 876,
      yearBuilt: 1919,
      propertySubType: 'Single Family Residence',
      publicRemarks:
        "The lot's size and prime location support a range of possibilities, from an extensive renovation, to a full tear-down for a custom new home. There's also potential to add an ADU, all subject to city approval.",
    }
    const neighbor: SameAreaCandidate = {
      address: '1345 Jacksonville',
      city: 'Bend',
      subdivision: 'Northwest Townsite',
      latitude: 44.058868,
      longitude: -121.331052,
      beds: 3,
      baths: 1,
      sqft: 1056,
      yearBuilt: 1924,
      propertySubType: 'Single Family Residence',
      publicRemarks:
        'The property includes a 1924-built, 3-beds, 1-bath home with 1,056 sq ft that can be lived in as-is, renovated, or incorporated into a larger vision for the site. The generous lot may offer possibilities for a lot split, duplex, multi-unit development,\r\nADU, or new custom home, subject to City approval.\r\nStreet and alley frontage add flexibility for access, parking and site design.',
    }
    // Own plat, 1,056 sqft is 20.5% over 876 (inside 25%), one bathroom
    // apart on own ground: kept and disclosed, no year test on the own plat.
    expect(sameAreaFit(area, subject, neighbor)).toEqual({ ok: true, ownPlat: true, roomDifference: ['baths'] })
    // A home that does state a duplex or an ADU is still refused.
    expect(
      sameAreaFit(area, subject, { ...neighbor, publicRemarks: 'This updated duplex features two 2 bed units.' }),
    ).toEqual({ ok: false, reason: 'product' })
    expect(
      sameAreaFit(area, subject, { ...neighbor, publicRemarks: 'The property includes a detached ADU over the garage.' }),
    ).toEqual({ ok: false, reason: 'adu' })
  })

  it('names a noted room once, with no dollar value, and no em dash', () => {
    expect(roomNotedSentence([])).toBe('')
    expect(roomNotedSentence([{ address: '2820 Aldrich', roomDifference: ['baths'] }])).toBe(
      '2820 Aldrich is one bathroom different from yours. No dollar value is applied to the room.',
    )
    const two = roomNotedSentence([
      { address: '2820 Aldrich', roomDifference: ['beds'] },
      { address: '3163 Delmas', roomDifference: ['baths'] },
      { address: '3140 Coho', roomDifference: [] },
    ])
    expect(two).toBe(
      '2820 Aldrich is one bedroom different from yours. 3163 Delmas is one bathroom different from yours. No dollar value is applied to the room.',
    )
    expect(two).not.toMatch(/[—–]/)
  })
})
