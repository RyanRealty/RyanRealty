/**
 * Rental-and-income module tests.
 *
 * What these lock:
 *  - Every jurisdiction returns all three tenures, in order, with a citation,
 *    a URL, and at least one requirement on each.
 *  - The short-term entry is IMPORTED from lib/cma/development.ts and is never
 *    re-authored here (the EFU/Forest prohibition must survive the round trip).
 *  - The §0 income rule: no nightly rate, no occupancy, no cap rate, no yield,
 *    and every income row carries a non-empty basis.
 *  - An unknown jurisdiction degrades to 'confirm' on the locally-decided
 *    tenures and never claims a local permit or a local tax figure.
 *  - Brand voice: no em-dash, en-dash, semicolon, or exclamation mark anywhere
 *    in the rendered prose.
 */

import { describe, expect, it } from 'vitest'
import type { CmaSiteData } from './county'
import type { CmaSubject } from './types'
import { RENTAL_VERIFIED_DATE, resolveRentalPotential, type RentalPotential } from './rental-potential'

// ── Fixtures ────────────────────────────────────────────────────────────────

function subjectFixture(over: Partial<CmaSubject> = {}): CmaSubject {
  return {
    listingKey: null,
    mlsNumber: '220100001',
    streetAddress: '123 NW Example St',
    city: 'Bend',
    state: 'OR',
    postalCode: '97703',
    subdivision: null,
    latitude: 44.058,
    longitude: -121.315,
    beds: 3,
    baths: 2,
    sqft: 1800,
    lotAcres: 0.17,
    propertySubType: null,
    yearBuilt: 1998,
    garageSpaces: 2,
    photoUrl: null,
    publicRemarks: null,
    viewDescription: null,
    taxAnnual: 4210,
    standardStatus: 'Active',
    lastListPrice: 725000,
    lastListDate: null,
    listingHistoryLine: null,
    ...over,
  }
}

function siteFixture(over: Partial<CmaSiteData> = {}): CmaSiteData {
  return {
    taxAccount: '123456',
    taxlot: '171233AB01000',
    trs: '17-12-33',
    acreage: 0.17,
    zone: 'RS',
    zoneOverlays: [],
    overlays: [],
    wildfireHazard: false,
    flood: { zone: 'X', inSFHA: false },
    water: {
      source: 'municipal',
      providerName: 'City of Bend',
      wellLog: null,
      irrigationDistrict: null,
      rights: [],
      mappedIrrigationAcres: null,
      primaryIrrigationPriorityDate: null,
      hasPrivateAppurtenant: false,
      rightsQueryOk: true,
      rightsUsedPolygon: true,
    },
    septic: { status: 'municipal-sewer', permit: null },
    permits: [],
    entitlement: null,
    hunting: null,
    isMunicipal: true,
    insideUGB: true,
    publicLand: false,
    constraints: [],
    fieldConfirm: [],
    resolved: true,
    notes: [],
    citations: [],
    ...over,
  }
}

const bend = () => resolveRentalPotential(subjectFixture(), siteFixture())!

const redmond = () =>
  resolveRentalPotential(
    subjectFixture({ city: 'Redmond', postalCode: '97756' }),
    siteFixture({ zone: 'R-4' }),
  )!

const countyRural = () =>
  resolveRentalPotential(
    subjectFixture({ city: 'Bend', lotAcres: 5 }),
    siteFixture({ zone: 'RR-10', acreage: 5, isMunicipal: false, insideUGB: false, septic: { status: 'installed', permit: '247-98' }, water: { ...siteFixture().water, source: 'well', providerName: null } }),
  )!

const resort = () =>
  resolveRentalPotential(
    subjectFixture({ city: 'Sunriver', subdivision: 'Sunriver', postalCode: '97707' }),
    siteFixture({ zone: 'RR-10', acreage: 0.35, isMunicipal: false, insideUGB: false }),
  )!

const farmland = () =>
  resolveRentalPotential(
    subjectFixture({ city: 'Terrebonne', lotAcres: 40 }),
    siteFixture({ zone: 'EFUTRB', acreage: 40, isMunicipal: false, insideUGB: false }),
  )!

const forest = () =>
  resolveRentalPotential(
    subjectFixture({ city: 'Sisters', lotAcres: 20 }),
    siteFixture({ zone: 'F-2', acreage: 20, isMunicipal: false, insideUGB: false }),
  )!

