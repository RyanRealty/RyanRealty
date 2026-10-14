import { describe, expect, it } from 'vitest'
import type { SuggestItem } from '../SearchSuggest'
import { TYPED_SEARCH_ROW_PREFIX, citySeedRows, searchFieldItems, searchFieldRows } from '../search-field-rows'

const bend: SuggestItem = { kind: 'city', label: 'Bend', sublabel: '1044', href: '/homes-for-sale/bend', city: 'Bend' }
const address: SuggestItem = { kind: 'address', label: '2666 NW 26th Loop', href: '/homes-for-sale/redmond/2666-nw-26th-loop-12345' }

describe('citySeedRows', () => {
  it('makes city rows that filter in place, one id per city', () => {
    const rows = citySeedRows(['Bend', 'La Pine'])
    expect(rows).toEqual([
      { kind: 'city', label: 'Bend', sublabel: 'City', href: '/homes-for-sale?city=Bend', city: 'Bend' },
      { kind: 'city', label: 'La Pine', sublabel: 'City', href: '/homes-for-sale?city=La%20Pine', city: 'La Pine' },
    ])
  })
})

describe('searchFieldRows', () => {
  const seeds = citySeedRows(['Bend', 'Redmond'])
  it('offers the seeds until the server has matches', () => {
    expect(searchFieldRows([], seeds)).toBe(seeds)
    expect(searchFieldRows([bend], seeds)).toEqual([bend])
  })
})

describe('searchFieldItems', () => {
  it('never gives a row its own onSelect, so a pick is handled once', () => {
    const items = searchFieldItems([bend, address], 'be', { answersQuery: true })
    for (const item of items) expect(item).not.toHaveProperty('onSelect')
  })

  it('lets server rows survive the morph filter through the typed words; seeds stay filterable', () => {
    expect(searchFieldItems([address], '2666 26th', { answersQuery: true })[0].keywords).toEqual(['2666 26th'])
    const seeded = searchFieldItems(citySeedRows(['Bend']), 'Re', { answersQuery: false })
    expect(seeded[0]).not.toHaveProperty('keywords')
  })

  it('puts a sentence of filter words first, so Enter applies every filter, not just the place', () => {
    const tetherow: SuggestItem = { kind: 'subdivision', label: 'Tetherow', sublabel: 'Bend', href: '/communities/tetherow', city: 'Bend', subdivisionName: 'Tetherow' }
    const items = searchFieldItems([tetherow], '3 bed in Tetherow', { answersQuery: true })
    expect(items[0]).toEqual({
      id: `${TYPED_SEARCH_ROW_PREFIX}3 bed in Tetherow`,
      title: '3 bed in Tetherow',
      description: 'Search homes',
    })
    expect(items.map((i) => i.id)).toContain('/communities/tetherow')
  })

  it('suggestions left from earlier words carry no keyword, so the new words filter them out', () => {
    // The Bend row answered "Bend"; "Bend 3 bed" is typed before the new answer lands.
    const items = searchFieldItems([bend], 'Bend 3 bed', { answersQuery: false })
    expect(items.find((i) => i.id === bend.href)).not.toHaveProperty('keywords')
    expect(items[0].id).toBe(`${TYPED_SEARCH_ROW_PREFIX}Bend 3 bed`)
  })

  it('adds a keyword row when nothing else would show, as the field before the morph did on Enter', () => {
    const items = searchFieldItems(citySeedRows(['Bend', 'Redmond']), 'zz', { answersQuery: false })
    expect(items.at(-1)?.id).toBe(`${TYPED_SEARCH_ROW_PREFIX}zz`)
  })

  it('adds no row when a place already answers the words, or a row names them', () => {
    // "Be" leaves the Bend seed showing.
    expect(searchFieldItems(citySeedRows(['Bend', 'Redmond']), 'Be', { answersQuery: false }).map((i) => i.id)).toEqual([
      '/homes-for-sale?city=Bend',
      '/homes-for-sale?city=Redmond',
    ])
    expect(searchFieldItems([bend], 'bend', { answersQuery: true }).map((i) => i.id)).toEqual(['/homes-for-sale/bend'])
    expect(searchFieldItems([address], '2666 26th', { answersQuery: true }).map((i) => i.id)).toEqual([address.href])
  })
})
