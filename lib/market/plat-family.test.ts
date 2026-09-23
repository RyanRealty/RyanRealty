import { describe, expect, it } from 'vitest'
import {
  derivePlatFamilies,
  familiesNestedInCommunity,
  platFamilyBaseName,
  platFamilyKey,
  platFamilyRole,
  platFamilySlug,
  platMemberDisplayName,
  platPhaseOrdinal,
  recaseRomanPhases,
  stripCountyDocumentTokens,
  type FamilyPlatInput,
} from './plat-family'

describe('stripCountyDocumentTokens', () => {
  it('removes land-use file numbers and keeps the phase', () => {
    expect(stripCountyDocumentTokens('Canyon Ridge, Phase 4 711-18-000032-sub')).toBe('Canyon Ridge, Phase 4')
    expect(stripCountyDocumentTokens('Easton Phase I Plld20200979')).toBe('Easton Phase I')
    expect(stripCountyDocumentTokens('Petrosa Phase 5a Pz-20-0235')).toBe('Petrosa Phase 5a')
    expect(stripCountyDocumentTokens('Acadia Pointe, Phases I And II Pz 20-0569')).toBe('Acadia Pointe, Phases I And II')
    expect(stripCountyDocumentTokens('Sunset Meadows Phases 1 And 2 Sub 22-01')).toBe('Sunset Meadows Phases 1 And 2')
    expect(stripCountyDocumentTokens('Trailhead Cottages 247-23-000715-tp')).toBe('Trailhead Cottages')
    expect(stripCountyDocumentTokens('Demaris Acres See Cs06623')).toBe('Demaris Acres')
    expect(stripCountyDocumentTokens('121 West Phases 1 And 2 711-21-000260-sub')).toBe('121 West Phases 1 And 2')
  })

  it('leaves a label with no file number alone', () => {
    expect(stripCountyDocumentTokens('Ridge At Eagle Crest 36')).toBe('Ridge At Eagle Crest 36')
  })
})

describe('platFamilyBaseName', () => {
  const cases: Array<[string, string]> = [
    ['Ridge At Eagle Crest 36', 'Ridge At Eagle Crest'],
    ['Ridge At Eagle Crest IV', 'Ridge At Eagle Crest'],
    ['Ridge At Eagle Crest 12 Replat Lots 41-48 & 57-60 & Common', 'Ridge At Eagle Crest'],
    ['Awbrey Butte Homesites Phase Thirty-two', 'Awbrey Butte Homesites'],
    ['Awbrey Butte Homesites Phase Ten Replat Block 8 Lots 15, 16 & 17', 'Awbrey Butte Homesites'],
    ['Broken Top Phase Ii-c Lots 117 Thru 143', 'Broken Top'],
    ['Broken Top Phases 1-a & 1-b Lots 29 Thru 71 Lots 100 Thru 109 & Tract J', 'Broken Top'],
    ['Tetherow Phase 3', 'Tetherow'],
    ['Tetherow Crossing Phase VII', 'Tetherow Crossing'],
    ['Tetherow Crossing', 'Tetherow Crossing'],
    ['Golf Homes At Tetherow', 'Golf Homes At Tetherow'],
    ['Canyon Ridge, Phase 4 711-18-000032-sub', 'Canyon Ridge'],
    ['Eagle Crest II Phase I', 'Eagle Crest'],
    ['Oregon Water Wonderland Unit 2', 'Oregon Water Wonderland'],
    ['River Canyon Estates No. 2', 'River Canyon Estates'],
    ['Ridge Condominiums (the) Stage VII', 'Ridge Condominiums'],
    ['Deschutes River Recreation Homesites Inc. Blocks 23-31', 'Deschutes River Recreation Homesites'],
    ['Rock Ridge Cabin Sites First Addition Of Black Butte Ranch Lots 20, 21 And 22', 'Rock Ridge Cabin Sites Of Black Butte Ranch'],
    ['Caldera Springs Olu Phase C1 247-22-000182-tp', 'Caldera Springs'],
    ['Tennis Tracts At Broken Top', 'Tennis Tracts At Broken Top'],
    ['Golf Tracts At Broken Top', 'Golf Tracts At Broken Top'],
    ['Park Addition', 'Park Addition'],
    ['Carriage Addition No. I', 'Carriage Addition'],
  ]
  for (const [label, base] of cases) {
    it(`${label} -> ${base}`, () => {
      expect(platFamilyBaseName(label)).toBe(base)
    })
  }
})

