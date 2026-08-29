import { describe, expect, it } from 'vitest'
import { v3Text } from '@/components/site/v3'
import {
  communityFaceAbsenceItems,
  communityFaceFaqs,
  communityFaceFieldCaption,
  communityFaceFieldTrace,
  communityFaceMarketFigures,
  communityFaceMarketTrace,
} from './community-face'

describe('community face', () => {
  it('keeps the few figures and drops the tile stack', () => {
    const figures = communityFaceMarketFigures([
      { value: v3Text('$835,000'), label: v3Text('median list price') },
      { value: v3Text('49'), label: v3Text('detached homes for sale') },
      { value: v3Text('6.3'), label: v3Text('months of supply') },
      { value: v3Text('8'), label: v3Text('pending · now') },
      { value: v3Text('43.2%'), label: v3Text('cash closes · detached · 12 months') },
    ])
    expect(figures.map((figure) => String(figure.label))).toEqual([
      'median list price',
      'detached homes for sale',
      'months of supply',
    ])
  })

  it('drops the buyer/seller FAQ', () => {
    const faqs = communityFaceFaqs([
      { question: 'What is the median home price in Eagle Crest?', answer: '$835,000' },
      { question: "Is Eagle Crest a buyer's or seller's market?", answer: "buyer's market" },
    ])
    expect(faqs).toHaveLength(1)
    expect(faqs[0]?.question).toContain('median home price')
  })

  it('writes a caption with the one supply sentence parts', () => {
    expect(
      communityFaceFieldCaption({
        placeName: 'Eagle Crest',
        count: 99,
        mosLabel: '6.3',
        verdictKind: 'buyers',
        verdictLabel: "buyer's market",
      }),
    ).toBe("99 homes for sale in Eagle Crest · 6.3 months of supply · a buyer's market")
  })

  it('keeps leftover wording off traces', () => {
    const trace = communityFaceMarketTrace('Eagle Crest', true)
    expect(trace).not.toMatch(/leftover/i)
    expect(trace).not.toMatch(/Market Truth leftover/i)
    expect(trace).not.toMatch(/metric layer/i)
    const field = communityFaceFieldTrace('Eagle Crest', 'alias')
    expect(field).not.toMatch(/leftover/i)
    const absence = communityFaceAbsenceItems('Eagle Crest', true)
    expect(JSON.stringify(absence)).not.toMatch(/leftover/i)
    expect(JSON.stringify(absence)).not.toMatch(/metric layer/i)
  })
})
