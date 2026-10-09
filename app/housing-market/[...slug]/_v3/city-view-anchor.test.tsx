/**
 * The pinned decision aeo-market-lead-and-tables (data/seo/decisions.json,
 * checked live by deploy:verify) requires /housing-market/bend to carry
 * id="takeaways". #434 moved the answer under the H1 and dropped the section
 * that held the id, so production failed the live SEO baseline on 2026-10-09.
 * The answer carries the anchor wherever it renders, exactly once.
 */
import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { CityMarketView } from './city-view'

const TAKEAWAYS = [
  'Bend has 3.6 months of supply, a seller’s market.',
  'The median single-family home in Bend sold for $759,000 in September 2026.',
]

function render(closedFigures: { value: string; label: string }[]) {
  return renderToStaticMarkup(
    createElement(CityMarketView, {
      cityName: 'Bend',
      citySlug: 'bend',
      hud: null,
      mosText: null,
      verdict: { kind: 'balanced', label: 'Balanced' },
      refreshedAt: null,
      valuationHrefValue: '/sell',
      snapshots: [],
      faqs: [],
      posts: [],
      closedFigures,
      closedTrace: null,
      sheet: null,
      takeaways: TAKEAWAYS,
    } as unknown as Parameters<typeof CityMarketView>[0]),
  )
}

const anchors = (html: string) => html.match(/ id="takeaways"/g)?.length ?? 0

describe('/housing-market/<city> keeps #takeaways (aeo-market-lead-and-tables)', () => {
  it('with the instrument: the answer under the H1 carries the anchor, once', () => {
    const html = render([{ value: '$759,000', label: 'Median sale price' }])
    expect(anchors(html)).toBe(1)
    expect(html).toMatch(/<div id="takeaways" class="v3-takeaways v3-takeaways--lede">/)
    expect(html).toContain('class="v3-takeaways__lead"')
  })

  it('without the instrument: the fallback section carries it, once', () => {
    const html = render([])
    expect(anchors(html)).toBe(1)
    expect(html).toMatch(/<section id="takeaways"/)
  })
})
