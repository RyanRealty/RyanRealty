import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { priceDropBands, priceDropCityDoors } from './drops-bands'
import type { PriceDropFieldItem } from './drops-field-items'

function item(over: Partial<PriceDropFieldItem> & Pick<PriceDropFieldItem, 'id'>): PriceDropFieldItem {
  return {
    href: `/homes-for-sale/listing/${over.id}`,
    priceLabel: '$500,000',
    title: '1 Test St',
    ...over,
  }
}

describe('priceDropBands', () => {
  const items = [
    item({ id: 'a', cutPct: 3.2, city: 'Bend', citySlug: 'bend' }),
    item({ id: 'b', cutPct: 7.5, city: 'Redmond', citySlug: 'redmond' }),
    item({ id: 'c', cutPct: 12, city: 'Bend', citySlug: 'bend' }),
  ]

  it('leads with every cut and drops empty bands', () => {
    const bands = priceDropBands(items)
    expect(bands.map((b) => b.key)).toEqual(['all', 'under-5', '5-10', '10-plus'])
    expect(bands[0]!.items).toHaveLength(3)
    expect(bands.find((b) => b.key === 'under-5')!.items.map((row) => row.id)).toEqual(['a'])
    expect(bands.find((b) => b.key === '10-plus')!.items.map((row) => row.id)).toEqual(['c'])
  })

  it('omits a band that has no homes', () => {
    const bands = priceDropBands([item({ id: 'only', cutPct: 11 })])
    expect(bands.map((b) => b.key)).toEqual(['all', '10-plus'])
  })
})

describe('priceDropCityDoors', () => {
  it('emits one crawlable door per city we pre-render, first-seen order', () => {
    const doors = priceDropCityDoors([
      item({ id: 'a', city: 'Bend', citySlug: 'bend' }),
      item({ id: 'b', city: 'Redmond', citySlug: 'redmond' }),
      item({ id: 'c', city: 'Bend', citySlug: 'bend' }),
      item({ id: 'd', city: 'Medford', citySlug: 'medford' }),
    ])
    expect(doors).toEqual([
      { slug: 'bend', label: 'Bend', href: '/price-drops/bend' },
      { slug: 'redmond', label: 'Redmond', href: '/price-drops/redmond' },
    ])
  })
})

describe('price-drops catalog install', () => {
  it('imports the installed shadcn carousel from the route v3 files', () => {
    const photos = readFileSync(new URL('./PriceDropPhotos.client.tsx', import.meta.url), 'utf8')
    const fold = readFileSync(new URL('./PriceDropsFold.client.tsx', import.meta.url), 'utf8')
    expect(photos).toContain("from '@/components/ui/carousel'")
    expect(fold).toContain('PriceDropPhotos')
  })
})