/** No site record at all: city limits cannot be confirmed. */
const unknownJurisdiction = () => resolveRentalPotential(subjectFixture({ city: 'Portland' }), null)!

const ALL: Array<[string, () => RentalPotential]> = [
  ['Bend', bend],
  ['Redmond', redmond],
  ['county rural', countyRural],
  ['resort', resort],
  ['EFU farmland', farmland],
  ['forest', forest],
  ['unknown jurisdiction', unknownJurisdiction],
]

const tenureOf = (r: RentalPotential, name: 'Long-term' | 'Mid-term' | 'Short-term') =>
  r.tenures.find((t) => t.tenure === name)!

const prose = (r: RentalPotential) =>
  [
    r.jurisdiction,
    r.economicsNote,
    r.disclaimer,
    ...r.tenures.flatMap((t) => [t.headline, t.detail, t.citation, ...t.requirements]),
    ...r.income.flatMap((i) => [i.label, i.value, i.basis]),
    ...r.marketingHighlights.flatMap((h) => [h.headline, h.basis]),
  ].join('\n')

/**
 * Prose this module AUTHORS. The short-term headline, detail, and citation are
 * imported verbatim from lib/cma/development.ts, which another module owns, so
 * the brand-voice check scopes to what is written here. Its requirements are
 * ours and stay in scope.
 */
const authoredProse = (r: RentalPotential) =>
  [
    r.jurisdiction,
    r.economicsNote,
    r.disclaimer,
    ...r.tenures
      .filter((t) => t.tenure !== 'Short-term')
      .flatMap((t) => [t.headline, t.detail, t.citation, ...t.requirements]),
    ...r.tenures.filter((t) => t.tenure === 'Short-term').flatMap((t) => t.requirements),
    ...r.income.flatMap((i) => [i.label, i.value, i.basis]),
    ...r.marketingHighlights.flatMap((h) => [h.headline, h.basis]),
  ].join('\n')

// ── Shape ───────────────────────────────────────────────────────────────────

