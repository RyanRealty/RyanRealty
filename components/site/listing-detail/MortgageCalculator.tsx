'use client'

import { useMemo, useState } from 'react'
import { Price } from '@/components/site/primitives'
import { publishFinancingSplit } from '@/lib/finance/publish-down-payment'
import { PROPERTY_TAX_RATE_PCT } from '@/lib/property-tax-rate'

/**
 * Listing-detail MortgageCalculator — KB section style.
 * Navy sec-head, Amboqia heading. All interactive controls preserved.
 *
 * Per CLAUDE.md §0 Data Accuracy: labeled as estimate, not a quote.
 */

type Props = {
  listPrice: number | null
  taxAnnualAmount?: number | null
  className?: string
  /**
   * Seed rate in PERCENT (6.67 = 6.67%), resolved server-side from
   * getCalculatorDefaults() — which reads the ingested 30-yr series, not a
   * hand-typed row. Omitted / null falls back to DEFAULT_RATE_PCT so the
   * calculator always renders.
   */
  ratePct?: number | null
}

/** Fallback seed only. A real rate arrives as the `ratePct` prop. */
const DEFAULT_RATE_PCT = 7.0
const DEFAULT_DOWN_PCT = 20
const DEFAULT_TERM_YEARS = 30
const INSURANCE_PER_300K = 1000

function monthlyPI(principal: number, ratePct: number, termYears: number): number {
  if (principal <= 0 || termYears <= 0) return 0
  const r = ratePct / 100 / 12
  const n = termYears * 12
  if (r === 0) return principal / n
  return (principal * r * (1 + r) ** n) / ((1 + r) ** n - 1)
}

