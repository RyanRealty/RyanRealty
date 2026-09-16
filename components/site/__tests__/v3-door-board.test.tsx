import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3DoorBoard, type V3DoorBoardTile } from '@/components/site/v3/V3DoorBoard'
import { v3Text } from '@/components/site/v3/atoms'

/**
 * PATTERN 11: DOOR BOARD (SITE-92 round 5). What these tests hold is the
 * honesty of the board, not its looks: every figure the board prints is the
 * caller's, served settled from the first byte; a tile with no figure says so
 * and never prints a zero; every door is a real link; and the board renders
 * nothing rather than a heading over no places.
 */

function tile(over: Partial<V3DoorBoardTile> = {}): V3DoorBoardTile {
  return {
    id: 'bend',
    name: v3Text('Bend'),
    href: '/cities/bend',
    media: { src: '/images/cities/bend.jpg' },
    figure: { value: 614, formatted: v3Text('614'), unit: v3Text('single-family for sale') },
    line: v3Text('Median list $972,000 · Seller’s market · 3.5 months of supply'),
    doors: [
      { label: v3Text('Bend guide'), href: '/cities/bend' },
      { label: v3Text('Homes for sale'), href: '/homes-for-sale/bend' },
      {
        label: v3Text('Open houses'),
        href: '/open-houses/bend',
        figure: { value: 12, formatted: v3Text('12'), unit: v3Text('this week') },
      },
    ],
    ...over,
  }
}

function render(tiles: readonly V3DoorBoardTile[]) {
  return renderToStaticMarkup(
    createElement(V3DoorBoard, {
      id: 'city-doors',
      eyebrow: v3Text('Straight to the listings'),
      heading: v3Text('Every city, every door'),
      lede: v3Text('Every featured city with its live count and the doors it opens.'),
      tiles,
      source: v3Text('live MLS through Oregon Data Share'),
      updated: v3Text('Sep 15, 2026'),
    }),
  )
}

describe('V3DoorBoard', () => {
  it('serves every figure settled, with the digits the caller formatted, beside what they count', () => {
    const html = render([tile()])
    // The tile's figure: the digit primitive carries the sourced value beside its face.
    expect(html).toMatch(/data-settled="614"[^>]*>614</)
    expect(html).toContain('single-family for sale')
    // The open-house door's own figure, the count it opens onto.
    expect(html).toMatch(/data-settled="12"[^>]*>12</)
    expect(html).toContain('this week')
    // Never a placeholder zero under a non-zero settled figure (ci:route-smoke).
    expect(html).not.toMatch(/data-settled="614"[^>]*>0</)
  })

  it('prints the honest line for a tile with no published figure, never a zero', () => {
    const html = render([tile({ figure: undefined, absent: v3Text('No live count') })])
    expect(html).toContain('v3-door-board__figure--absent')
    expect(html).toContain('No live count')
    // No tile numeral at all — not a zero, not a placeholder. The open-house
    // door's own count is a different figure and stays.
    expect(html).not.toContain('v3-door-board__count-digits')
    expect(html).not.toMatch(/data-settled="0"/)
    expect(html).toMatch(/data-settled="12"[^>]*>12</)
  })

  it('makes every door and every face a real link, namespaced under the board', () => {
    const html = render([tile()])
    expect(html).toContain('href="/cities/bend"')
    expect(html).toContain('href="/homes-for-sale/bend"')
    expect(html).toContain('href="/open-houses/bend"')
    expect(html).toContain('id="city-doors-bend"')
    expect(html).toContain('aria-labelledby="city-doors-heading"')
    // The photograph is decorative: the face is named by the place.
    expect(html).toMatch(/<img[^>]*alt=""/)
    expect(html).toContain('Bend</span>')
  })

  it('leads with the tile the caller marked and draws the mark where there is no photograph', () => {
    const html = render([
      tile({ lead: true }),
      tile({
        id: 'metolius',
        name: v3Text('Metolius'),
        href: '/cities/metolius',
        media: undefined,
        mark: createElement('svg', { 'data-mark': 'outline' }),
        lead: false,
      }),
    ])
    expect(html).toContain('v3-door-board__tile--lead')
    expect(html).toContain('v3-door-board__tile--drawn')
    expect(html).toContain('data-mark="outline"')
  })

  it('renders nothing for an empty board rather than a heading over no places', () => {
    expect(render([])).toBe('')
  })

  it('joins the freshness stamp into the trace the way every pattern does', () => {
    const html = render([tile()])
    expect(html).toContain('live MLS through Oregon Data Share · updated Sep 15, 2026')
  })
})
