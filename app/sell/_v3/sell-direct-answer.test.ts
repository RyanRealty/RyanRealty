import { describe, expect, it } from 'vitest'
import { sellFeeLine, sellMarketLine } from './sell-direct-answer'

const full = {
  city: 'Bend',
  medianClose: 765000,
  daysToContract: 28,
  saleToOriginal: 0.97,
  monthsOfSupply: 3.5,
  verdictKind: 'sellers' as const,
  verdictLabel: "seller's market",
}

describe('/sell direct answer', () => {
  it('reads as two plain sentences with the live figures', () => {
    expect(sellMarketLine(full)).toBe(
      "Bend homes sold for a median $765,000 over the last 12 months, went under contract in a median 28 days, and closed at a median 97.0% of their first asking price, and with 3.5 months of supply Bend is still a seller's market.",
    )
    expect(sellFeeLine(full)).toBe(
      "We list your home for 3% of the sale price with no add-on fees, which is $22,950 on a $765,000 home, and anything paid to the buyer's agent is a separate number you negotiate offer by offer.",
    )
  })

  it('drops a clause whose figure is null instead of printing it', () => {
    const line = sellMarketLine({ ...full, daysToContract: null, monthsOfSupply: null })
    expect(line).toBe(
      'Bend homes sold for a median $765,000 over the last 12 months, and closed at a median 97.0% of their first asking price.',
    )
    expect(line).not.toMatch(/null|undefined|\b0 days/)
    expect(sellFeeLine({ medianClose: null })).not.toMatch(/\$|null/)
  })

  it('prints nothing for the market when no figure publishes', () => {
    expect(
      sellMarketLine({ ...full, medianClose: null, daysToContract: null, saleToOriginal: null, monthsOfSupply: null }),
    ).toBeNull()
  })

  it('carries no em dash', () => {
    expect(`${sellMarketLine(full)} ${sellFeeLine(full)}`).not.toContain('\u2014')
  })
})
