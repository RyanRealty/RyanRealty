import { describe, expect, it } from 'vitest'
import { KB_TOP_NAV } from '@/lib/site-nav'
import {
  CHROME_MEGA_GROUP_KEYS,
  chromeMegaModel,
  chromeMegaPath,
  packMegaSections,
} from './chrome-mega'

function topGroup(label: string) {
  const group = KB_TOP_NAV.find((item) => item.label === label)
  if (!group) throw new Error(`KB_TOP_NAV missing ${label}`)
  return group
}

describe('chromeMegaPath', () => {
  it('drops query and hash so a door stays in one column', () => {
    expect(chromeMegaPath('/homes-for-sale?view=list')).toBe('/homes-for-sale')
    expect(chromeMegaPath('/sell#get-value')).toBe('/sell')
  })
})

describe('packMegaSections', () => {
  it('drops empty columns and folds a single leftover into the shortest fat column', () => {
    const packed = packMegaSections([
      { heading: 'Cities', links: [{ href: '/cities', label: 'All cities' }, { href: '/cities/bend', label: 'Bend' }] },
      { heading: 'Empty', links: [] },
      { heading: 'One', links: [{ href: '/neighborhoods', label: 'Neighborhoods' }] },
    ])
    expect(packed.map((section) => section.heading)).toEqual(['Cities'])
    expect(packed[0]?.links.map((link) => link.href)).toEqual(['/cities', '/cities/bend', '/neighborhoods'])
  })

  it('merges two or more thin columns into one More column', () => {
    const packed = packMegaSections([
      { heading: 'A', links: [{ href: '/a', label: 'A' }] },
      { heading: 'B', links: [{ href: '/b', label: 'B' }] },
      { heading: 'Fat', links: [{ href: '/c', label: 'C' }, { href: '/d', label: 'D' }] },
    ])
    expect(packed.map((section) => [section.heading, section.links.length])).toEqual([
      ['Fat', 2],
      ['More', 2],
    ])
  })
})

describe('chromeMegaModel — all five chrome menus', () => {
  const live = {
    eyebrow: 'Central Oregon detached homes right now',
    facts: [
      { figure: '$750K', label: 'median list price' },
      { figure: '5.1', label: 'months of supply, balanced market' },
    ],
    note: 'Read Sep 18, 2026',
  }

  it('models Homes, Places, Market, Sell, and About from the live top-nav set', () => {
    const models = {
      Buy: chromeMegaModel('Buy', topGroup('Buy').children),
      Areas: chromeMegaModel('Areas', topGroup('Areas').children),
      Market: chromeMegaModel('Market', topGroup('Market').children, live),
      Sell: chromeMegaModel('Sell', topGroup('Sell').children, {
        eyebrow: 'Central Oregon sellers right now',
        facts: [{ figure: '501', label: 'sold in the last 30 days' }],
      }),
      About: chromeMegaModel('About', topGroup('About').children),
    }

    expect(Object.keys(models)).toEqual(['Buy', 'Areas', 'Market', 'Sell', 'About'])
    expect(CHROME_MEGA_GROUP_KEYS).toEqual(['Buy', 'Areas', 'Market', 'Sell', 'About'])

    for (const [key, model] of Object.entries(models)) {
      expect(model.sections.length, key).toBeGreaterThan(0)
      expect(model.colCount, key).toBe(model.sections.length + (model.now ? 1 : 0))
      for (const section of model.sections) {
        expect(section.links.length, `${key} ${section.heading}`).toBeGreaterThanOrEqual(2)
      }
    }

    expect(models.Buy.sections.map((section) => section.heading)).toEqual([
      'Search',
      'Activity',
      'Collections',
    ])
    expect(models.Areas.sections.map((section) => section.heading)).toEqual([
      'Cities',
      'Communities',
      'Browse',
    ])
    expect(models.Areas.sections.find((section) => section.heading === 'Browse')?.links).toHaveLength(3)
    expect(models.Market.now?.heading).toBe('Now')
    expect(models.Market.caption).toBe('Central Oregon detached homes right now')
    expect(models.Market.colCount).toBe(4)
    expect(models.Sell.sections).toHaveLength(1)
    expect(models.Sell.now?.facts[0]?.figure).toBe('501')
    expect(models.About.sections.map((section) => section.heading)).toEqual(['Firm', 'Reach'])
  })

  it('never emits the old Places one-link dead columns', () => {
    const places = chromeMegaModel('Areas', topGroup('Areas').children)
    expect(places.sections.map((section) => section.heading)).not.toContain('Neighborhoods')
    expect(places.sections.map((section) => section.heading)).not.toContain('Subdivisions')
    expect(places.sections.map((section) => section.heading)).not.toContain('School districts')
    expect(places.sections.every((section) => section.links.length >= 2)).toBe(true)
  })

  it('keeps every featured door reachable after packing', () => {
    for (const key of CHROME_MEGA_GROUP_KEYS) {
      const group = topGroup(key)
      const model = chromeMegaModel(key, group.children)
      const packed = model.sections.flatMap((section) => section.links.map((link) => link.href))
      expect(packed.sort()).toEqual([...group.children.map((link) => link.href)].sort())
    }
  })
})
