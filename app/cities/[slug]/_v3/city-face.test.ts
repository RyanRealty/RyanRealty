import { describe, expect, it } from 'vitest'
import {
  cityFaceFaqs,
  cityFaceFieldCaption,
  cityFaceMarketFigures,
} from './city-face'

describe('cityFaceMarketFigures', () => {
  it('keeps the few face figures and drops the rest of the HUD run', () => {
    const figures = cityFaceMarketFigures([
      { value: '$500,000', label: 'median list price' },
      { value: '120', label: 'detached homes for sale' },
      { value: '4.6', label: 'months of supply' },
      { value: '18', label: 'pending · now' },
      { value: '97.6%', label: 'sale to original list · 12 months' },
      { value: '22', label: 'sold · 12 months' },
    ])
    expect(figures.map((figure) => String(figure.label))).toEqual([
      'median list price',
      'detached homes for sale',
      'months of supply',
      'sale to original list · 12 months',
    ])
  })
})

describe('cityFaceFaqs', () => {
  it('drops the buyer/seller market question from the visible FAQ', () => {
    const faqs = cityFaceFaqs([
      { question: "Is Redmond a buyer's or seller's market?", answer: 'No.' },
      { question: 'What is the median list price in Redmond?', answer: '$500,000' },
    ])
    expect(faqs).toEqual([
      { question: 'What is the median list price in Redmond?', answer: '$500,000' },
    ])
  })
})

describe('cityFaceFieldCaption', () => {
  it('names newest listings, not a single-family-only set', () => {
    expect(
      cityFaceFieldCaption({
        cityName: 'Redmond',
        count: 40,
        mosLabel: '4.6',
        verdictKind: 'balanced',
        verdictLabel: 'balanced market',
      }),
    ).toBe('The 40 newest listings in Redmond · 4.6 months of supply · a balanced market')
  })
})
