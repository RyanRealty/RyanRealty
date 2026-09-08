import { describe, it, expect } from 'vitest'
import {
  affordabilityAnswerLine,
  affordabilityClaim,
  affordabilityFigures,
  affordabilitySearchLabel,
  type AffordabilityViewInput,
} from './V3PlaceAffordability.view'
import { solveFromPrice } from '@/lib/finance/affordability'

const terms = { interestRatePercent: 6.71, downPaymentPct: 20, loanTermYears: 30 }
const solved = solveFromPrice(800_000, terms)!

const base: AffordabilityViewInput = {
  placeName: 'Bend',
  mode: 'financed',
  solved,
  // market_metric city/bend median_list_active detached, read 2026-09-08.
  medianListPrice: 947_000,
  medianMonthly: 4_896.12,
  medianSource: 'Median asking price: market_metric, Bend detached, 664 homes for sale, read September 8, 2026.',
  termsSource: '20% down, 6.71%, 30 years.',
  mix: [
    { key: 'conventional', name: 'Conventional', share: 0.6324, label: '63.2%' },
    { key: 'cash', name: 'Cash', share: 0.2779, label: '27.8%' },
  ],
  mixSource: 'market_metric financing_mix, Bend detached, 2,073 closed sales in the last 12 months.',
}

describe('affordabilityClaim · a sentence first, figures second', () => {
  it('states the median and NOT its payment — the payment belongs to the answer', () => {
    expect(
      affordabilityClaim({ placeName: 'Bend', medianListPrice: 947_000, medianMonthly: 4_896.12, mode: 'financed' }),
    ).toContain('$947,000')
  })

  it('never prints a payment, in either mode — one payment figure per screen', () => {
    for (const mode of ['financed', 'cash'] as const) {
      const line = affordabilityClaim({ placeName: 'Bend', medianListPrice: 947_000, medianMonthly: 4_896, mode })
      expect(line).toContain('$947,000')
      expect(line).not.toContain('a month')
      expect(line).not.toContain('$4,896')
    }
  })

  it('states no figure at all when the place publishes no median', () => {
    const line = affordabilityClaim({ placeName: 'Sisters', medianListPrice: null, medianMonthly: null, mode: 'financed' })
    expect(line).not.toMatch(/\$/)
    expect(line).toContain('Sisters')
  })
})

describe('affordabilityAnswerLine · the live headline', () => {
  it('reads payment-to-ceiling when financed', () => {
    expect(affordabilityAnswerLine({ placeName: 'Bend', mode: 'financed', solved })).toBe(
      '$4,134 a month reaches $800,000 in Bend.',
    )
  })

  it('reads cash-to-ceiling with no monthly figure when cash', () => {
    const line = affordabilityAnswerLine({ placeName: 'Bend', mode: 'cash', solved })
    expect(line).toContain('$800,000')
    expect(line).not.toContain('a month')
  })
})

describe('affordabilitySearchLabel · the promise on the button', () => {
  it('names the exact ceiling the link carries', () => {
    expect(affordabilitySearchLabel('Bend', 800_000)).toBe('See homes under $800,000 in Bend')
  })
})

describe('affordabilityFigures · every drawn number carries its own trace', () => {
  it('draws three comparisons when the place publishes everything', () => {
    const figures = affordabilityFigures(base)
    // The split LEADS: the calculator opens at the median, so the market
    // comparison's two bars are identical on first paint and cannot be the
    // first thing a reader sees.
    expect(figures.map((f) => f.key)).toEqual(['bring-and-borrow', 'against-the-middle', 'how-people-paid'])
    for (const figure of figures) {
      expect(figure.draw).toBe('pair')
      expect(figure.source.trim().length).toBeGreaterThan(20)
      expect(figure.claim.trim().length).toBeGreaterThan(10)
      expect(figure.caption.trim().length).toBeGreaterThan(0)
      expect((figure.bars ?? []).length).toBeGreaterThanOrEqual(2)
    }
  })

  it('foots: what you bring plus what you borrow is the ceiling exactly', () => {
    const bars = affordabilityFigures(base).find((f) => f.key === 'bring-and-borrow')!.bars!
    expect(bars[0]!.value + bars[1]!.value).toBe(solved.ceiling)
  })

  it('withholds the market comparison when the place publishes no median', () => {
    const figures = affordabilityFigures({ ...base, medianListPrice: null, medianMonthly: null })
    expect(figures.map((f) => f.key)).not.toContain('against-the-middle')
    expect(figures.map((f) => f.key)).toContain('bring-and-borrow')
  })

  it('withholds the mix rather than drawing one slice against nothing', () => {
    const figures = affordabilityFigures({ ...base, mix: [base.mix[0]!] })
    expect(figures.map((f) => f.key)).not.toContain('how-people-paid')
  })

  it('drops the loan drawing in cash mode, where there is no loan', () => {
    const figures = affordabilityFigures({ ...base, mode: 'cash' })
    expect(figures.map((f) => f.key)).toEqual(['how-people-paid'])
  })

  it('never turns a cash SHARE into this visitor`s down payment', () => {
    const figures = affordabilityFigures(base)
    const mixFigure = figures.find((f) => f.key === 'how-people-paid')!
    const words = `${mixFigure.claim} ${mixFigure.bars!.map((b) => `${b.name} ${b.note}`).join(' ')}`.toLowerCase()
    expect(words).not.toContain('down')
    expect(words).toContain('closed single-family sales')
  })

  it('reconciles the verdict to the two bars it sits under', () => {
    const above = affordabilityFigures({ ...base, medianMonthly: 3_000 })
    expect(above.find((f) => f.key === 'against-the-middle')!.verdict).toContain('reaches the middle')
    const below = affordabilityFigures({ ...base, medianMonthly: 9_000 })
    expect(below.find((f) => f.key === 'against-the-middle')!.verdict).toContain('above your number')
  })
})