describe('platFamilyKey / platFamilySlug', () => {
  it('compares spellings of one recorded name as equal', () => {
    expect(platFamilyKey('The Highlands at Broken Top')).toBe(platFamilyKey('Highlands At Broken Top'))
    expect(platFamilyKey('Mt. Bachelor Village')).toBe(platFamilyKey('Mt Bachelor Village'))
    expect(platFamilyKey('Tetherow')).not.toBe(platFamilyKey('Tetherow Crossing'))
  })
  it('spells the slug the way the county slugs its phases', () => {
    expect(platFamilySlug('Ridge At Eagle Crest')).toBe('ridge-at-eagle-crest')
    expect(platFamilySlug('Wildflower/sunriver')).toBe('wildflower-sunriver')
    expect(platFamilySlug('Rock & Roll')).toBe('rock-and-roll')
  })
})

describe('platPhaseOrdinal', () => {
  it('reads digits, roman numerals and words', () => {
    expect(platPhaseOrdinal('Ridge At Eagle Crest 36')).toBe(36)
    expect(platPhaseOrdinal('Ridge At Eagle Crest IV')).toBe(4)
    expect(platPhaseOrdinal('Awbrey Butte Homesites Phase Twenty-two')).toBe(22)
  })
})

const plat = (slug: string, label: string, citySlug: string, closedCount = 20): FamilyPlatInput => ({
  slug,
  label,
  citySlug,
  closedCount,
})

const FIXTURE: FamilyPlatInput[] = [
  plat('ridge-at-eagle-crest-ii', 'Ridge At Eagle Crest II', 'redmond', 68),
  plat('ridge-at-eagle-crest-5', 'Ridge At Eagle Crest 5', 'redmond', 31),
  plat('ridge-at-eagle-crest-36', 'Ridge At Eagle Crest 36', 'redmond', 207),
  plat('ridge-at-eagle-crest-11', 'Ridge At Eagle Crest 11', 'redmond', 50),
  plat('ridge-at-eagle-crest-11-replat-lots-21-28', 'Ridge At Eagle Crest 11 Replat Lots 21-28', 'redmond', 24),
  plat('awbrey-butte-homesites-phase-i', 'Awbrey Butte Homesites Phase I', 'bend', 23),
  plat('awbrey-butte-homesites-phase-twenty-two', 'Awbrey Butte Homesites Phase Twenty-two', 'bend', 106),
  plat('tetherow-phase-1', 'Tetherow Phase 1', 'bend', 983),
  plat('tetherow-phase-3', 'Tetherow Phase 3', 'bend', 133),
  plat('tetherow-crossing', 'Tetherow Crossing', 'redmond', 440),
  plat('tetherow-crossing-phase-ii', 'Tetherow Crossing Phase II', 'redmond', 104),
  plat('golf-homes-at-tetherow', 'Golf Homes At Tetherow', 'bend', 108),
  plat('highlands-at-broken-top-phase-1', 'Highlands At Broken Top Phase 1', 'bend', 57),
  plat('highlands-at-broken-top-phase-2', 'Highlands At Broken Top Phase 2', 'bend', 1140),
  plat('bend', 'Bend', 'bend', 300),
  plat('bend-block-4-subdivision', 'Bend Block 4 Subdivision', 'bend', 12),
  // Same name, two towns: never one family.
  plat('river-park-i', 'River Park I', 'sunriver', 5),
  plat('river-park-ii', 'River Park II', 'sunriver', 5),
  plat('river-park-phase-1', 'River Park Phase 1', 'redmond', 5),
  plat('river-park-phase-2', 'River Park Phase 2', 'redmond', 5),
  // A base nobody recorded names no family.
  plat('zz-hollow-phase-1', 'Zz Hollow Phase 1 Lots 1-4', 'bend', 5),
]

const COMMUNITIES = [
  { slug: 'tetherow', label: 'Tetherow', citySlug: 'bend', aliases: ['Tetherow', 'Triple'] },
  { slug: 'eagle-crest', label: 'Eagle Crest', citySlug: 'redmond', aliases: ['Eagle Crest', 'Ridge At Eagle Crest'] },
]
const MLS = [{ name: 'The Highlands at Broken Top', citySlug: 'bend' }]

