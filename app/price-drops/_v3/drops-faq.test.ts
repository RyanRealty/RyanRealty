import { describe, expect, it } from 'vitest'
import { priceDropFaqAnswers, priceDropFaqSchema } from './drops-faq'

const context = {
  monthsOfSupply: 3.5,
  priceCutShare: 0.454,
  medianPriceCut: 0.056,
  saleToOriginal: 0.971,
  daysToPending: 33,
  asOf: '2026-10-13T17:00:00.000Z',
}

describe('price-drop FAQ schema', () => {
  it('emits FAQPage items that match the visible answers', () => {
    const answers = priceDropFaqAnswers({
      citySlug: 'bend',
      cityName: 'Bend',
      weekCount: 12,
      context,
      reoCount: null,
      reoEnabled: false,
    })
    const schema = priceDropFaqSchema(answers, '2026-10-13T17:00:00.000Z')
    expect(schema).toMatchObject({
      type: 'faqPage',
      dateModified: '2026-10-13T17:00:00.000Z',
    })
    const items = (schema as { items: Array<{ question: string; answer: string }> }).items
    expect(items).toHaveLength(answers.length)
    expect(items[0]?.question).toBe(answers[0]?.question)
    expect(items[0]?.answer).toBe(answers[0]?.body)
    expect(JSON.stringify(schema)).not.toMatch(/buyer's market|below market value|\u2014/)
  })
})
