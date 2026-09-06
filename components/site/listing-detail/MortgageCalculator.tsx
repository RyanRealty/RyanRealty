'use client'

import { useMemo, useState } from 'react'
import { Price } from '@/components/site/primitives'
import { publishFinancingSplit } from '@/lib/finance/publish-down-payment'
import {
  computeMonthlyPitiBreakdown,
  DEFAULT_PITI_DOWN_PAYMENT_PCT,
  DEFAULT_PITI_INSURANCE_RATE,
  DEFAULT_PITI_RATE,
  DEFAULT_PITI_TERM_YEARS,
} from '@/lib/listing-tier1'

/**
 * Listing-detail MortgageCalculator — KB section style.
 * Navy sec-head, Amboqia heading. All interactive controls preserved.
 *
 * Per CLAUDE.md §0 Data Accuracy: labeled as estimate, not a quote.
 * Seed total is computeMonthlyPiti with the same inputs as the face Est. $/mo.
 */

type Props = {
  listPrice: number | null
  taxAnnualAmount?: number | null
  hoaMonthly?: number | null
  className?: string
  /**
   * Seed rate in PERCENT (6.67 = 6.67%), resolved server-side from
   * getCalculatorDefaults() — which reads the ingested 30-yr series, not a
   * hand-typed row. Omitted / null falls back to DEFAULT_PITI_RATE so the
   * calculator always renders, and so it matches the face estimate.
   */
  ratePct?: number | null
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

export function MortgageCalculator({ listPrice, taxAnnualAmount, className, ratePct, hoaMonthly }: Props) {
  const seedRatePct =
    typeof ratePct === 'number' && Number.isFinite(ratePct) && ratePct > 0
      ? ratePct
      : DEFAULT_PITI_RATE * 100
  const [priceInput, setPriceInput] = useState(listPrice ? String(listPrice) : '')
  const [downPctInput, setDownPctInput] = useState(String(DEFAULT_PITI_DOWN_PAYMENT_PCT))
  const [rateInput, setRateInput] = useState(String(seedRatePct))
  const [termInput, setTermInput] = useState(String(DEFAULT_PITI_TERM_YEARS))
  // Insurance is an ASSUMPTION, not a fact we hold. Empty input = the seed
  // (0.35% of price per year, same as computeMonthlyPiti) keeps tracking the
  // price field; any typed value replaces the assumption with the buyer's quote.
  const [insuranceInput, setInsuranceInput] = useState('')

  const result = useMemo(() => {
    const price = parseCurrency(priceInput)
    const downPct = parsePercent(downPctInput)
    const enteredRatePct = parsePercent(rateInput)
    const termYears = Math.max(1, Math.round(parsePercent(termInput)))
    const split = publishFinancingSplit({ price, downPaymentPct: downPct })
    const down = split?.downPayment ?? 0
    const principal = split?.loanAmount ?? 0
    const insuranceOverride = insuranceInput.trim() !== '' ? parseCurrency(insuranceInput) : null
    const usingSeedDown = downPct === DEFAULT_PITI_DOWN_PAYMENT_PCT
    const usingSeedTerm = termYears === DEFAULT_PITI_TERM_YEARS
    const breakdown = computeMonthlyPitiBreakdown({
      listPrice: price > 0 ? price : null,
      taxAnnual: taxAnnualAmount ?? null,
      hoaMonthly: hoaMonthly ?? null,
      mortgageRate: enteredRatePct,
      financedFraction: usingSeedDown
        ? null
        : Number.isFinite(downPct)
          ? Math.min(1, Math.max(0, 1 - downPct / 100))
          : null,
      termMonths: usingSeedTerm ? null : termYears * 12,
      insuranceAnnual: insuranceOverride,
    })
    return {
      principal,
      down,
      pi: breakdown?.pi ?? 0,
      taxesMonthly: breakdown?.taxMonthly ?? 0,
      insuranceMonthly: breakdown?.insuranceMonthly ?? 0,
      hoaMonthly: breakdown?.hoaMonthly ?? 0,
      piti: breakdown?.total ?? 0,
    }
  }, [priceInput, downPctInput, rateInput, termInput, insuranceInput, taxAnnualAmount, hoaMonthly])

  const insuranceSeedPerYear = Math.round(parseCurrency(priceInput) * DEFAULT_PITI_INSURANCE_RATE)
  const insurancePctLabel = Math.round(DEFAULT_PITI_INSURANCE_RATE * 1e4) / 100

  const barSum = result.pi + result.taxesMonthly + result.insuranceMonthly + result.hoaMonthly || 1

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
          {result.hoaMonthly > 0 ? (
            <span className="listing-pay__bar-seg listing-pay__bar-seg--hoa" style={{ flexGrow: result.hoaMonthly / barSum, flexBasis: 0 }} />
          ) : null}
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
          {result.hoaMonthly > 0 ? (
            <div className="listing-pay__row">
              <dt>HOA dues</dt>
              <dd><Price value={Math.round(result.hoaMonthly)} exact /></dd>
            </div>
          ) : null}
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
            Insurance starts at {insurancePctLabel}% of price each year. Type your quote to replace it.
          </p>
        </div>
      </div>
    </section>
  )
}
