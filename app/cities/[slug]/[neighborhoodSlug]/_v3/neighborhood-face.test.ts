import { describe, expect, it } from 'vitest'
import { v3Text } from '@/components/site/v3'
import {
  neighborhoodFaceAbsenceItems,
  neighborhoodFaceFaqs,
  neighborhoodFaceFieldCaption,
  neighborhoodFaceMarketFigures,
  neighborhoodFaceMarketTrace,
} from './neighborhood-face'

describe('neighborhood face', () => {
  it('keeps the few figures and drops the tile stack', () => {
    const figures = neighborhoodFaceMarketFigures([
      { value: v3Text('$1,299,999'), label: v3Text('median list price') },
      { value: v3Text('55'), label: v3Text('detached homes for sale') },
      { value: v3Text('5.6'), label: v3Text('months of supply') },
      { value: v3Text('22'), label: v3Text('pending · now') },
      { value: v3Text('39.0%'), label: v3Text('cash closes · detached · 12 months') },
    ])
    expect(figures.map((figure) => String(figure.label))).toEqual([
      'median list price',
      'detached homes for sale',
      'months of supply',
    ])
  })

  it('drops the buyer/seller FAQ', () => {
    const faqs = neighborhoodFaceFaqs([
      { question: 'What is the median home price in Awbrey Butte?', answer: '$1,299,999' },
      { question: "Is Awbrey Butte a buyer's or seller's market?", answer: 'balanced' },
    ])
    expect(faqs).toHaveLength(1)
    expect(faqs[0]?.question).toContain('median home price')
  })

  it('writes a caption with the one supply sentence parts', () => {
    expect(
      neighborhoodFaceFieldCaption({
        placeName: 'Awbrey Butte',
        count: 24,
        totalQualifying: 55,
        mosLabel: '5.6',
        verdictKind: 'balanced',
        verdictLabel: 'balanced market',
      }),
    ).toBe('The 24 highest-priced listings in Awbrey Butte · 5.6 months of supply · a balanced market')
  })

  it('keeps leftover wording off traces', () => {
    const trace = neighborhoodFaceMarketTrace('Awbrey Butte', true)
    expect(trace).not.toMatch(/leftover/i)
    expect(trace).not.toMatch(/Market Truth leftover/i)
    const absence = neighborhoodFaceAbsenceItems('Awbrey Butte', true)
    expect(JSON.stringify(absence)).not.toMatch(/leftover/i)
  })
})