function families() {
  return derivePlatFamilies({
    plats: FIXTURE,
    communities: COMMUNITIES,
    mlsNames: MLS,
    reservedSlugs: new Set(['bend', 'sisters', 'la-pine', 'tetherow', 'eagle-crest']),
    areaRedirect: (slug) => (slug === 'tetherow' ? '/communities/tetherow' : null),
  })
}

describe('derivePlatFamilies', () => {
  it('groups every numbered phase and replat of Ridge at Eagle Crest under the registry name', () => {
    const ridge = families().find((f) => f.slug === 'ridge-at-eagle-crest')
    expect(ridge).toBeDefined()
    expect(ridge!.nameSource).toBe('registry')
    expect(ridge!.mainHref).toBe('/subdivisions/ridge-at-eagle-crest')
    expect(ridge!.members.map((m) => m.slug)).toEqual([
      'ridge-at-eagle-crest-ii',
      'ridge-at-eagle-crest-5',
      'ridge-at-eagle-crest-11',
      'ridge-at-eagle-crest-11-replat-lots-21-28',
      'ridge-at-eagle-crest-36',
    ])
  })

  it('names a family the county wrote as the stem of every phase (Awbrey Butte Homesites)', () => {
    const f = families().find((x) => x.slug === 'awbrey-butte-homesites')
    expect(f?.name).toBe('Awbrey Butte Homesites')
    expect(f?.nameSource).toBe('county')
  })

  it('gives a family with a registry community that community page as its main page', () => {
    const f = families().find((x) => x.name === 'Tetherow')
    expect(f?.mainKind).toBe('community')
    expect(f?.mainHref).toBe('/communities/tetherow')
    expect(f?.members.map((m) => m.slug)).toEqual(['tetherow-phase-1', 'tetherow-phase-3'])
  })

  it('keeps Tetherow Crossing (Redmond) out of Tetherow (Bend) and heads it with its own recorded plat', () => {
    const f = families().find((x) => x.slug === 'tetherow-crossing')
    expect(f?.citySlug).toBe('redmond')
    expect(f?.members.map((m) => m.slug)).toEqual(['tetherow-crossing', 'tetherow-crossing-phase-ii'])
    expect(platFamilyRole(families(), 'tetherow-crossing')?.role).toBe('head')
    expect(platFamilyRole(families(), 'tetherow-crossing-phase-ii')?.role).toBe('member')
  })

  it('uses the MLS name when only the MLS records the bare name', () => {
    const f = families().find((x) => x.slug === 'the-highlands-at-broken-top')
    expect(f?.nameSource).toBe('mls')
    expect(f?.members).toHaveLength(2)
  })

  it('never mints a family page on a reserved place slug (/subdivisions/bend is not Bend)', () => {
    expect(families().some((f) => f.slug === 'bend')).toBe(false)
  })

  it('splits two same-named developments in two towns, each addressed by name and town', () => {
    const fams = families()
    const riverParks = fams.filter((f) => platFamilyKey(f.name) === 'river park')
    // Same slug in two towns: neither may take /subdivisions/river-park, and
    // neither is left without a main page (Matt 2026-09-23: the grouping
    // always happens). Each is addressed by its recorded name and its town.
    expect(riverParks.map((f) => [f.citySlug, f.mainHref, f.members.length])).toEqual([
      ['redmond', '/subdivisions/river-park-redmond', 2],
      ['sunriver', '/subdivisions/river-park-sunriver', 2],
    ])
    expect(platFamilyRole(fams, 'river-park-phase-2')?.family.mainHref).toBe('/subdivisions/river-park-redmond')
    expect(platFamilyRole(fams, 'river-park-ii')?.family.mainHref).toBe('/subdivisions/river-park-sunriver')
    expect(platFamilyRole(fams, 'river-park-redmond')?.role).toBe('head')
    expect(fams.some((f) => f.members.some((m) => m.slug === 'zz-hollow-phase-1'))).toBe(false)
  })

  it('groups plats that no town holds with each other, and never with a placed namesake', () => {
    const fams = derivePlatFamilies({
      plats: [
        plat('imperial-blocks-1-19', 'Imperial Blocks 1-19', '', 0),
        plat('imperial-blocks-20-43', 'Imperial Blocks 20-43', '', 0),
        plat('mesa-phase-1', 'Mesa Phase 1', 'bend', 3),
        plat('mesa-phase-2', 'Mesa Phase 2', 'redmond', 3),
        plat('mesa-phase-3', 'Mesa Phase 3', '', 3),
      ],
    })
    const imperial = fams.find((f) => f.slug === 'imperial')
    expect(imperial?.citySlug).toBe('')
    expect(imperial?.members.map((m) => m.slug)).toEqual(['imperial-blocks-1-19', 'imperial-blocks-20-43'])
    // Mesa has two towns: the unplaced phase is not guessed into either.
    expect(fams.some((f) => f.members.some((m) => m.slug === 'mesa-phase-3'))).toBe(false)
  })

  it('never groups a single plat', () => {
    expect(families().some((f) => f.members.some((m) => m.slug === 'golf-homes-at-tetherow'))).toBe(false)
  })
})

