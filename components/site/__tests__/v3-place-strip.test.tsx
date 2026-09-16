import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3PlaceStrip, type V3PlaceStripProps } from '@/components/site/v3/V3PlaceStrip'
import { v3Text } from '@/components/site/v3/atoms'

/**
 * THE PLACE STRIP (SITE-92 round 5): the claim's count is served settled from
 * the first byte, an absent count prints the sentence alone (absent is not
 * zero), every place is a door drawn with its recorded outline or the map's
 * point mark, and the trace is always present.
 */

const OUTLINE = { d: 'M5 5L39 5L39 39L5 39Z', viewBox: '0 0 44 44' }

function render(over: Partial<V3PlaceStripProps> = {}) {
  return renderToStaticMarkup(
    createElement(V3PlaceStrip, {
      claim: {
        count: { value: 256, formatted: v3Text('256') },
        text: v3Text('houses came on the market in Central Oregon in the last 30 days.'),
      },
      label: v3Text('Every town the Atlas draws'),
      places: [
        { id: 'bend', name: v3Text('Bend'), href: '/cities/bend', silhouette: OUTLINE },
        { id: 'tumalo', name: v3Text('Tumalo'), href: '/cities/tumalo', silhouette: null },
      ],
      source: v3Text('regional MLS through Oregon Data Share, new listings in the last 30 days'),
      sourceName: 'Oregon Data Share',
      ...over,
    }),
  )
}

describe('V3PlaceStrip', () => {
  it('serves the count settled beside its sentence', () => {
    const html = render()
    expect(html).toMatch(/data-settled="256"[^>]*>256</)
    expect(html).toContain('houses came on the market in Central Oregon in the last 30 days.')
  })

  it('prints the sentence alone when no count was published', () => {
    const html = render({ claim: { text: v3Text('New Central Oregon listings, by email, as they come on the market.') } })
    expect(html).not.toContain('data-settled')
    expect(html).toContain('New Central Oregon listings, by email, as they come on the market.')
  })

  it('draws every place as a door: the recorded outline where there is one, the point mark where not', () => {
    const html = render()
    expect(html).toContain('href="/cities/bend"')
    expect(html).toContain('href="/cities/tumalo"')
    expect(html).toContain('v3-place-mark--drawn')
    expect(html).toContain('v3-place-mark--point')
    expect(html).toContain('Every town the Atlas draws')
  })

  it('always carries the trace', () => {
    const html = render()
    expect(html).toContain('regional MLS through Oregon Data Share, new listings in the last 30 days')
  })

  it('omits the strip, but not the claim, when there are no places', () => {
    const html = render({ places: [] })
    expect(html).not.toContain('v3-place-strip__list')
    expect(html).toMatch(/data-settled="256"/)
  })
})
