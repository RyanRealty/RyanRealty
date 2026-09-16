import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import {
  CompareSheet,
  type CompareSheetHome,
  type CompareSheetProps,
  type CompareSheetRow,
} from './CompareSheet.client'

const ROWS: CompareSheetRow[] = [
  {
    label: 'Price',
    reading: '$435,000 at 787 Union Loop · $569,900 at 3672 Volcano Avenue · $134,900 apart, 31% more',
    readingShort: '$435,000 lowest · $569,900 highest · $134,900 apart, 31% more',
    encoded: true,
  },
  { label: 'Beds', reading: '3 at 3672 Volcano Avenue · 4 at 787 Union Loop · 1 more beds', encoded: false },
  {
    label: 'Year built',
    reading: '2019 at 3672 Volcano Avenue · 2020 at 787 Union Loop · 1 years apart',
    encoded: false,
  },
]

const HOMES: CompareSheetHome[] = [
  {
    key: 'k1',
    href: '/homes-for-sale/prineville/ironhorse/787-union-220228128',
    addHref: '/compare?ids=k1',
    title: '787 Union Loop',
    shortTitle: 'Union',
    place: 'Prineville',
    price: '$435,000',
    facts: '4 bd · 3 ba · 2,090 sq ft',
    photos: [
      { url: 'https://cdn.example.com/k1-1.jpg', alt: '787 Union Loop, Prineville — photograph 1 of 2' },
      { url: 'https://cdn.example.com/k1-2.jpg', alt: '787 Union Loop, Prineville — photograph 2 of 2' },
    ],
    values: ['$435,000', '4', '2020'],
    weights: [0.76, null, null],
    marks: ['low', null, null],
  },
  {
    key: 'k2',
    href: '/homes-for-sale/redmond/cascade-view-estates/3672-volcano-220225586',
    addHref: '/compare?ids=k2',
    title: '3672 Volcano Avenue',
    shortTitle: 'Volcano',
    place: 'Redmond',
    price: '$569,900',
    facts: '3 bd · 3 ba · 1,856 sq ft',
    photos: [{ url: 'https://cdn.example.com/k2-1.jpg', alt: '3672 Volcano Avenue, Redmond — photograph 1 of 1' }],
    values: ['$569,900', '3', '2019'],
    weights: [1, null, null],
    marks: ['high', null, null],
  },
]

function html(overrides: Partial<CompareSheetProps> = {}): string {
  const props: CompareSheetProps = {
    homes: HOMES,
    rows: ROWS,
    caption: 'Every figure read from listing_tile_mv in this render, Sep 15, 2026, 9:12 PM.',
    addLabel: 'Add',
    ...overrides,
  }
  return renderToStaticMarkup(createElement(CompareSheet, props))
}

function count(markup: string, needle: RegExp): number {
  return markup.match(needle)?.length ?? 0
}