describe('resolveRentalPotential shape', () => {
  it.each(ALL)('%s returns all three tenures in order with citations', (_label, build) => {
    const r = build()
    expect(r.tenures.map((t) => t.tenure)).toEqual(['Long-term', 'Mid-term', 'Short-term'])
    for (const t of r.tenures) {
      expect(t.headline.length).toBeGreaterThan(10)
      expect(t.detail.length).toBeGreaterThan(80)
      expect(t.requirements.length).toBeGreaterThan(0)
      expect(t.citation.length).toBeGreaterThan(5)
      expect(t.url).toMatch(/^https:\/\//)
      expect(['yes', 'conditional', 'unlikely', 'no', 'confirm']).toContain(t.verdict)
    }
    expect(r.economicsNote.length).toBeGreaterThan(200)
    expect(r.verifiedAsOf).toBe(RENTAL_VERIFIED_DATE)
    expect(r.disclaimer.length).toBeGreaterThan(100)
  })

  it('returns null for a property outside Oregon', () => {
    expect(resolveRentalPotential(subjectFixture({ state: 'WA', city: 'Vancouver' }), null)).toBeNull()
  })

  it('names the jurisdiction it resolved', () => {
    expect(bend().jurisdiction).toBe('City of Bend')
    expect(redmond().jurisdiction).toBe('City of Redmond')
    expect(countyRural().jurisdiction).toBe('Deschutes County (unincorporated)')
    expect(unknownJurisdiction().jurisdiction).toContain('city limits not confirmed')
  })
})

// ── Long-term ───────────────────────────────────────────────────────────────

describe('long-term tenure', () => {
  it.each(ALL)('%s: long-term is available and cites the statewide act', (_label, build) => {
    const lt = tenureOf(build(), 'Long-term')
    expect(lt.verdict).toBe('yes')
    expect(lt.citation).toContain('ORS 90.323')
    expect(lt.citation).toContain('ORS 90.427')
    expect(lt.citation).toContain('ORS 91.225')
  })

  it('carries the published maximum rent increase with its year', () => {
    const lt = tenureOf(bend(), 'Long-term')
    expect(lt.detail).toContain('9.5%')
    expect(lt.detail).toContain('2026')
    expect(lt.requirements.join(' ')).toContain('90 days written notice')
    expect(lt.requirements.join(' ')).toContain('31 days')
    expect(lt.requirements.join(' ')).toContain('four or fewer residential dwelling units')
  })

  it('adds the Bend local tenant-protection layer, and only in Bend', () => {
    const bendSteps = tenureOf(bend(), 'Long-term').requirements.join(' ')
    expect(bendSteps).toContain('5.60.010')
    expect(bendSteps).toContain('three months rent')
    expect(tenureOf(bend(), 'Long-term').citation).toContain('Bend Code 5.60')
    expect(tenureOf(redmond(), 'Long-term').requirements.join(' ')).not.toContain('5.60')
    expect(tenureOf(countyRural(), 'Long-term').requirements.join(' ')).not.toContain('5.60')
  })

  it('states the first-year line rather than a blanket just-cause claim', () => {
    const lt = tenureOf(bend(), 'Long-term')
    expect(lt.detail).toContain('first year')
    expect(lt.detail).toContain('30 days written notice')
  })
})

// ── Mid-term ────────────────────────────────────────────────────────────────

describe('mid-term tenure', () => {
  it('gets the dividing line right: 45-day vacation occupancy, three tests', () => {
    const mt = tenureOf(bend(), 'Mid-term')
    expect(mt.verdict).toBe('yes')
    expect(mt.detail).toContain('45 days')
    expect(mt.detail).toContain('principal residence')
    expect(mt.detail).toContain('all three')
    expect(mt.citation).toContain('ORS 90.100')
    expect(mt.citation).toContain('ORS 90.110')
  })

  it('separates the local permit line from the state tenancy line', () => {
    const mt = tenureOf(bend(), 'Mid-term')
    expect(mt.detail).toContain('30 consecutive days')
    // The 30-day lodging-tax exemption is ORS 320.308(6), not ORS 320.305.
    expect(mt.citation).toContain('ORS 320.308(6)')
    expect(mt.citation).toContain('Bend Development Code Ch. 1.2')
    expect(tenureOf(redmond(), 'Mid-term').citation).toContain('Redmond City Code 7.134')
    expect(tenureOf(countyRural(), 'Mid-term').citation).toContain('Deschutes County Code 4.08.050')
  })

  it('carries the county monthly-billing rule, which is stricter than the day count', () => {
    expect(tenureOf(countyRural(), 'Mid-term').detail).toContain('monthly basis')
  })

  it('stays open on farm and forest land where nightly rental is prohibited', () => {
    for (const build of [farmland, forest]) {
      const r = build()
      expect(tenureOf(r, 'Short-term').verdict).toBe('no')
      expect(tenureOf(r, 'Mid-term').verdict).toBe('yes')
      expect(tenureOf(r, 'Long-term').verdict).toBe('yes')
    }
  })

  it('degrades to confirm when the jurisdiction is unknown', () => {
    const mt = tenureOf(unknownJurisdiction(), 'Mid-term')
    expect(mt.verdict).toBe('confirm')
    // The state half is still stated, because it is statewide and certain.
    expect(mt.detail).toContain('45 days')
    // The local half must not be asserted.
    expect(mt.detail).not.toContain('Bend regulates')
    expect(mt.detail).not.toContain('Deschutes County regulates')
  })
})

// ── Short-term: imported, never re-authored ────────────────────────────────

describe('short-term tenure', () => {
  it('carries the development module verdict and citation through unchanged', () => {
    const st = tenureOf(bend(), 'Short-term')
    expect(st.verdict).toBe('conditional')
    expect(st.citation).toContain('3.6.500')
    expect(st.detail).toContain('500 feet')
  })

  it('adds the operating and tax-registration mechanics the land-use read lacks', () => {
    const steps = tenureOf(bend(), 'Short-term').requirements.join(' ')
    expect(steps).toContain('operating license')
    expect(steps).toContain('7.16')
    expect(steps).toContain('1.5%')
    expect(steps).toContain('quarterly')
    expect(steps).toContain('void on sale')
  })

  it('carries the EFU and forest prohibition and routes to the open paths', () => {
    for (const build of [farmland, forest]) {
      const st = tenureOf(build(), 'Short-term')
      expect(st.verdict).toBe('no')
      const steps = st.requirements.join(' ')
      expect(steps).toContain('30 days or longer')
      expect(steps).not.toContain('Register with the Oregon Department of Revenue')
    }
  })

  it('carries the county registration mechanics on rural land', () => {
    const steps = tenureOf(countyRural(), 'Short-term').requirements.join(' ')
    expect(steps).toContain('15 calendar days')
    expect(steps).toContain('Certificate of Authority')
    expect(steps).toContain('8%')
    expect(steps).toContain('4.08.145')
    expect(steps).toContain('4.08.100')
  })

  it('never inherits the county land-use read inside a city we do not cover', () => {
    // Sisters is incorporated. lib/cma/development.ts routes any non-Bend,
    // non-Redmond parcel to its county branch, and DCC 4.08.100 limits the
    // county room tax to unincorporated land, so the county read must not carry.
    const sisters = resolveRentalPotential(
      subjectFixture({ city: 'Sisters', subdivision: null }),
      siteFixture({ zone: 'RR-10', isMunicipal: true, insideUGB: true }),
    )!
    expect(sisters.jurisdiction).toContain('Sisters')
    expect(tenureOf(sisters, 'Short-term').verdict).toBe('confirm')
    expect(sisters.income.some((i) => i.label.includes('Room tax'))).toBe(false)
    expect(tenureOf(sisters, 'Short-term').requirements.join(' ')).not.toContain('8%')
  })

  it('carries the verified Bend room tax rate rather than a placeholder', () => {
    const steps = tenureOf(bend(), 'Short-term').requirements.join(' ')
    expect(steps).toContain('10.4%')
    expect(steps).toContain('12.05.015(A)')
    expect(steps).toContain('answers the phone at any hour, seven days a week')
    expect(steps).toContain('250 feet')
    expect(steps).toContain('inspection')
    const tax = bend().income.find((i) => i.label.includes('Room tax'))!
    expect(tax.value).toBe('10.4% city plus 1.5% state')
  })

  it('carries the Redmond permit and lodging tax mechanics', () => {
    const st = tenureOf(redmond(), 'Short-term')
    expect(st.verdict).toBe('conditional')
    expect(st.requirements.join(' ')).toContain('9%')
    expect(st.requirements.join(' ')).toContain('business license')
  })

  it('degrades to confirm with no site record and claims no local permit', () => {
    const st = tenureOf(unknownJurisdiction(), 'Short-term')
    expect(st.verdict).toBe('confirm')
    const steps = st.requirements.join(' ')
    expect(steps).toContain('the city or county that issues permits for this address')
    // An unresolved parcel must never be handed a permit-and-pay checklist.
    expect(steps).not.toContain('Register with the Deschutes County Tax Office')
    expect(steps).not.toContain('8%')
    // It must still be told what IS open.
    expect(steps).toContain('Long-term leasing and stays of 30 days or longer')
  })

  it('never hands a county tax checklist to a parcel whose zone did not resolve', () => {
    const unresolvedCounty = resolveRentalPotential(
      subjectFixture({ city: 'Sunriver', subdivision: 'Mtn Village East' }),
      siteFixture({ zone: 'SURS', isMunicipal: false, insideUGB: false }),
    )!
    const st = tenureOf(unresolvedCounty, 'Short-term')
    expect(st.verdict).toBe('confirm')
    expect(st.requirements.join(' ')).not.toContain('8% county room tax')
    expect(st.requirements.join(' ')).toContain('Deschutes County Community Development')
    // The resort association is still named, resolved from the city.
    expect(st.requirements.join(' ')).toContain('Sunriver')
    // And no room tax figure renders for a parcel we could not resolve.
    expect(unresolvedCounty.income.some((i) => i.label.includes('Room tax'))).toBe(false)
  })
})

// ── Resort layer ────────────────────────────────────────────────────────────

describe('resort and association layer', () => {
  it('names the association on every tenure that has a covenant exposure', () => {
    const r = resort()
    expect(prose(r)).toContain('Sunriver')
    expect(tenureOf(r, 'Long-term').requirements.join(' ')).toContain('Sunriver')
    expect(tenureOf(r, 'Mid-term').requirements.join(' ')).toContain('Sunriver')
    expect(tenureOf(r, 'Short-term').requirements.join(' ')).toContain('Sunriver')
    expect(r.marketingHighlights.some((h) => h.headline.includes('Sunriver'))).toBe(true)
  })

  it('adds the Sunriver-only county occupancy cap, and only in Sunriver', () => {
    expect(tenureOf(resort(), 'Short-term').requirements.join(' ')).toContain('5.12.050')
    expect(tenureOf(countyRural(), 'Short-term').requirements.join(' ')).not.toContain('5.12.050')
  })

  it('adds no association step when the subdivision is not one we know', () => {
    const r = bend()
    expect(tenureOf(r, 'Long-term').requirements.join(' ')).toContain('recorded CC&Rs')
    expect(r.marketingHighlights.every((h) => !h.headline.includes('Sunriver'))).toBe(true)
  })
})

// ── §0: income ──────────────────────────────────────────────────────────────

describe('income potential obeys §0', () => {
  it.each(ALL)('%s: every income row carries a non-empty basis', (_label, build) => {
    for (const row of build().income) {
      expect(row.label.trim().length).toBeGreaterThan(0)
      expect(row.value.trim().length).toBeGreaterThan(0)
      expect(row.basis.trim().length).toBeGreaterThan(20)
    }
  })

  it.each(ALL)('%s: publishes no nightly rate, occupancy, cap rate, or yield', (_label, build) => {
    const r = build()
    const text = prose(r).toLowerCase()
    // The words may appear in the economics note as things we decline to publish,
    // so the test targets the income rows, which are the figures that render.
    const figures = r.income.map((i) => `${i.label} ${i.value}`.toLowerCase()).join(' ')
    for (const banned of ['per night', 'nightly rate', 'occupancy rate', 'cap rate', 'yield', 'adr', 'revpar']) {
      expect(figures).not.toContain(banned)
    }
    // And the note must say plainly that we do not publish them.
    expect(text).toContain('we do not publish a nightly rate')
  })

  it('sources the subject property tax from the MLS record, and omits it when absent', () => {
    const withTax = bend().income.find((i) => i.label.startsWith('Property tax'))
    expect(withTax?.value).toBe('$4,210')
    expect(withTax?.basis).toContain('MLS')

    const noTax = resolveRentalPotential(subjectFixture({ taxAnnual: null }), siteFixture())!
    expect(noTax.income.some((i) => i.label.startsWith('Property tax'))).toBe(false)
  })

  it('publishes no room tax figure where nightly rental is prohibited', () => {
    for (const build of [farmland, forest]) {
      expect(build().income.some((i) => i.label.includes('lodging tax') || i.label.includes('Room tax'))).toBe(false)
    }
  })

  it('publishes no local room tax figure for an unknown jurisdiction', () => {
    const rows = unknownJurisdiction().income
    expect(rows.some((i) => i.label.includes('Room tax'))).toBe(false)
    expect(rows.some((i) => i.label.includes('Maximum rent increase'))).toBe(true)
  })

  it('dates the rent ceiling so a later year cannot read it as current', () => {
    const cap = bend().income.find((i) => i.label.includes('Maximum rent increase'))!
    expect(cap.label).toContain('2026')
    expect(cap.basis).toContain('September 30')
  })
})

// ── Marketing highlights ────────────────────────────────────────────────────

describe('marketing highlights', () => {
  it.each(ALL)('%s: every highlight stands alone and carries a basis', (_label, build) => {
    const hs = build().marketingHighlights
    expect(hs.length).toBeGreaterThan(0)
    for (const h of hs) {
      expect(h.headline.trim().length).toBeGreaterThan(30)
      expect(h.basis.trim().length).toBeGreaterThan(15)
    }
  })

  it('leads with what the owner can do, including where nightly rental is closed', () => {
    const closed = farmland().marketingHighlights
    expect(closed.some((h) => h.headline.includes('Long-term leasing and stays of 30 days or longer are both open'))).toBe(true)
  })
})

// ── Brand voice ─────────────────────────────────────────────────────────────

describe('brand voice', () => {
  const BANNED_WORDS = [
    'stunning', 'breathtaking', 'gorgeous', 'charming', 'pristine', 'nestled', 'boasts',
    'must-see', 'dream home', 'meticulously maintained', 'tucked away', 'hidden gem', 'truly',
    'luxurious', 'immaculate', 'captivating', 'exquisite', 'delve', 'tapestry', 'robust',
    'seamless', 'elevate', 'unlock', 'holistic', 'dynamic', 'vibrant', 'bustling', 'eclectic',
    'curated', 'bespoke', 'premier', 'white glove', 'act fast', "won't last", 'small team',
  ]

  it.each(ALL)('%s: no em-dash, en-dash, semicolon, or exclamation mark', (_label, build) => {
    const text = authoredProse(build())
    expect(text).not.toContain('—')
    expect(text).not.toContain('–')
    expect(text).not.toContain(';')
    expect(text).not.toContain('!')
  })

  it.each(ALL)('%s: no banned vocabulary', (_label, build) => {
    const text = authoredProse(build()).toLowerCase()
    for (const word of BANNED_WORDS) {
      expect(text).not.toContain(word)
    }
  })
})
