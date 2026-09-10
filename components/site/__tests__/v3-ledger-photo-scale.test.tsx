import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Ledger, type V3LedgerFigureRow } from '@/components/site/v3/V3Ledger'
import { v3Text } from '@/components/site/v3/atoms'

/**
 * SITE-59. The listing rows on /oregon/[city] drew each home's photograph in
 * the pattern's 44px mark — the same box, at the same pale fill, that a row
 * with NO photograph draws. An evaluator reading a render on 2026-09-09 called
 * ten of twelve Medford rows broken images. They were not broken: 11 of 11
 * Medford rows and 5 of 5 Salem rows requested their picture, got a 200 from
 * cdn.resize.sparkplatform.com and decoded it. Forty-four pixels was simply not
 * enough of a photograph to be one, and it made "has a photo", "is fetching a
 * photo" and "has no photo" three states with one appearance.
 *
 * What these hold is that distinction, not a size: the photo scale is opt-in
 * (no other ledger on the site moves), a row WITH a picture renders an img
 * carrying that picture's own src, and a row WITHOUT one renders the glyph —
 * the designed navy tile — rather than an empty box.
 */

function row(over: Partial<V3LedgerFigureRow> = {}): V3LedgerFigureRow {
  return {
    href: '/listing/835-cherry-street-medford-or-97501-123',
    what: v3Text('835 Cherry Street, Medford'),
    value: v3Text('$364,000'),
    ...over,
  } as V3LedgerFigureRow
}

function render(rows: readonly V3LedgerFigureRow[], media?: 'mark' | 'photo') {
  const [first, ...rest] = rows
  return renderToStaticMarkup(
    createElement(V3Ledger, {
      heading: v3Text('The newest Medford listings'),
      source: v3Text('live MLS listing feed'),
      rows: [first!, ...rest],
      ...(media ? { media } : {}),
    }),
  )
}

const PHOTO_A = 'https://cdn.resize.sparkplatform.com/ore/320x240/true/20260501165710852242000000-o.jpg'
const PHOTO_B = 'https://cdn.resize.sparkplatform.com/ore/320x240/true/20260814182744473893000000-o.jpg'

describe('V3Ledger media="photo"', () => {
  it('is opt-in: nothing changes for a ledger that does not ask for it', () => {
    const html = render([row({ media: { src: PHOTO_A } })])
    expect(html).not.toContain('v3-ledger--photo')
  })

  it('marks the section when the caller asks, so the CSS scale applies to that list alone', () => {
    const html = render([row({ media: { src: PHOTO_A } })], 'photo')
    expect(html).toContain('v3-ledger--photo')
  })

  it('renders an img carrying THAT row’s own src — never a stand-in, never a shared one', () => {
    const html = render(
      [
        row({ media: { src: PHOTO_A } }),
        row({ href: '/listing/3025-skylakes-drive-medford-or-97504-456', media: { src: PHOTO_B } }),
      ],
      'photo',
    )
    const srcs = [...html.matchAll(/class="v3-ledger__media v3-ledger__thumb"[^>]*src="([^"]+)"/g)].map((m) => m[1])
    expect(srcs).toEqual([PHOTO_A, PHOTO_B])
  })

  it('gives a row with no photograph the glyph tile, not an empty box', () => {
    const html = render(
      [
        row({ media: { src: PHOTO_A } }),
        row({ href: '/listing/714-broad-street-medford-or-97501-789', what: v3Text('714 Broad Street, Medford') }),
      ],
      'photo',
    )
    // One picture, one designed tile. The tile carries the address's initial,
    // so the column has a mark on every row and one left edge.
    expect((html.match(/v3-ledger__thumb/g) ?? []).length).toBe(1)
    expect((html.match(/v3-ledger__glyph/g) ?? []).length).toBe(1)
    expect(html).toMatch(/v3-ledger__glyph"[^>]*>7</)
  })

  it('never emits an img with an empty src', () => {
    const html = render([row({ media: { src: PHOTO_A } }), row({ href: '/listing/x-2' })], 'photo')
    expect(html).not.toMatch(/<img[^>]*src=""/)
  })
})

describe('the photo scale in V3Ledger.css', () => {
  const css = fs.readFileSync(
    path.join(process.cwd(), 'components/site/v3/V3Ledger.css'),
    'utf8',
  )

  it('draws the photograph 4:3 and larger than the tap-target mark it replaced', () => {
    const block = css.match(/\.v3-ledger--photo \.v3-ledger__media \{([^}]+)\}/)?.[1] ?? ''
    expect(block).toMatch(/width:\s*5\.5rem/)
    expect(block).toMatch(/height:\s*4\.125rem/)
    // 5.5 / 4.125 === 4/3, the shape MLS photographs are already taken in.
    expect(5.5 / 4.125).toBeCloseTo(4 / 3, 6)
  })

  it('fills the box with the glyph’s navy tile, never the pale wash a blank reads as', () => {
    const block = css.match(/\.v3-ledger--photo \.v3-ledger__media \{([^}]+)\}/)?.[1] ?? ''
    expect(block).toMatch(/background:\s*var\(--v3-navy\)/)
    expect(block).not.toMatch(/--v3-wash/)
  })

  it('covers the browser’s broken-image icon on a photograph that fails to arrive', () => {
    expect(css).toMatch(/\.v3-ledger--photo \.v3-ledger__thumb::after \{/)
    const block = css.match(/\.v3-ledger--photo \.v3-ledger__thumb::after \{([^}]+)\}/)?.[1] ?? ''
    expect(block).toMatch(/background:\s*var\(--v3-navy\)/)
    expect(block).toMatch(/inset:\s*0/)
  })
})
