import { describe, expect, it } from 'vitest'
import { datasetFaqConflicts, reconcileDatasetToFaq } from './dataset-faq-contract'

const AWBREY_FAQ = [
  {
    question: 'What is the median home price in Awbrey Butte?',
    answer:
      'The median sale price for a single-family home in Awbrey Butte was $1,400,000 over the past 12 months. The homes on the market right now are asking a median of $1,312,500, which is a different set of homes from the ones that sold.',
  },
  {
    question: 'How many single-family homes are for sale in Awbrey Butte?',
    answer: '54 single-family homes are on the market in Awbrey Butte right now.',
  },
  {
    question: 'How long do homes take to sell in Awbrey Butte?',
    answer: 'Half the Awbrey Butte homes that went under contract in the last 90 days did it inside 29 days.',
  },
  {
    question: 'How many homes sold in Awbrey Butte in the last year?',
    answer: '120 single-family homes closed in Awbrey Butte over the past 12 months.',
  },
]

describe('datasetFaqConflicts (AEO-1)', () => {
  it('names the live Awbrey Butte defect: overlay figures in the Dataset, boundary figures in the FAQ', () => {
    const conflicts = datasetFaqConflicts(
      [
        { name: 'Median List Price', value: 1_350_000, unitText: 'USD' },
        { name: 'Active Listings', value: 45 },
        { name: 'Median Days to Pending', value: 29, unitText: 'days' },
        { name: 'Homes Sold (12 months)', value: 120 },
      ],
      AWBREY_FAQ,
    )
    expect(conflicts.map((c) => c.variable)).toEqual(['Median List Price', 'Active Listings'])
    expect(conflicts[0]).toMatchObject({ expected: '$1,350,000', datasetValue: 1_350_000 })
  })

  it('passes when every shared label carries the number the FAQ prints', () => {
    expect(
      datasetFaqConflicts(
        [
          { name: 'Median List Price', value: 1_312_500, unitText: 'USD' },
          { name: 'Active Listings', value: 54 },
          { name: 'Median Days to Pending', value: 29, unitText: 'days' },
          { name: 'Homes Sold (12 months)', value: 120 },
        ],
        AWBREY_FAQ,
      ),
    ).toEqual([])
  })

  it('formats thousands the way the FAQ does', () => {
    expect(
      datasetFaqConflicts(
        [{ name: 'Active Listings', value: 1_203 }],
        [{ question: 'How many single-family homes are for sale in Bend?', answer: 'There are 1,203 active single-family listings in Bend.' }],
      ),
    ).toEqual([])
  })

  it('reads a months-of-supply value printed with one decimal', () => {
    const faq = [{ question: "Is Bend a buyer's or seller's market?", answer: 'Bend has 4.0 months of supply, which is a balanced market.' }]
    expect(datasetFaqConflicts([{ name: 'Months of Supply', value: 4 }], faq)).toEqual([])
    expect(datasetFaqConflicts([{ name: 'Months of Supply', value: 4.4 }], faq)).toHaveLength(1)
  })

  it('leaves a variable alone when the FAQ asks no question about it', () => {
    expect(datasetFaqConflicts([{ name: 'Active Listings', value: 45 }], [])).toEqual([])
    expect(datasetFaqConflicts([{ name: 'Average Google rating', value: 5 }], AWBREY_FAQ)).toEqual([])
  })
})

describe('reconcileDatasetToFaq (AEO-1)', () => {
  it('withholds the contradicted variables and keeps the rest in order', () => {
    const kept = reconcileDatasetToFaq(
      [
        { name: 'Median List Price', value: 1_350_000, unitText: 'USD' },
        { name: 'Active Listings', value: 45 },
        { name: 'Median Days to Pending', value: 29, unitText: 'days' },
        { name: 'Homes Sold (12 months)', value: 120 },
      ],
      AWBREY_FAQ,
    )
    expect(kept.map((v) => v.name)).toEqual(['Median Days to Pending', 'Homes Sold (12 months)'])
  })
})
