import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BEND_NEW_CONSTRUCTION_H1 } from '@/lib/site/bend-new-construction'
import {
  NEW_CON_PHOTOGRAPHED_HOME_ITEM_LIST_NAME,
  photographedNewConHomeItemList,
  photographedNewConHomeJsonLd,
} from './photographed-home-item-list'

const CARD = {
  href: '/homes-for-sale/bend/easton/1-oak-st-220123456',
  addressLine: '1 Oak St',
  price: 449_900,
  propertyType: 'Residential',
  photoUrls: ['https://example.com/easton.jpg'],
}

describe('photographedNewConHomeItemList (SITE-175)', () => {
  it('cites canonical /homes-for-sale listing URLs from the photographed shelf', () => {
    const list = photographedNewConHomeItemList([CARD])
    expect(list?.name).toBe(NEW_CON_PHOTOGRAPHED_HOME_ITEM_LIST_NAME)
    expect(list?.items).toEqual([
      {
        name: '$449,900 · 1 Oak St',
        url: '/homes-for-sale/bend/easton/1-oak-st-220123456',
      },
    ])
    const json = photographedNewConHomeJsonLd([CARD])
    const items = json?.itemListElement as Array<{ url: string }>
    expect(json?.['@type']).toBe('ItemList')
    expect(items[0]?.url).toMatch(/\/homes-for-sale\/bend\/easton\/1-oak-st-220123456$/)
  })

  it('withholds a home that has no photograph, and withholds an empty shelf', () => {
    expect(
      photographedNewConHomeItemList([{ ...CARD, photoUrls: [''] }]),
    ).toBeNull()
    expect(photographedNewConHomeItemList([])).toBeNull()
    expect(photographedNewConHomeJsonLd([])).toBeNull()
  })

  it('drops subdivision browse URLs so the list is homes, not community names', () => {
    expect(
      photographedNewConHomeItemList([
        {
          ...CARD,
          href: '/homes-for-sale/bend/easton',
        },
      ]),
    ).toBeNull()
  })

  it('wires the helper into /new-construction JSON-LD without changing the H1', () => {
    const page = readFileSync(resolve('app/new-construction/page.tsx'), 'utf8')
    const adapter = readFileSync(
      resolve('app/new-construction/_v3/photographed-home-item-list.ts'),
      'utf8',
    )
    expect(adapter).toContain('listingItemListFromHomes')
    expect(adapter).not.toMatch(/function listingItemList\s*\(/)
    expect(page).toContain('photographedNewConHomeJsonLd')
    expect(page).toContain('lead.cards')
    expect(page).toContain('Live Active Bend new-construction communities')
    expect(page).toContain('BEND_NEW_CONSTRUCTION_H1')
    expect(page).not.toContain("headline: '")
    expect(BEND_NEW_CONSTRUCTION_H1).toBe('New homes in Bend: inventory and builder savings')
  })
})
