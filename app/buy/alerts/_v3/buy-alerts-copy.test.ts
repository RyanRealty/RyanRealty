import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  BUY_ALERTS_COPY,
  BUY_ALERTS_FORM_ID,
  BUY_ALERTS_LEAD_TYPE,
  BUY_ALERTS_LP_VARIANT,
} from './buy-alerts-constants'
import { buyAlertsCopy } from './buy-alerts-copy'
import { EMPTY_BUY_ALERTS_FACTS, type BuyAlertsFacts } from './buy-alerts-facts'

const CLIENT = join(process.cwd(), 'app/buy/alerts/_v3/BuyAlertsSignup.client.tsx')

function facts(partial: Partial<BuyAlertsFacts> = {}): BuyAlertsFacts {
  return { ...EMPTY_BUY_ALERTS_FACTS, ...partial }
}

function allCopy(copy = buyAlertsCopy(EMPTY_BUY_ALERTS_FACTS)): string {
  return [
    copy.title,
    copy.meta,
    copy.h1,
    copy.eyebrow,
    copy.whatYouGet,
    copy.source,
    copy.leverage,
    copy.leverageMos,
    copy.volume,
    copy.dropsCount,
    copy.dropsMedian,
    copy.formCadence,
    ...copy.faqs.flatMap((f) => [f.question, f.answer]),
    ...Object.values(BUY_ALERTS_COPY),
  ]
    .filter(Boolean)
    .join('\n')
}

describe('buyAlertsCopy', () => {
  it('omits volume when the 30-day count is missing', () => {
    const copy = buyAlertsCopy(facts({ leftoverStamp: 'Oct 13, 2026' }))
    expect(copy.volume).toBeNull()
  })

  it('omits volume when the leftover stamp is missing', () => {
    const copy = buyAlertsCopy(facts({ newCount30d: 120 }))
    expect(copy.volume).toBeNull()
  })

  it('prints volume when count and stamp are both present', () => {
    const copy = buyAlertsCopy(facts({ newCount30d: 120, leftoverStamp: 'Oct 13, 2026' }))
    expect(copy.volume).toBe(
      '120 detached houses came on the market in Bend in the last 30 days, as of Oct 13, 2026.',
    )
  })

  it('prints the under-4 months sentence only when MOS publishes under 4 after formatting', () => {
    const under = buyAlertsCopy(
      facts({ monthsSupply: 3.3, monthsUnder4: true, leftoverStamp: 'Oct 13, 2026' }),
    )
    expect(under.leverageMos).toContain('3.3 months of supply')
    expect(under.leverageMos).toContain('under the 4-month line')

    const withheld = buyAlertsCopy(facts({ leftoverStamp: 'Oct 13, 2026' }))
    expect(withheld.leverageMos).toBeNull()

    const balanced = buyAlertsCopy(
      facts({ monthsSupply: 4.2, monthsUnder4: false, leftoverStamp: 'Oct 13, 2026' }),
    )
    expect(balanced.leverageMos).toBeNull()
  })

  it('never says buyer\'s market, instant, same day, or before Zillow', () => {
    const blob = allCopy(
      buyAlertsCopy(
        facts({
          leftoverStamp: 'Oct 13, 2026',
          dropsStamp: 'Oct 13, 2026',
          newCount30d: 80,
          monthsSupply: 3.3,
          monthsUnder4: true,
          dropsCount: 40,
          dropsMedianPct: 3.3,
        }),
      ),
    )
    expect(blob).not.toMatch(/buyer['’]s market/i)
    expect(blob.toLowerCase()).not.toContain('instant')
    expect(blob.toLowerCase()).not.toContain('same day')
    expect(blob.toLowerCase()).not.toContain('the day they happen')
    expect(blob.toLowerCase()).not.toContain('before zillow')
    expect(blob).not.toContain('—')
  })

  it('uses the fallback H1 without a same-day claim', () => {
    expect(BUY_ALERTS_COPY.h1).toBe('Get new Central Oregon listings and price cuts by email')
    expect(buyAlertsCopy(EMPTY_BUY_ALERTS_FACTS).h1).toBe(BUY_ALERTS_COPY.h1)
  })

  it('pins the alerts tracking tokens so generate_lead can stay a literal', () => {
    expect(BUY_ALERTS_LEAD_TYPE).toBe('buyer_alerts')
    expect(BUY_ALERTS_FORM_ID).toBe('buyer_alerts_lp')
    expect(BUY_ALERTS_LP_VARIANT).toBe('buy-alerts')
  })

  it('keeps the disclosure cadence on the constants object', () => {
    expect(BUY_ALERTS_COPY.formCadence).toBe('One email per new listing. Unsubscribe any time.')
  })

  it('puts the cadence constant name and the visitor sentence in the client caller', () => {
    const src = readFileSync(CLIENT, 'utf8')
    expect(src).toContain('BUY_ALERTS_COPY.formCadence')
    expect(src).toContain('One email per new listing. Unsubscribe any time.')
    expect(src).toMatch(/name=["']company["']/)
    expect(src).not.toMatch(/company:\s*(''|"")/)
  })
})
