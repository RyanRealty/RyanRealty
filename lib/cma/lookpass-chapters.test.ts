import { describe, expect, it } from 'vitest'
import { extractChapters } from '@/lib/cma/lookpass-chapters'

describe('extractChapters', () => {
  it('reads the letter cover, a content page, and a flyer page in order', () => {
    const html = `
<section class="page page-cover">
  <div class="cover-stage"><h1 class="cover-title">123 Test Way</h1></div>
</section>
<section class="page">
  <header class="pg-header"><div class="pg-meta">123 Test Way · Property facts</div></header>
  <h2 class="section">Property facts</h2>
  <table><tr><td>1</td></tr></table>
</section>
<section class="page page-flyer">
  <h2 class="section">The sales that set the number</h2>
  <img src="./assets/map.png"/>
  <svg viewBox="0 0 10 10"></svg>
</section>`
    const chapters = extractChapters(html)
    expect(chapters).toHaveLength(3)

    expect(chapters[0].id).toBe('cover')
    expect(chapters[0].heading).toBe('123 Test Way')
    expect(chapters[0].svgCount).toBe(0)

    expect(chapters[1].id).toBe('property-facts')
    expect(chapters[1].heading).toBe('Property facts')
    expect(chapters[1].tableCount).toBe(1)
    expect(chapters[1].imgCount).toBe(0)

    expect(chapters[2].id).toBe('the-sales-that-set-the-number')
    expect(chapters[2].heading).toBe('The sales that set the number')
    expect(chapters[2].imgCount).toBe(1)
    expect(chapters[2].svgCount).toBe(1)
  })

  it('prefers a DOM id over a derived slug (immersive scenes)', () => {
    const html = `
<section class="sc hero on" id="top">
  <h1 class="hero-h">123 Test Way</h1>
</section>
<section class="sc sc-cream" id="how-we-got-the-price">
  <h2 class="h r">Our Recommended List Price for your home.</h2>
</section>`
    const chapters = extractChapters(html)
    expect(chapters.map((c) => c.id)).toEqual(['top', 'how-we-got-the-price'])
    expect(chapters[1].heading).toBe('Our Recommended List Price for your home.')
  })

  it('does not split on a section nested inside another section', () => {
    const html = `
<section class="page">
  <h2 class="section">Why list with a realtor</h2>
  <section class="cma-why-list"><p>nested content, e.g. a legacy embedded template</p></section>
</section>`
    const chapters = extractChapters(html)
    expect(chapters).toHaveLength(1)
    expect(chapters[0].heading).toBe('Why list with a realtor')
  })

  it('falls back to a positional id when there is no id, class hook, or heading', () => {
    const html = `<section class="page"><p>no heading here</p></section>`
    const chapters = extractChapters(html)
    expect(chapters).toHaveLength(1)
    expect(chapters[0].id).toBe('chapter-1')
    expect(chapters[0].heading).toBe('')
  })

  it('returns an empty list for a document with no top-level sections', () => {
    expect(extractChapters('<html><body><p>hi</p></body></html>')).toEqual([])
  })
})
