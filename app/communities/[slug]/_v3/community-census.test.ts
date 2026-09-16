import { describe, expect, it } from 'vitest'
import { censusPages, censusRows } from '@/components/site/v3/V3Census'
import { CENSUS_GROUP, buildCommunityCensus, communityCensusGroups, communityCensusLede, nameList } from './community-census'

const base = {
  placeName: 'Tetherow',
  atlas: { forSale: 25, pending: 4, complete: true },
  homesListCount: 26,
  matchNames: ['Tetherow', 'Triple', 'Tetherow Resort'],
  detachedActive: 16,
  newCount30d: 1,
  sold12mo: 26,
}

describe('buildCommunityCensus (SITE-116 round 3)', () => {
  it('prints every figure the page holds, each with what / where / when, and never changes a number', () => {
    const rows = buildCommunityCensus(base)
    expect(rows.map((r) => [r.key, r.figure])).toEqual([
      ['atlas-for-sale', '25'],
      ['atlas-pending', '4'],
      ['homes-list', '26'],
      ['detached-active', '16'],
      ['new-30d', '1'],
      ['sold-12m', '26'],
    ])
    for (const row of rows) {
      expect(row.what.length).toBeGreaterThan(0)
      expect(row.where.length).toBeGreaterThan(0)
      expect(row.when.length).toBeGreaterThan(0)
      expect(row.source).toMatch(/Oregon Data Share/)
      expect(row.href).toMatch(/^#/)
    }
  })

  it('scopes the map rows to the boundary and every property type, the pace rows to detached houses', () => {
    const rows = buildCommunityCensus(base)
    const atlas = rows.find((r) => r.key === 'atlas-for-sale')!
    expect(atlas.what).toMatch(/Every property type/)
    expect(atlas.where).toBe('inside the recorded Tetherow boundary')
    const alert = rows.find((r) => r.key === 'new-30d')!
    expect(alert.what).toMatch(/Detached single-family houses only/)
    expect(alert.when).toBe('listed in the last 30 days')
    expect(alert.noun).toBe('house came on')
    const list = rows.find((r) => r.key === 'homes-list')!
    expect(list.where).toBe('filed by the MLS under Tetherow, Triple or Tetherow Resort, inside the list\'s map frame')
  })

  it('omits a figure the page did not read (null), and never prints a zero for the pace rows (§0)', () => {
    const rows = buildCommunityCensus({
      ...base,
      atlas: null,
      homesListCount: null,
      detachedActive: null,
      newCount30d: 0,
      sold12mo: 26,
    })
    expect(rows.map((r) => r.key)).toEqual(['sold-12m'])
  })

  it('drops the map rows when the Atlas read did not complete', () => {
    const rows = buildCommunityCensus({ ...base, atlas: { forSale: 3, pending: 0, complete: false } })
    expect(rows.some((r) => r.key.startsWith('atlas'))).toBe(false)
  })

  it('says when the homes list is a capped nearest set', () => {
    const rows = buildCommunityCensus({ ...base, homesListCount: 500, homesListCapped: true })
    const list = rows.find((r) => r.key === 'homes-list')!
    expect(list.noun).toBe('nearest on the homes list')
    expect(list.source).toMatch(/display cap/)
  })

  it('carries each figure as a count for geometry and names its population (SITE-116 round 4)', () => {
    const rows = buildCommunityCensus(base)
    expect(rows.map((r) => [r.key, r.count, r.group])).toEqual([
      ['atlas-for-sale', 25, CENSUS_GROUP.boundary],
      ['atlas-pending', 4, CENSUS_GROUP.boundary],
      ['homes-list', 26, CENSUS_GROUP.names],
      ['detached-active', 16, CENSUS_GROUP.membership],
      ['new-30d', 1, CENSUS_GROUP.membership],
      ['sold-12m', 26, CENSUS_GROUP.membership],
    ])
    for (const row of rows) expect(String(row.count)).toBe(row.figure)
  })
})

describe('the census insight pages (SITE-116 round 4)', () => {
  const rows = censusRows(buildCommunityCensus(base))
  const groups = communityCensusGroups('Tetherow', base.matchNames)
  const pages = censusPages('counted', rows, groups, 'Every count on one sheet')

  it('draws one page per population, in the groups’ order, each with its door', () => {
    expect(pages.map((p) => p.key)).toEqual([CENSUS_GROUP.boundary, CENSUS_GROUP.names, CENSUS_GROUP.membership])
    expect(pages.map((p) => p.door.href)).toEqual(['#atlas', '#homes', '#faq'])
    expect(pages.map((p) => p.door.label)).toEqual(['The map', 'The homes list', 'The answers'])
  })

  it('draws the boundary as the allocation bar — a true partition — with shares over the two together', () => {
    const boundary = pages[0]!
    expect(boundary.card.kind).toBe('allocation')
    if (boundary.card.kind !== 'allocation') return
    expect(boundary.card.segments.map((s) => [s.name, s.figure, s.pct])).toEqual([
      ['For sale', '25', 86.2],
      ['Pending', '4', 13.8],
    ])
    expect(boundary.prose).toBe(
      'Every property type: houses, condos, townhomes and lots — inside the recorded Tetherow boundary. ' +
        '25 for sale on the map, active on the MLS right now; 4 pending on the map, under contract right now.',
    )
  })

  it('draws the membership windows as bars on one scale shared across the sheet, never as a partition', () => {
    const membership = pages[2]!
    expect(membership.card.kind).toBe('bars')
    if (membership.card.kind !== 'bars') return
    expect(membership.card.max).toBe(26)
    expect(membership.card.rows.map((r) => [r.figure, r.noun, r.when])).toEqual([
      ['16', 'houses for sale', 'active at the last MLS refresh'],
      ['1', 'house came on', 'listed in the last 30 days'],
      ['26', 'houses sold', 'closed in the last 12 months'],
    ])
    expect(membership.prose).toMatch(/^Detached single-family houses only — homes whose MLS membership is Tetherow/)
  })

  it('keeps every word of the rows in the pages’ prose', () => {
    const text = pages.map((p) => p.prose).join(' ')
    for (const row of rows) {
      expect(text).toContain(row.figure)
      expect(text).toContain(row.noun)
      expect(text).toContain(row.when)
    }
  })

  it('is no insight with one population: the table then renders open', () => {
    const one = censusRows(buildCommunityCensus({ ...base, atlas: null, homesListCount: null }))
    expect(censusPages('counted', one, groups, 'Every count on one sheet')).toHaveLength(1)
  })
})

describe('nameList', () => {
  it('joins one, two and many names as English', () => {
    expect(nameList(['Tetherow'])).toBe('Tetherow')
    expect(nameList(['Tetherow', 'Triple'])).toBe('Tetherow or Triple')
    expect(nameList(['Tetherow', 'Triple', 'Tetherow Resort'])).toBe('Tetherow, Triple or Tetherow Resort')
    expect(nameList([' Tetherow ', 'Tetherow', ''])).toBe('Tetherow')
  })
})

describe('communityCensusLede', () => {
  it('counts the rows and needs at least two of them', () => {
    const rows = buildCommunityCensus(base)
    expect(communityCensusLede('Tetherow', rows)).toMatch(/^Six counts of Tetherow sit on this page/)
    expect(communityCensusLede('Tetherow', rows.slice(0, 1))).toBeUndefined()
  })
})
