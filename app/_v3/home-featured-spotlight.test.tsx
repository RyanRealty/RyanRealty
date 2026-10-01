import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HomeFeaturedCommunity, spotlightOrder } from './HomeFeaturedCommunity.client'
import type { HomeFeaturedCommunitySlide } from './home-featured-community-shared'

const slide = (slug: string, n: number | null, median?: number): HomeFeaturedCommunitySlide => ({
  slug,
  name: slug.replace(/(^|-)(\w)/g, (_m, s: string, c: string) => `${s ? ' ' : ''}${c.toUpperCase()}`),
  city: 'Bend',
  href: `/communities/${slug}`,
  photoSrc: `/images/${slug}.jpg`,
  blurb: `${slug} began as a plan.`,
  figures: [
    ...(n != null ? [{ value: String(n), label: n === 1 ? 'home for sale' : 'homes for sale', n }] : []),
    ...(median ? [{ value: `$${median.toLocaleString('en-US')}`, label: 'median list price', n: median }] : []),
    { value: '4', label: 'new this week', n: 4 },
  ],
})

describe('the featured-community spotlight (2026-10-01)', () => {
  it('orders busiest first and drops an uncounted community while others are counted', () => {
    const order = spotlightOrder([slide('tetherow', 22), slide('crosswater', null), slide('eagle-crest', 104)])
    expect(order.map((s) => s.slug)).toEqual(['eagle-crest', 'tetherow'])
  })

  it('keeps every slide, curated order, when no count was read', () => {
    const order = spotlightOrder([slide('tetherow', null), slide('crosswater', null)])
    expect(order.map((s) => s.slug)).toEqual(['tetherow', 'crosswater'])
  })

  it('serves every panel and door, shows the first, and labels every figure', () => {
    const html = renderToStaticMarkup(
      <HomeFeaturedCommunity slides={[slide('tetherow', 22, 1_922_500), slide('eagle-crest', 104, 650_000)]} />,
    )
    expect(html.match(/role="tabpanel"/g)).toHaveLength(2)
    expect(html.match(/role="tab"/g)).toHaveLength(2)
    expect(html).toContain('href="/communities/tetherow"')
    expect(html).toContain('href="/communities/eagle-crest"')
    // Eagle Crest (104) leads and shows; Tetherow's panel is served hidden.
    expect(html).toMatch(/aria-selected="true"[^>]*>[\s\S]*?Eagle Crest/)
    expect(html.match(/hidden=""/g)).toHaveLength(1)
    // The index count is labelled; the panel prints each figure over its label.
    expect(html).toMatch(/104 <span class="home-featured-community__tab-unit">for sale<\/span>/)
    expect(html).toMatch(/<dt class="home-featured-community__figure-label">homes for sale<\/dt><dd class="home-featured-community__figure-value">104<\/dd>/)
    expect(html).toMatch(/median list price<\/dt><dd class="home-featured-community__figure-value">\$650,000<\/dd>/)
    // The pulse's narrower-population figure does not stand beside the alias-aware pair.
    expect(html).not.toContain('new this week')
    // A rule per counted row on one scale: the busiest full, the other its share.
    expect(html).toContain('width:100%')
    expect(html).toMatch(/width:21\.15\d*%/)
  })
})