describe('the family lock (Matt 2026-09-23): every family has a main page and every phase points at it', () => {
  it('holds over the fixture', () => {
    const fams = families()
    expect(fams.length).toBeGreaterThan(0)
    for (const family of fams) {
      expect(family.members.length).toBeGreaterThanOrEqual(2)
      expect(family.mainHref).toMatch(/^\/(communities|subdivisions)\/[a-z0-9-]+$/)
      if (family.mainKind === 'subdivision') {
        expect(family.mainHref).toBe(`/subdivisions/${family.slug}`)
        expect(platFamilyRole(fams, family.slug)?.role).toBe('head')
      }
      for (const member of family.members) {
        if (family.mainKind === 'subdivision' && member.slug === family.slug) continue
        const role = platFamilyRole(fams, member.slug)
        expect(role?.role).toBe('member')
        expect(role?.family.mainHref).toBe(family.mainHref)
      }
    }
  })
})

describe('platMemberDisplayName', () => {
  it('strips file numbers, keeps the phase, and never withholds a county phase', () => {
    expect(platMemberDisplayName('Canyon Ridge, Phase 4 711-18-000032-sub')).toBe('Canyon Ridge, Phase 4')
    expect(platMemberDisplayName('Caldera Springs Phase C1 Sfr 247-22-000183-tp')).toMatch(/^Caldera Springs Phase C1/)
    expect(platMemberDisplayName('Ridge At Eagle Crest 36')).toBe('Ridge at Eagle Crest 36')
  })

  it('drops filing tokens and cases a roman phase number as a numeral (SEO-7)', () => {
    expect(platMemberDisplayName('Broken Top Phase Ii-c Lots 117 Thru 143')).toBe('Broken Top Phase II-C Lots 117 Thru 143')
    expect(platMemberDisplayName('Brooksmill Estates, P.u.d., Phase 2')).toBe('Brooksmill Estates, Phase 2')
    expect(platMemberDisplayName('Deschutes River Recreation Homesites Inc. Blocks 23-31')).toBe(
      'Deschutes River Recreation Homesites Blocks 23-31',
    )
    expect(platMemberDisplayName('Riverrim P.u.d. Phase 1')).toBe('Riverrim Phase 1')
  })
})

describe('recaseRomanPhases', () => {
  it('uppercases only whole words that are numerals', () => {
    expect(recaseRomanPhases('Arrowwood Trail Broken Top Phase Iv-f')).toBe('Arrowwood Trail Broken Top Phase IV-F')
    expect(recaseRomanPhases('Oakview Phases Xi, XII And Xiv')).toBe('Oakview Phases XI, XII And XIV')
    expect(recaseRomanPhases('Vista Ivy Civic Vi Xx')).toBe('Vista Ivy Civic VI XX')
    expect(recaseRomanPhases('Phase I')).toBe('Phase I')
  })
})

describe('familiesNestedInCommunity (community -> family -> phase)', () => {
  it('links a community down to the family the registry files under it and to a family its outline contains', () => {
    const fams = families()
    const ridge = fams.find((f) => f.slug === 'ridge-at-eagle-crest')
    expect(ridge?.parentCommunitySlug).toBe('eagle-crest')
    expect(familiesNestedInCommunity(fams, 'eagle-crest', new Set()).map((f) => f.slug)).toEqual(['ridge-at-eagle-crest'])
    const highlands = familiesNestedInCommunity(fams, 'broken-top', new Set(['highlands-at-broken-top-phase-2']))
    expect(highlands.map((f) => f.slug)).toEqual(['the-highlands-at-broken-top'])
    // The community's OWN family is its page, not a door below it.
    expect(familiesNestedInCommunity(fams, 'tetherow', new Set(['tetherow-phase-1'])).map((f) => f.slug)).toEqual([])
  })
})
