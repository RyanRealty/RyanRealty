import { describe, it, expect } from 'vitest'
import { buildJsonLd } from './json-ld'

const rec = (v: unknown) => v as Record<string, unknown> | undefined

// buildJsonLd is the JSON-LD source for listings, breadcrumbs, FAQ, datasets, and
// places (rich results + AI citation). The offer rule is data-accuracy/honesty:
// an off-market home must NOT advertise a live purchasable price. Audit p3.2.
describe('buildJsonLd', () => {
  describe('realEstateListing offers (a sold/pending home is not for sale)', () => {
    const base = { type: 'realEstateListing', name: '123 Main St', listPrice: 750000 } as const

    it('Active -> InStock offer at the list price', () => {
      const offer = rec(buildJsonLd({ ...base, availability: 'Active' }).offers)
      expect(offer).toMatchObject({
        '@type': 'Offer',
        price: 750000,
        priceCurrency: 'USD',
        availability: 'https://schema.org/InStock',
      })
    })
    it('no availability defaults to InStock (backwards-compatible)', () => {
      expect(rec(buildJsonLd(base).offers)?.availability).toBe('https://schema.org/InStock')
    })
    it('Coming Soon / Active Under Contract -> PreOrder', () => {
      expect(rec(buildJsonLd({ ...base, availability: 'Coming Soon' }).offers)?.availability).toBe(
        'https://schema.org/PreOrder',
      )
      expect(
        rec(buildJsonLd({ ...base, availability: 'Active Under Contract' }).offers)?.availability,
      ).toBe('https://schema.org/PreOrder')
    })
    it('off-market statuses emit NO offer', () => {
      for (const s of ['Closed', 'Pending', 'Withdrawn', 'Expired', 'Canceled']) {
        expect(buildJsonLd({ ...base, availability: s }).offers).toBeUndefined()
      }
    })
    it('no list price -> no offer', () => {
      expect(buildJsonLd({ type: 'realEstateListing', name: 'X' }).offers).toBeUndefined()
    })
  })

  it('breadcrumb numbers positions from 1 and absolutizes item URLs', () => {
    const r = buildJsonLd({
      type: 'breadcrumb',
      items: [
        { name: 'Home', url: '/' },
        { name: 'Bend', url: '/bend' },
      ],
    })
    expect(r['@type']).toBe('BreadcrumbList')
    const items = r.itemListElement as Array<Record<string, unknown>>
    expect(items[0]).toMatchObject({ position: 1, name: 'Home' })
    expect(items[1]).toMatchObject({ position: 2, name: 'Bend' })
    expect(items[1].item).toMatch(/^https?:\/\/.+\/bend$/)
  })

  it('faqPage maps to Question / acceptedAnswer', () => {
    const r = buildJsonLd({ type: 'faqPage', items: [{ question: 'Q1?', answer: 'A1.' }] })
    expect(r['@type']).toBe('FAQPage')
    expect((r.mainEntity as Array<Record<string, unknown>>)[0]).toMatchObject({
      '@type': 'Question',
      name: 'Q1?',
      acceptedAnswer: { '@type': 'Answer', text: 'A1.' },
    })
  })

  it('dataset variableMeasured maps StatValue -> PropertyValue and prunes empty unitText', () => {
    const r = buildJsonLd({
      type: 'dataset',
      name: 'Bend market',
      description: 'Live single-family market statistics',
      variableMeasured: [
        { name: 'Active Listings', value: 88 },
        { name: 'Median List Price', value: 650000, unitText: 'USD' },
      ],
    })
    const vars = r.variableMeasured as Array<Record<string, unknown>>
    expect(vars[0]).toMatchObject({ '@type': 'PropertyValue', name: 'Active Listings', value: 88 })
    expect(vars[0].unitText).toBeUndefined()
    expect(vars[1]).toMatchObject({ name: 'Median List Price', value: 650000, unitText: 'USD' })
  })

  it('prune drops null/undefined fields (webPage without description)', () => {
    const r = buildJsonLd({ type: 'webPage', name: 'About' })
    expect(r.name).toBe('About')
    expect('description' in r).toBe(false)
  })

  it('already-absolute URLs pass through unchanged', () => {
    const r = buildJsonLd({ type: 'article', headline: 'H', url: 'https://example.com/x' })
    expect(r.url).toBe('https://example.com/x')
  })
})