describe('CompareSheet — the installed kit', () => {
  it('is the shadcn table, with its own data-slot rows', () => {
    const m = html()
    expect(m).toContain('data-slot="table"')
    expect(m).toContain('data-slot="table-header"')
    expect(m).toContain('data-slot="table-body"')
    // One row per field, plus the two header rows (photographs, then labels).
    expect(count(m, /data-slot="table-row"/g)).toBe(ROWS.length + 2)
    // cn() merges the kit's own classes ahead of ours, so match the tail.
    expect(count(m, /compare-sheet__label"/g)).toBe(HOMES.length)
    expect(m).toContain('data-slot="table-caption"')
  })

  it('is the shadcn carousel, one per home, with its prev/next', () => {
    const m = html()
    expect(count(m, /data-slot="carousel"/g)).toBe(2)
    // Only the home with more than one photograph gets steps to page it.
    expect(count(m, /data-slot="carousel-previous"/g)).toBe(1)
    expect(count(m, /data-slot="carousel-next"/g)).toBe(1)
    expect(count(m, /data-slot="carousel-item"/g)).toBe(3)
  })

  it('prints which frame the rail is on, the way the catalog demo does', () => {
    const m = html()
    // "1 of 2" for the home with two photographs; the single-photo home gets
    // no track and no read at all.
    expect(count(m, /class="compare-sheet__count"/g)).toBe(1)
    expect(m).toContain('1 of 2')
    expect(count(m, /data-state="on"/g)).toBe(1)
    expect(count(m, /data-state="off"/g)).toBe(1)
  })

  it('marks the left-most rail so a capture cannot click another card', () => {
    expect(count(html(), /data-compare-first="true"/g)).toBe(1)
  })

  it('renders every photograph the page handed it, with real alt text', () => {
    const m = html()
    expect(m).toContain('https://cdn.example.com/k1-2.jpg')
    expect(m).toContain('787 Union Loop, Prineville — photograph 2 of 2')
  })
})

describe('CompareSheet — the comparison', () => {
  it('opens on the first field and states its spread', () => {
    const m = html()
    expect(m).toContain('$134,900 apart, 31% more')
    expect(m).toMatch(/compare-sheet__reading-label">Price</)
  })

  it('carries both readings so 375 can drop the addresses and keep the figures', () => {
    const m = html()
    expect(m).toContain('at 787 Union Loop')
    expect(m).toContain('$435,000 lowest · $569,900 highest')
  })

  it('marks the extremes of the field being read, and only that field', () => {
    const m = html()
    expect(count(m, /class="compare-sheet__mark">Lowest</g)).toBe(1)
    expect(count(m, /class="compare-sheet__mark">Highest</g)).toBe(1)
  })

  it('selects the opening row so the kit state is visible before hydration', () => {
    expect(count(html(), /data-state="selected"/g)).toBe(1)
  })

  it('draws a length only where the caller marked the row encoded', () => {
    const m = html()
    expect(count(m, /class="compare-sheet__bar"/g)).toBe(2)
    expect(m).toContain('--compare-w:0.76')
    expect(m).toContain('--compare-w:1')
  })

  it('clamps a weight over one rather than overrunning its track', () => {
    const m = html({
      homes: [{ ...HOMES[0]!, weights: [4.2, null, null] }, HOMES[1]!],
    })
    expect(m).toContain('--compare-w:1')
    expect(m).not.toContain('4.2')
  })

  it('prints an em dash where the caller had no value, never a zero', () => {
    const m = html({ homes: [{ ...HOMES[0]!, values: ['$435,000'] }, HOMES[1]!] })
    expect(count(m, /class="compare-sheet__value">—<\/span>/g)).toBe(2)
  })

  it('prints a calendar year without a thousands separator', () => {
    const m = html()
    expect(m).toContain('>2020<')
    expect(m).not.toContain('2,020')
  })
})

describe('CompareSheet — the doors', () => {
  it('links every column to the listing it shows', () => {
    const m = html()
    for (const home of HOMES) expect(m).toContain(`href="${home.href}"`)
  })

  it('adds with a real URL, so the example works before hydration', () => {
    const m = html()
    expect(m).toContain('href="/compare?ids=k1"')
    expect(m).toContain('href="/compare?ids=k2"')
    // One add per home, each naming the home it adds.
    expect(count(m, /class="compare-sheet__add"/g)).toBe(2)
    expect(m).toContain('787 Union Loop to your comparison')
  })

  it('opens with every home in the sheet and names each in the picker', () => {
    const m = html()
    expect(count(m, /aria-pressed="true"/g)).toBe(2)
    expect(m).toContain('>Union<')
    expect(m).toContain('>Volcano<')
    expect(m).toContain('Sample shows two of two')
  })

  it('carries the as-of line under the table', () => {
    expect(html()).toContain('Every figure read from listing_tile_mv in this render')
  })

  it('renders nothing rather than half a comparison', () => {
    expect(html({ homes: [] })).toBe('')
    expect(html({ rows: [] })).toBe('')
  })
})
