import { describe, expect, it } from 'vitest'
import { buildCommunityCensus, communityCensusLede, nameList } from './community-census'

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
