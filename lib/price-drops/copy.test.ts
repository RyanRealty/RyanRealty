import { describe, expect, it } from 'vitest'
import {
  assertPriceDropCopy,
  priceDropAnswerSentences,
  priceDropFaqItems,
  priceDropLeverageLine,
  priceDropsCityDescription,
  priceDropsCityH1,
  priceDropsCityTitle,
} from './copy'

const context = {
  monthsOfSupply: 3.5,
  priceCutShare: 0.454,
  medianPriceCut: 0.056,
  saleToOriginal: 0.971,
  daysToPending: 33,
  asOf: '2026-10-13T17:00:00.000Z',
}

describe('price-drops city copy', () => {
  it('keeps title and H1 on price drops wording', () => {
    expect(priceDropsCityTitle('Bend')).toBe('Price Drops in Bend, Oregon')
    expect(priceDropsCityH1('Bend')).toBe('Price drops in Bend')
    expect(priceDropsCityH1('Bend')).not.toMatch(/best deals|motivated/i)
    expect(priceDropsCityTitle('La Pine')).not.toMatch(/foreclosure/i)
  })

  it('allows best deals only in the answer body', () => {
    const sentences = priceDropAnswerSentences({
      citySlug: 'bend',
      cityName: 'Bend',
      weekCount: 12,
      medianDropPct: 3.3,
      totalReducedLabel: '$1.2M',
      weekAsOf: '2026-10-13T17:00:00.000Z',
      context,
    })
    expect(sentences[0]).toContain('12 Bend homes cut')
    expect(sentences.join(' ')).toMatch(/best deals/)
    expect(sentences.join(' ')).toContain('3.5 months of supply')
    expect(sentences.join(' ')).toContain('Buyers have leverage in Bend on price.')
    for (const sentence of sentences) assertPriceDropCopy(sentence)
  })

  it('does not claim leverage in Redmond and omits supply for La Pine', () => {
    expect(
      priceDropLeverageLine({ citySlug: 'redmond', cityName: 'Redmond', monthsOfSupply: 4 }),
    ).toBe('Some sellers in Redmond are cutting their asking price.')
    const laPine = priceDropAnswerSentences({
      citySlug: 'la-pine',
      cityName: 'La Pine',
      weekCount: 4,
      medianDropPct: 2.1,
      totalReducedLabel: null,
      weekAsOf: null,
      context: { ...context, monthsOfSupply: 8.2 },
    }).join(' ')
    expect(laPine).not.toMatch(/months of supply/)
    expect(laPine).not.toMatch(/leverage/)
    assertPriceDropCopy(laPine)
  })

  it('keeps FAQ off banned wording and hides REO until the flag is on', () => {
    const off = priceDropFaqItems({
      citySlug: 'bend',
      cityName: 'Bend',
      weekCount: 12,
      context,
      reoCount: 0,
      reoEnabled: false,
    })
    expect(off.some((item) => /foreclosure/i.test(item.question))).toBe(false)
    const on = priceDropFaqItems({
      citySlug: 'bend',
      cityName: 'Bend',
      weekCount: 12,
      context,
      reoCount: 0,
      reoEnabled: true,
    })
    expect(on.some((item) => /none/i.test(item.answer) && /bank-owned/i.test(item.answer))).toBe(true)
    const text = [...off, ...on].map((item) => `${item.question} ${item.answer}`).join('\n')
    expect(text).not.toMatch(/buyer's market|below market value|\bsteal\b|\bbargain\b/)
    expect(text).not.toMatch(/[\u2013\u2014]/)
    for (const item of [...off, ...on]) assertPriceDropCopy(`${item.question} ${item.answer}`)
  })

  it('keeps the meta description inside 155 characters at a 3-digit count', () => {
    expect(priceDropsCityDescription({ cityName: 'Bend', cutCount: 186 }).length).toBeLessThanOrEqual(155)
  })
})
