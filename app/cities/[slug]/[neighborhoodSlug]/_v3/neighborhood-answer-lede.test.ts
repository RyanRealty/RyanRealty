import { describe, expect, it } from 'vitest'
import {
  answerLedeEnabled,
  neighborhoodAnswerLede,
  neighborhoodAnswerMeta,
  type NeighborhoodAnswerFigures,
} from './neighborhood-answer-lede'

// Awbrey Butte as read from public.market_metric on 2026-10-09 06:50 PT
// (period_end 2026-10-08) and the brief's live page read (46 homes, $1,312,500 ask).
const AWBREY: NeighborhoodAnswerFigures = {
  placeName: 'Awbrey Butte',
  cityName: 'Bend',
  medianClose: 1_172_000,
  closedCount: 131,
  cityMedianClose: 765_000,
  activeCount: 46,
  medianListPrice: 1_312_500,
  saleToOriginal: 0.94311377245509,
  asOf: 'Oct 8, 2026',
}

describe('neighborhood answer lede (brief 2B)', () => {
  it('ships on Awbrey Butte only', () => {
    expect(answerLedeEnabled('bend', 'awbrey-butte')).toBe(true)
    expect(answerLedeEnabled('bend', 'old-bend')).toBe(false)
    expect(answerLedeEnabled('redmond', 'awbrey-butte')).toBe(false)
  })

  it('prints the brief copy from the bound figures', () => {
    expect(neighborhoodAnswerLede(AWBREY)).toBe(
      "The median sale price for a single-family home in Awbrey Butte was $1,172,000 over the last 12 months, on 131 sales, as of Oct 8, 2026, about 53% above Bend's citywide median of $765,000. The 46 homes for sale there now ask a median of $1,312,500, and the typical home that sold closed at 94.3% of its original list price. Figures are from Oregon Data Share MLS, detached single-family homes inside the recorded Awbrey Butte boundary.",
    )
  })

  it('prints the brief meta, inside 155 characters', () => {
    const meta = neighborhoodAnswerMeta(AWBREY)
    expect(meta).toBe(
      'Awbrey Butte median sale price: $1,172,000 over the last 12 months (131 sales, Oct 8, 2026). 46 homes for sale now. Live data from the regional MLS.',
    )
    expect(meta!.length).toBeLessThanOrEqual(155)
  })

  it('follows the data: a new median changes the lede and the comparison', () => {
    const lede = neighborhoodAnswerLede({ ...AWBREY, medianClose: 700_000, closedCount: 140, asOf: 'Nov 1, 2026' })
    expect(lede).toContain('was $700,000 over the last 12 months, on 140 sales, as of Nov 1, 2026, about 8% below')
    expect(neighborhoodAnswerMeta({ ...AWBREY, medianClose: 1_200_000 })).toContain('$1,200,000')
  })

  it('drops a clause it has no figure for, and the whole lede without the median', () => {
    const noAsk = neighborhoodAnswerLede({ ...AWBREY, activeCount: null })
    expect(noAsk).toContain('The typical home that sold closed at 94.3%')
    expect(noAsk).not.toContain('homes for sale there now')
    const noCity = neighborhoodAnswerLede({ ...AWBREY, cityMedianClose: null })
    expect(noCity).toContain('as of Oct 8, 2026. ')
    expect(noCity).not.toContain('citywide')
    expect(neighborhoodAnswerLede({ ...AWBREY, medianClose: null })).toBeNull()
    expect(neighborhoodAnswerMeta({ ...AWBREY, asOf: null })).toBeNull()
  })

  it('has no em dash', () => {
    expect(neighborhoodAnswerLede(AWBREY)).not.toContain('\u2014')
    expect(neighborhoodAnswerMeta(AWBREY)).not.toContain('\u2014')
  })
})
