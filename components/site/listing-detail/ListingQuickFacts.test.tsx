import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ListingQuickFacts } from './ListingQuickFacts'

describe('ListingQuickFacts', () => {
  it('renders the sentence without repeating the Facts table, and hides missing fields', () => {
    const html = renderToStaticMarkup(
      createElement(ListingQuickFacts, {
        street: '1 Main St',
        city: 'Bend',
        price: 500_000,
        beds: 3,
        baths: 2,
        sqft: 1500,
        yearBuilt: 2000,
        status: 'Active',
        hoaMonthly: null,
        now: new Date('2026-10-13T17:00:00.000Z'),
      }),
    )
    expect(html).toContain('At a glance')
    expect(html).toContain('<p class="listing-quick-facts__answer">')
    expect(html).toContain('listed at $500,000')
    expect(html).not.toContain('<dl')
    expect(html).not.toContain('<dt>HOA</dt>')
    expect(html).not.toContain('null')
  })

  it('renders nothing when every field is missing', () => {
    expect(renderToStaticMarkup(createElement(ListingQuickFacts, {}))).toBe('')
  })
})
