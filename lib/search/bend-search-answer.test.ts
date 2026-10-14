import { describe, expect, it } from 'vitest'
import { publishBendSearchAnswer } from './bend-search-answer'

describe('publishBendSearchAnswer', () => {
  it('words live leftover counts into the city-page takeaway sentences', () => {
    const answer = publishBendSearchAnswer({
      faq: {
        grain: 'city',
        source: 'market-truth',
        activeCount: 713,
        medianListPrice: 874000,
        monthsOfSupply: 3.5,
        yoyMedianPrice: -0.032,
        refreshedAt: '2026-10-13T17:00:00.000Z',
      },
      pace: { yoyMedian: -0.032, medianClose: 750000 },
    })
    expect(answer).not.toBeNull()
    expect(answer!.items[0]).toContain('713')
    expect(answer!.items[0]).toContain('Bend')
    expect(answer!.items[0]).toContain('$874,000')
    expect(answer!.items.some((s) => s.includes('3.5 months of supply'))).toBe(true)
    expect(answer!.items.some((s) => s.includes('down 3.2%'))).toBe(true)
    expect(answer!.source).toMatch(/as of Oct 13, 2026/)
  })

  it('omits the block when leftover figures cannot make two sentences', () => {
    expect(
      publishBendSearchAnswer({
        faq: { grain: 'city', source: 'market-truth' },
        pace: { yoyMedian: null, medianClose: null },
      }),
    ).toBeNull()
    expect(publishBendSearchAnswer({ faq: null, pace: null })).toBeNull()
  })
})
