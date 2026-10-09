import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { V3Takeaways, V3TakeawaysLead } from '@/components/site/v3'

const ITEMS = [
  "Bend has 3.6 months of supply, a seller's market, so sellers have the edge.",
  'The median single-family home in Bend sold for $759,000 in September 2026.',
  'The typical Bend home sold for 97.0% of its original asking price over the last 12 months.',
]

describe('V3Takeaways', () => {
  it('renders an H2 and one lead paragraph, figures set strong, text unchanged', () => {
    const html = renderToStaticMarkup(createElement(V3Takeaways, { id: 'takeaways', heading: 'Bend at a glance', items: ITEMS }))
    expect(html).toMatch(/<h2[^>]*>Bend at a glance<\/h2>/)
    expect(html.match(/<p class="v3-takeaways__lead"/g)).toHaveLength(1)
    expect(html).toContain('<strong class="v3-takeaways__figure">3.6 months of supply</strong>')
    expect(html).toContain('<strong class="v3-takeaways__figure">$759,000</strong>')
    expect(html).toContain('<strong class="v3-takeaways__figure">97.0%</strong>')
    const city = renderToStaticMarkup(
      createElement(V3Takeaways, { id: 't', heading: 'h', items: ['726 single-family houses with a Bend address are for sale.', 'b 2%.'] }),
    )
    expect(city).toContain('<strong class="v3-takeaways__figure">726 single-family houses</strong>')
    // "12 months" and "September 2026" are windows, not the figure.
    expect(html).not.toContain('<strong class="v3-takeaways__figure">12')
    expect(html.replace(/<[^>]+>/g, '')).toContain(ITEMS[1])
  })

  it('never sets a window ("90 days", "12 months") as the figure', () => {
    const html = renderToStaticMarkup(
      createElement(V3Takeaways, { id: 't', heading: 'h', items: ['Half went pending within 29 days in the last 90 days.', 'b 2%.'] }),
    )
    expect(html).not.toContain('<strong class="v3-takeaways__figure">90 days</strong>')
  })

  it('renders nothing for fewer than two sentences', () => {
    expect(renderToStaticMarkup(createElement(V3Takeaways, { id: 't', heading: 'h', items: [ITEMS[0]] }))).toBe('')
  })
})

describe('V3TakeawaysLead', () => {
  it('carries the takeaways anchor the pinned SEO decision reads (aeo-market-lead-and-tables)', () => {
    const html = renderToStaticMarkup(createElement(V3TakeawaysLead, { items: ITEMS }))
    expect(html).toContain('id="takeaways"')
  })
})