function parseCurrency(raw: string): number {
  const n = parseFloat(raw.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

/** Comma-group the home-price field for display ("6999000" → "6,999,000")
 *  while keeping the raw digits in state. Empty stays empty so the field can
 *  be cleared. */
function formatPriceForDisplay(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('en-US')
}

function parsePercent(raw: string): number {
  const n = parseFloat(raw.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function MortgageCalculator({ listPrice, taxAnnualAmount, className, ratePct }: Props) {
  const seedRatePct =
    typeof ratePct === 'number' && Number.isFinite(ratePct) && ratePct > 0 ? ratePct : DEFAULT_RATE_PCT
  const [priceInput, setPriceInput] = useState(listPrice ? String(listPrice) : '')
  const [downPctInput, setDownPctInput] = useState(String(DEFAULT_DOWN_PCT))
  const [rateInput, setRateInput] = useState(String(seedRatePct))
  const [termInput, setTermInput] = useState(String(DEFAULT_TERM_YEARS))
  // Insurance is an ASSUMPTION, not a fact we hold. Empty input = the seed
  // ($1,000 per $300K of price per year) keeps tracking the price field; any
  // typed value replaces the assumption with the buyer's own quote.
  const [insuranceInput, setInsuranceInput] = useState('')

  const result = useMemo(() => {
    const price = parseCurrency(priceInput)
    const downPct = parsePercent(downPctInput)
    const ratePct = parsePercent(rateInput)
    const termYears = Math.max(1, Math.round(parsePercent(termInput)))
    const split = publishFinancingSplit({ price, downPaymentPct: downPct })
    const down = split?.downPayment ?? 0
    const principal = split?.loanAmount ?? 0
    const pi = monthlyPI(principal, ratePct, termYears)
    const taxesPerYear = taxAnnualAmount ?? price * (PROPERTY_TAX_RATE_PCT / 100)
    const insuranceOverride = parseCurrency(insuranceInput)
    const insurancePerYear =
      insuranceInput.trim() !== '' ? insuranceOverride : (price / 300_000) * INSURANCE_PER_300K
    const taxesMonthly = taxesPerYear / 12
    const insuranceMonthly = insurancePerYear / 12
    return {
      principal,
      down,
      pi,
      taxesMonthly,
      insuranceMonthly,
      piti: pi + taxesMonthly + insuranceMonthly,
    }
  }, [priceInput, downPctInput, rateInput, termInput, insuranceInput, taxAnnualAmount])

  const insuranceSeedPerYear = Math.round((parseCurrency(priceInput) / 300_000) * INSURANCE_PER_300K)

  const barSum = result.pi + result.taxesMonthly + result.insuranceMonthly || 1

  return (
    <section className={className}>
      <div className="sec-head">
        <div>
          <div className="eyebrow sec-index">Estimate</div>
          <h2 className="sec-title">Payment calculator</h2>
        </div>
      </div>

      <div className="listing-pay">
        <div className="listing-pay__total">
          <Price value={Math.round(result.piti)} exact /> per month
        </div>
        <div className="listing-pay__bar" aria-hidden>
          <span className="listing-pay__bar-seg listing-pay__bar-seg--pi" style={{ flexGrow: result.pi / barSum, flexBasis: 0 }} />
          <span className="listing-pay__bar-seg listing-pay__bar-seg--tax" style={{ flexGrow: result.taxesMonthly / barSum, flexBasis: 0 }} />
          <span className="listing-pay__bar-seg listing-pay__bar-seg--ins" style={{ flexGrow: result.insuranceMonthly / barSum, flexBasis: 0 }} />
        </div>
        <dl className="listing-pay__breakdown">
          <div className="listing-pay__row">
            <dt>Principal and interest</dt>
            <dd><Price value={Math.round(result.pi)} exact /></dd>
          </div>
          <div className="listing-pay__row">
            <dt>Property taxes</dt>
            <dd><Price value={Math.round(result.taxesMonthly)} exact /></dd>
          </div>
          <div className="listing-pay__row">
            <dt>Homeowners insurance</dt>
            <dd><Price value={Math.round(result.insuranceMonthly)} exact /></dd>
          </div>
        </dl>
        <p className="listing-pay__note">
          A rough estimate, not a quote. Loan amount <Price value={result.principal} exact /> ·{' '}
          <Price value={result.down} exact /> down · {termInput} year term.
        </p>

        <div className="listing-pay__fields">
          <div className="listing-pay__field">
            <label htmlFor="mc-price">Home price</label>
            <input
              id="mc-price"
              type="text"
              inputMode="numeric"
              value={formatPriceForDisplay(priceInput)}
              onChange={(e) => setPriceInput(e.target.value.replace(/[^\d]/g, ''))}
            />
          </div>
          <div className="listing-pay__field-row">
            <div className="listing-pay__field">
              <label htmlFor="mc-down">Down payment %</label>
              <input
                id="mc-down"
                type="text"
                inputMode="decimal"
                value={downPctInput}
                onChange={(e) => setDownPctInput(e.target.value)}
              />
            </div>
            <div className="listing-pay__field">
              <label htmlFor="mc-rate">Rate %</label>
              <input
                id="mc-rate"
                type="text"
                inputMode="decimal"
                value={rateInput}
                onChange={(e) => setRateInput(e.target.value)}
              />
            </div>
          </div>
          <div className="listing-pay__field-row">
            <div className="listing-pay__field">
              <label htmlFor="mc-term">Term (years)</label>
              <input
                id="mc-term"
                type="text"
                inputMode="numeric"
                value={termInput}
                onChange={(e) => setTermInput(e.target.value)}
              />
            </div>
            <div className="listing-pay__field">
              <label htmlFor="mc-insurance">Insurance $/yr</label>
              <input
                id="mc-insurance"
                type="text"
                inputMode="numeric"
                value={formatPriceForDisplay(insuranceInput)}
                onChange={(e) => setInsuranceInput(e.target.value.replace(/[^\d]/g, ''))}
                placeholder={insuranceSeedPerYear > 0 ? insuranceSeedPerYear.toLocaleString('en-US') : ''}
              />
            </div>
          </div>
          <p className="listing-pay__note">
            Insurance starts at $1,000 per $300K of price each year. Type your quote to replace it.
          </p>
        </div>
      </div>
    </section>
  )
}
