import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Slots, v3Text, type V3SlotsColumn, type V3SlotsProps } from '@/components/site/v3'

const COLUMNS: V3SlotsColumn[] = [
  {
    key: 'k1',
    href: '/homes-for-sale/prineville/ironhorse/787-union-220228128',
    addHref: '/compare?ids=k1',
    title: '787 Union Loop',
    place: 'Prineville',
    facts: ['$435,000', '4', '3', '2,090', '0.13 ac', '2020', '7'],
  },
  {
    key: 'k2',
    href: '/homes-for-sale/redmond/cascade-view-estates/3672-volcano-220225586',
    addHref: '/compare?ids=k2',
    title: '3672 Volcano Avenue',
    place: 'Redmond',
    facts: ['$569,900', '3', '3', '1,856', '0.21 ac', '2019', '55'],
  },
]

const ROWS = ['Price', 'Beds', 'Baths', 'Sq ft', 'Lot', 'Year built', 'Days on market']

function html(overrides: Partial<V3SlotsProps> = {}): string {
  const props: V3SlotsProps = {
    id: 'compare-empty',
    headline: v3Text('Compare homes'),
    headingLevel: 1,
    claim: 'Four homes, side by side.',
    slots: 4,
    emptyLabel: 'Add a home',
    emptyHref: '/homes-for-sale?view=list',
    sample: {
      label: 'Sample',
      caption: 'Two homes for sale right now, shown as an example.',
      rows: ROWS,
      columns: COLUMNS,
      addLabel: 'Add this home',
    },
    source: 'listing_tile_mv, standard_status Active, service-area cities.',
    ...overrides,
  }
  return renderToStaticMarkup(createElement(V3Slots, props))
}

function count(markup: string, needle: RegExp): number {
  return markup.match(needle)?.length ?? 0
}

describe('V3Slots — the tray', () => {
  it('draws one slot per place the tool holds', () => {
    const m = html()
    expect(count(m, /class="[^"]*v3-slots__slot /g)).toBe(4)
    expect(count(m, /data-state="empty"/g)).toBe(4)
    expect(count(m, /data-slot="[1-4]"/g)).toBe(4)
  })

  it('carries the headline at the level the caller asked for', () => {
    expect(html()).toMatch(/<h1[^>]*>Compare homes<\/h1>/)
    expect(html({ headingLevel: 2 })).toMatch(/<h2[^>]*>Compare homes<\/h2>/)
  })

  it('shows what is in a filled slot and leaves the rest open', () => {
    const m = html({
      filled: [{ key: 'k1', label: '787 Union Loop', href: COLUMNS[0]!.href }],
    })
    expect(count(m, /data-state="full"/g)).toBe(1)
    expect(count(m, /data-state="empty"/g)).toBe(3)
    expect(m).toContain('787 Union Loop')
  })

  it('clamps the slot count to something a tray can be', () => {
    expect(count(html({ slots: 1 }), /data-state="empty"/g)).toBe(2)
    expect(count(html({ slots: 40 }), /data-state="empty"/g)).toBe(6)
  })

  it('sends an empty slot to the place a visitor finds subjects', () => {
    expect(html()).toContain('href="/homes-for-sale?view=list"')
  })
})

describe('V3Slots — the worked example', () => {
  it('labels the example in visible words, not a styling cue', () => {
    expect(html()).toMatch(/class="v3-slots__sample-tag">Sample</)
  })

  it('withholds the whole example rather than ship an unlabelled one', () => {
    const m = html({
      sample: { label: '   ', caption: 'c', rows: ROWS, columns: COLUMNS, addLabel: 'Add this home' },
    })
    expect(m).not.toContain('v3-slots__table')
    // The tray and the trace still render — only the example is withheld.
    expect(count(m, /data-state="empty"/g)).toBe(4)
    expect(m).toContain('v3-slots__source')
  })

  it('renders the example as a real table, one column per subject', () => {
    const m = html()
    expect(count(m, /class="v3-slots__col"/g)).toBe(2)
    for (const row of ROWS) expect(m).toContain(`>${row}</th>`)
    expect(m).toContain('$435,000')
    expect(m).toContain('$569,900')
  })

  it('gives every example column an add control that works as a plain link', () => {
    const m = html()
    expect(m).toContain('href="/compare?ids=k1"')
    expect(m).toContain('href="/compare?ids=k2"')
    // Each add names the home it adds, so identical buttons get different names.
    expect(count(m, /Add this home/g)).toBe(2)
    expect(m).toContain('— 787 Union Loop')
    expect(m).toContain('— 3672 Volcano Avenue')
  })

  it('links every example column to the listing it shows', () => {
    const m = html()
    expect(m).toContain(COLUMNS[0]!.href)
    expect(m).toContain(COLUMNS[1]!.href)
  })

  it('fills a short fact list with an em dash rather than dropping a cell', () => {
    const m = html({
      sample: {
        label: 'Sample',
        caption: 'c',
        rows: ROWS,
        columns: [{ ...COLUMNS[0]!, facts: ['$435,000'] }],
        addLabel: 'Add this home',
      },
    })
    expect(count(m, /class="v3-slots__value">—<\/span>/g)).toBe(ROWS.length - 1)
    expect(count(m, /class="v3-slots__value">\$435,000<\/span>/g)).toBe(1)
  })

  it('draws a length only where the caller gave the row a weight', () => {
    const m = html({
      sample: {
        label: 'Sample',
        caption: 'c',
        rows: ['Price', 'Year built'],
        columns: [
          { ...COLUMNS[0]!, facts: ['$435,000', '2020'], weights: [0.76, null] },
          { ...COLUMNS[1]!, facts: ['$569,900', '2019'], weights: [1, null] },
        ],
        addLabel: 'Add this home',
      },
    })
    // Two priced cells carry a bar; the two year cells do not.
    expect(count(m, /class="v3-slots__bar"/g)).toBe(2)
    expect(m).toContain('--v3-slots-w:0.76')
    expect(m).toContain('--v3-slots-w:1')
  })

  it('ignores a weight that is not a drawable share', () => {
    const m = html({
      sample: {
        label: 'Sample',
        caption: 'c',
        rows: ['Price'],
        columns: [
          { ...COLUMNS[0]!, facts: ['$435,000'], weights: [0] },
          { ...COLUMNS[1]!, facts: ['$569,900'], weights: [Number.NaN] },
        ],
        addLabel: 'Add this home',
      },
    })
    expect(count(m, /class="v3-slots__bar"/g)).toBe(0)
  })

  it('clamps a weight over one rather than overrunning its track', () => {
    const m = html({
      sample: {
        label: 'Sample',
        caption: 'c',
        rows: ['Price'],
        columns: [{ ...COLUMNS[0]!, facts: ['$435,000'], weights: [4.2] }],
        addLabel: 'Add this home',
      },
    })
    expect(m).toContain('--v3-slots-w:1')
    expect(m).not.toContain('4.2')
  })

  it('caps the example at the four columns that stay legible', () => {
    const many = Array.from({ length: 7 }, (_, i) => ({ ...COLUMNS[0]!, key: `k${i}` }))
    const m = html({
      sample: { label: 'Sample', caption: 'c', rows: ROWS, columns: many, addLabel: 'Add this home' },
    })
    expect(count(m, /class="v3-slots__col"/g)).toBe(4)
  })

  it('always carries the section 0 trace', () => {
    expect(html()).toContain('listing_tile_mv')
  })
})
