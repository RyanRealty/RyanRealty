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
    const items = searchFieldItems([bend, address], 'be', { fromServer: true })
    for (const item of items) expect(item).not.toHaveProperty('onSelect')
  })

  it('lets server rows survive the morph filter through the typed words; seeds stay filterable', () => {
    expect(searchFieldItems([address], '2666 26th', { fromServer: true })[0].keywords).toEqual(['2666 26th'])
    const seeded = searchFieldItems(citySeedRows(['Bend']), 'Re', { fromServer: false })
    expect(seeded[0]).not.toHaveProperty('keywords')
  })

  it('adds a last row that applies typed filter words as a sentence', () => {
    const items = searchFieldItems([], '3 bed under 800k', { fromServer: false })
    expect(items.at(-1)).toEqual({
      id: `${TYPED_SEARCH_ROW_PREFIX}3 bed under 800k`,
      title: '3 bed under 800k',
      description: 'Search homes',
    })
  })

  it('adds a keyword row when nothing else would show, as the field before the morph did on Enter', () => {
    const items = searchFieldItems(citySeedRows(['Bend', 'Redmond']), 'zz', { fromServer: false })
    expect(items.at(-1)?.id).toBe(`${TYPED_SEARCH_ROW_PREFIX}zz`)
  })

  it('adds no row when a place already answers the words, or a row names them', () => {
    // "Be" leaves the Bend seed showing.
    expect(searchFieldItems(citySeedRows(['Bend', 'Redmond']), 'Be', { fromServer: false }).map((i) => i.id)).toEqual([
      '/homes-for-sale?city=Bend',
      '/homes-for-sale?city=Redmond',
    ])
    expect(searchFieldItems([bend], 'bend', { fromServer: true }).map((i) => i.id)).toEqual(['/homes-for-sale/bend'])
    expect(searchFieldItems([address], '2666 26th', { fromServer: true }).map((i) => i.id)).toEqual([address.href])
  })
})
