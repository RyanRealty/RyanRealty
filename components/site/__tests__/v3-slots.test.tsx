import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Slots, v3Text, type V3SlotsProps } from '@/components/site/v3'

/** Stand-in for the caller's worked example — on /compare, the compare sheet. */
const EXAMPLE = createElement('div', { className: 'example-under-test' }, 'the tool’s real output')

function html(overrides: Partial<V3SlotsProps> = {}): string {
  const props: V3SlotsProps = {
    id: 'compare-empty',
    headline: v3Text('Compare homes'),
    headingLevel: 1,
    claim: 'Four homes, side by side.',
    slots: 4,
    emptyLabel: 'Add a home',
    emptyHref: '/homes-for-sale?view=list',
    sample: { label: 'Sample', caption: 'Four homes for sale right now, shown as an example.' },
    example: EXAMPLE,
    source: 'listing_tile_mv, standard_status Active, service-area cities.',
    ...overrides,
  }
  return renderToStaticMarkup(createElement(V3Slots, props))
}

function count(markup: string, needle: RegExp): number {
  return markup.match(needle)?.length ?? 0
}

describe('V3Slots — the tray', () => {
  it('withholds the empty tray when the sample is the opening', () => {
    const m = html()
    expect(count(m, /class="[^"]*v3-slots__slot /g)).toBe(0)
    expect(m).toContain('example-under-test')
  })

  it('carries the headline at the level the caller asked for', () => {
    expect(html()).toMatch(/<h1[^>]*>Compare homes<\/h1>/)
    expect(html({ headingLevel: 2 })).toMatch(/<h2[^>]*>Compare homes<\/h2>/)
  })

  it('shows the tray once the visitor has a home in it', () => {
    const m = html({
      filled: [{ key: 'k1', label: '787 Union Loop', href: '/homes-for-sale/prineville/787-union-220228128' }],
    })
    expect(count(m, /data-state="full"/g)).toBe(1)
    expect(count(m, /data-state="empty"/g)).toBe(3)
    expect(m).toContain('787 Union Loop')
  })

  it('clamps the slot count to something a tray can be', () => {
    expect(count(html({ slots: 1, example: undefined }), /data-state="empty"/g)).toBe(2)
    expect(count(html({ slots: 40, example: undefined }), /data-state="empty"/g)).toBe(6)
  })

  it('sends an empty slot to the place a visitor finds subjects', () => {
    expect(html({ example: undefined })).toContain('href="/homes-for-sale?view=list"')
  })
})

describe('V3Slots — the worked example', () => {
  it('labels the example in visible words, not a styling cue', () => {
    expect(html()).toMatch(/class="v3-slots__sample-tag">Sample</)
    expect(html()).toContain('shown as an example')
  })

  it('withholds the whole example rather than ship an unlabelled one', () => {
    const m = html({ sample: { label: '   ', caption: 'c' } })
    expect(m).not.toContain('example-under-test')
    // No labelled sample → the tray stands in, and the trace still renders.
    expect(count(m, /data-state="empty"/g)).toBe(4)
    expect(m).toContain('v3-slots__source')
  })

  it('stands the tray up when the caller has no example to show', () => {
    const m = html({ example: undefined })
    expect(m).not.toContain('v3-slots__sample-tag')
    expect(count(m, /data-state="empty"/g)).toBe(4)
  })

  it('always carries the section 0 trace', () => {
    expect(html()).toContain('listing_tile_mv')
  })
})
