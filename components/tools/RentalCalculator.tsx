'use client'
/**
 * The public rental underwriting tool, on the components/site/v3 register.
 *
 * WHAT CHANGED AND WHY (2026-09-02). It rendered 56 shadcn `data-slot` elements
 * — Card, Input, Label, Slider, Separator, Button, Select, Accordion, Tooltip
 * and Table — on TWO public routes: the listing page through RentalAnalysis and
 * /tools/rental-property-calculator. §3 puts the public site on components/site/v3,
 * and two registers on one page is the defect that rule exists to end.
 *
 * The controls are native: <input type=range> for the down payment, <select>
 * for the term, <details> for the two folds, a real <table> for the projection.
 * Native controls arrive with keyboard support, form semantics and a focus ring
 * that the radix versions were re-implementing in a second neutral.
 *
 * THE TOOLTIP IS GONE AND ITS WORDS ARE NOT. Four definitions lived in hover
 * tooltips behind 16px "?" buttons — the smallest targets on the page, and
 * invisible to anyone who does not hover. They are one "What these mean" fold
 * under the figures now, always in the DOM.
 *
 * THE MATH IS UNTOUCHED. Every figure still comes from analyzeRental in
 * lib/rental-analysis; this file changed only what draws them.
 */

import { useMemo, useState } from 'react'
import { PROPERTY_TAX_RATE_FRACTION } from '@/lib/property-tax-rate'
import { cn } from '@/lib/utils'
import { V3Button } from '@/components/site/v3'
import RentalLeadForm from '@/components/tools/RentalLeadForm'
import { analyzeRental, formatUSD, formatPct, type RentalAnalysisInputs } from '@/lib/rental-analysis'
import EquityProjectionChart from './EquityProjectionChart.client'
import '@/components/site/v3/tokens.css'
import './rental-calculator.css'

/** Optional rent estimate (e.g. from RentCast on a listing page). */
export type RentEstimate = {
  value: number
  low?: number
  high?: number
  source?: string
}

export type RentalCalculatorProps = {
  /** Pre-fill from a listing or URL params. */
  initialPrice?: number
  initialRent?: number
  initialPropertyTaxesYear?: number
  initialDownPaymentPct?: number
  initialInterestRate?: number
  /** Listing HOA from publishRentalHoaMonthly. Standalone tool leaves this unset. */
  initialHoaMonthly?: number
  /** Shown above the calculator on listing embeds, e.g. "2954 NW Awbrey Rd". */
  propertyLabel?: string
  /** Estimated rent to surface as a hint and pre-fill. */
  rentEstimate?: RentEstimate
  /** Compact mode trims chrome for the listing-detail embed. */
  embedded?: boolean
}

const MILESTONE_YEARS = [1, 2, 3, 5, 10, 20, 30]
const ALL_YEARS = Array.from({ length: 30 }, (_, i) => i + 1)

function roundTo(n: number, step: number): number {
  return Math.round(n / step) * step
}

function num(value: string): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

/** The four figures the results panel prints, and what each one means. */
const TERMS: ReadonlyArray<{ term: string; meaning: string }> = [
  {
    term: 'Cash flow',
    meaning:
      'Money left each month after the mortgage, taxes, insurance, management and reserves are paid.',
  },
  {
    term: 'Cap rate',
    meaning:
      'Net operating income divided by purchase price. A price-independent yardstick of yield.',
  },
  {
    term: 'Cash on cash',
    meaning:
      'Annual cash flow divided by the cash you put in: down payment, closing costs and rehab.',
  },
  { term: 'Cash needed', meaning: 'Down payment plus cash closing costs plus rehab budget.' },
]

function NumberField({
  id,
  label,
  value,
  onChange,
  min = 0,
  step = 1,
  prefix,
  suffix,
  hint,
}: {
  id: string
  label: React.ReactNode
  value: number
  onChange: (n: number) => void
  min?: number
  step?: number
  prefix?: string
  suffix?: string
  hint?: React.ReactNode
}) {
  return (
    <div className="rc__field">
      <label htmlFor={id} className="rc__fieldlabel">
        {label}
      </label>
      <div className="rc__control">
        {prefix ? <span className="rc__affix rc__affix--prefix">{prefix}</span> : null}
        <input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(num(e.target.value))}
          min={min}
          step={step}
          className={cn(
            'rc__input',
            prefix && 'rc__input--prefixed',
            suffix && 'rc__input--suffixed',
          )}
        />
        {suffix ? <span className="rc__affix rc__affix--suffix">{suffix}</span> : null}
      </div>
      {hint ? <p className="rc__hint">{hint}</p> : null}
    </div>
  )
}

function Kpi({
  label,
  value,
  exception = false,
}: {
  label: string
  value: string
  /** Only a cash flow below zero. The accent marks a data exception, §3. */
  exception?: boolean
}) {
  return (
    <div className="rc__kpi">
      <p className="rc__kpilabel">{label}</p>
      <p className={cn('rc__kpivalue', exception && 'rc__kpivalue--exception')}>{value}</p>
    </div>
  )
}

function FlowRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('rc__flowrow', strong && 'rc__flowrow--strong')}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

export default function RentalCalculator({
  initialPrice,
  initialRent,
  initialPropertyTaxesYear,
  initialDownPaymentPct,
  initialInterestRate,
  initialHoaMonthly,
  propertyLabel,
  rentEstimate,
  embedded = false,
}: RentalCalculatorProps) {
  const price0 = initialPrice && initialPrice > 0 ? initialPrice : 650000
  const rent0 =
    initialRent && initialRent > 0
      ? initialRent
      : rentEstimate?.value && rentEstimate.value > 0
        ? Math.round(rentEstimate.value)
        : roundTo(price0 * 0.005, 50)

  const [purchasePrice, setPurchasePrice] = useState(price0)
  const [downPaymentPct, setDownPaymentPct] = useState(
    initialDownPaymentPct != null && initialDownPaymentPct >= 0 && initialDownPaymentPct <= 100
      ? initialDownPaymentPct
      : 25
  )
  const [interestRate, setInterestRate] = useState(
    initialInterestRate != null && initialInterestRate > 0 ? initialInterestRate : 7.5
  )
  const [loanTermYears, setLoanTermYears] = useState(30)
  const [rehabCost, setRehabCost] = useState(0)
  const [grossRent, setGrossRent] = useState(rent0)
  const [vacancyPct, setVacancyPct] = useState(5)

  const [propertyTaxesYear, setPropertyTaxesYear] = useState(
    initialPropertyTaxesYear && initialPropertyTaxesYear > 0
      ? Math.round(initialPropertyTaxesYear)
      : roundTo(price0 * PROPERTY_TAX_RATE_FRACTION, 50)
  )
  const [insuranceYear, setInsuranceYear] = useState(1400)
  const [mgmtPct, setMgmtPct] = useState(8)
  const [maintPct, setMaintPct] = useState(5)
  const [capexPct, setCapexPct] = useState(5)
  const [hoaMonthly, setHoaMonthly] = useState(
    initialHoaMonthly != null && Number.isFinite(initialHoaMonthly) && initialHoaMonthly > 0
      ? Math.round(initialHoaMonthly)
      : 0,
  )

  const [appreciationPct, setAppreciationPct] = useState(3)
  const [rentGrowthPct, setRentGrowthPct] = useState(2)
  const [expenseGrowthPct, setExpenseGrowthPct] = useState(2)

  const inputs = useMemo<RentalAnalysisInputs>(
    () => ({
      purchasePrice,
      downPaymentPct,
      interestRatePct: interestRate,
      loanTermYears,
      rehabCost,
      grossRentMonthly: grossRent,
      vacancyPct,
      expenses: {
        propertyTaxes: propertyTaxesYear / 12,
        insurance: insuranceYear / 12,
        propertyManagement: (grossRent * mgmtPct) / 100,
        maintenance: (grossRent * maintPct) / 100,
        capitalReserves: (grossRent * capexPct) / 100,
        hoa: hoaMonthly,
      },
      appreciationPct,
      rentGrowthPct,
      expenseGrowthPct,
      projectionYears: ALL_YEARS,
    }),
    [
      purchasePrice,
      downPaymentPct,
      interestRate,
      loanTermYears,
      rehabCost,
      grossRent,
      vacancyPct,
      propertyTaxesYear,
      insuranceYear,
      mgmtPct,
      maintPct,
      capexPct,
      hoaMonthly,
      appreciationPct,
      rentGrowthPct,
      expenseGrowthPct,
    ]
  )
  const result = useMemo(() => analyzeRental(inputs), [inputs])

  const [downloading, setDownloading] = useState(false)
  async function handleDownloadPdf() {
    setDownloading(true)
    try {
      const res = await fetch('/api/pdf/rental', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...inputs, propertyLabel: propertyLabel ?? null }),
      })
      if (!res.ok) return
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'ryan-realty-rental-analysis.pdf'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setDownloading(false)
    }
  }

  const milestones = result.projection.filter((p) => MILESTONE_YEARS.includes(p.year))
  const cashFlowPositive = result.cashFlowMonthly >= 0
  const downPayment = result.downPayment

  const verdict = cashFlowPositive
    ? `At ${formatUSD(purchasePrice)} with ${downPaymentPct}% down, this property cash-flows ${formatUSD(
        result.cashFlowMonthly
      )} per month, a ${formatPct(result.capRatePurchase)} cap rate and ${formatPct(
        result.cashOnCash
      )} cash-on-cash return.`
    : `At ${formatUSD(purchasePrice)} with ${downPaymentPct}% down, this property runs ${formatUSD(
        Math.abs(result.cashFlowMonthly)
      )} per month negative. Adjust the price, down payment, or rent to find what works.`

  return (
    <div className="rc">
      {!embedded ? (
        <div className="rc__head">
          <h2 className="rc__title">Rental property calculator</h2>
          {propertyLabel ? <p className="rc__label">{propertyLabel}</p> : null}
        </div>
      ) : null}

      <div className="rc__inputs">
        <section className="rc__group" aria-label="Purchase and financing">
          <h3 className="rc__grouphead">Purchase and financing</h3>
          <div className="rc__fields">
            <NumberField id="price" label="Purchase price" prefix="$" step={5000} min={0} value={purchasePrice} onChange={setPurchasePrice} />
            <NumberField id="rehab" label="Rehab budget (optional)" prefix="$" step={1000} min={0} value={rehabCost} onChange={setRehabCost} />
          </div>
          <div className="rc__slider">
            <div className="rc__sliderhead">
              <label htmlFor="down" className="rc__fieldlabel">
                Down payment
              </label>
              <span className="rc__slidervalue">
                {downPaymentPct}% · {formatUSD(downPayment)}
              </span>
            </div>
            {/* A native range: keyboard-operable, announces its own value, and
                the thumb is grown to the tap floor in CSS. */}
            <input
              id="down"
              type="range"
              className="rc__range"
              min={0}
              max={50}
              step={1}
              value={downPaymentPct}
              onChange={(e) => setDownPaymentPct(num(e.target.value))}
              aria-label="Down payment percent"
              aria-valuetext={`${downPaymentPct} percent, ${formatUSD(downPayment)}`}
            />
          </div>
          <div className="rc__fields">
            <NumberField id="rate" label="Interest rate" suffix="%" step={0.125} min={0} value={interestRate} onChange={setInterestRate} />
            <div className="rc__field">
              <label htmlFor="term" className="rc__fieldlabel">
                Loan term
              </label>
              <select
                id="term"
                className="rc__select"
                value={String(loanTermYears)}
                onChange={(e) => setLoanTermYears(Number(e.target.value))}
              >
                <option value="15">15 years</option>
                <option value="20">20 years</option>
                <option value="30">30 years</option>
              </select>
            </div>
          </div>
        </section>

        <section className="rc__group" aria-label="Income">
          <h3 className="rc__grouphead">Income</h3>
          <div className="rc__fields">
            <NumberField
              id="rent"
              label="Monthly rent"
              prefix="$"
              step={25}
              min={0}
              value={grossRent}
              onChange={setGrossRent}
              hint={
                rentEstimate?.value
                  ? `Estimate ${formatUSD(rentEstimate.value)}${
                      rentEstimate.low && rentEstimate.high
                        ? ` (${formatUSD(rentEstimate.low)} to ${formatUSD(rentEstimate.high)})`
                        : ''
                    }${rentEstimate.source ? ` · ${rentEstimate.source}` : ''}. Edit to your own number.`
                  : 'Your expected market rent. Edit to your own number.'
              }
            />
            <NumberField id="vacancy" label="Vacancy" suffix="%" step={0.5} min={0} value={vacancyPct} onChange={setVacancyPct} />
          </div>
        </section>

        <section className="rc__group" aria-label="Operating expenses">
          <h3 className="rc__grouphead">Operating expenses</h3>
          <div className="rc__fields">
            <NumberField id="taxes" label="Property taxes (yearly)" prefix="$" step={50} min={0} value={propertyTaxesYear} onChange={setPropertyTaxesYear} />
            <NumberField id="insurance" label="Insurance (yearly)" prefix="$" step={50} min={0} value={insuranceYear} onChange={setInsuranceYear} />
            <NumberField id="mgmt" label="Management (% of rent)" suffix="%" step={0.5} min={0} value={mgmtPct} onChange={setMgmtPct} />
            <NumberField id="maint" label="Maintenance (% of rent)" suffix="%" step={0.5} min={0} value={maintPct} onChange={setMaintPct} />
            <NumberField id="capex" label="Capital reserves (% of rent)" suffix="%" step={0.5} min={0} value={capexPct} onChange={setCapexPct} />
            <NumberField id="hoa" label="HOA (monthly)" prefix="$" step={10} min={0} value={hoaMonthly} onChange={setHoaMonthly} />
          </div>
        </section>

        <details className="rc__fold">
          <summary className="rc__foldsummary">Long-term assumptions</summary>
          <div className="rc__foldbody">
            <div className="rc__fields rc__fields--three">
              <NumberField id="appr" label="Appreciation / yr" suffix="%" step={0.5} min={0} value={appreciationPct} onChange={setAppreciationPct} />
              <NumberField id="rentgrow" label="Rent growth / yr" suffix="%" step={0.5} min={0} value={rentGrowthPct} onChange={setRentGrowthPct} />
              <NumberField id="expgrow" label="Expense growth / yr" suffix="%" step={0.5} min={0} value={expenseGrowthPct} onChange={setExpenseGrowthPct} />
            </div>
          </div>
        </details>
      </div>

      <div className="rc__results">
        <div className="rc__kpis">
          <Kpi
            label="Cash flow"
            value={`${formatUSD(result.cashFlowMonthly)}/mo`}
            exception={!cashFlowPositive}
          />
          <Kpi label="Cap rate" value={formatPct(result.capRatePurchase)} />
          <Kpi label="Cash on cash" value={formatPct(result.cashOnCash)} />
          <Kpi label="Cash needed" value={formatUSD(result.totalCashNeeded)} />
        </div>

        <p className="rc__verdict">{verdict}</p>

        {/* The four definitions that used to be hover tooltips on 16px buttons. */}
        <details className="rc__fold">
          <summary className="rc__foldsummary">What these mean</summary>
          <div className="rc__foldbody">
            <dl className="rc__terms">
              {TERMS.map((t) => (
                <div className="rc__term" key={t.term}>
                  <dt>{t.term}</dt>
                  <dd>{t.meaning}</dd>
                </div>
              ))}
            </dl>
          </div>
        </details>

        <dl className="rc__flow">
          <p className="rc__flowhead">Monthly cash flow</p>
          <FlowRow label="Gross rent" value={formatUSD(result.grossRentMonthly)} />
          <FlowRow label={`Vacancy (${vacancyPct}%)`} value={`- ${formatUSD(result.vacancyAnnual / 12)}`} />
          <FlowRow label="Operating income" value={formatUSD(result.operatingIncomeAnnual / 12)} strong />
          <FlowRow label="Operating expenses" value={`- ${formatUSD(result.operatingExpensesMonthly)}`} />
          <FlowRow label="Net operating income" value={formatUSD(result.noiMonthly)} strong />
          <FlowRow label="Loan payment" value={`- ${formatUSD(result.monthlyDebtService)}`} />
          <FlowRow label="Cash flow" value={formatUSD(result.cashFlowMonthly)} strong />
        </dl>

        <details className="rc__fold">
          <summary className="rc__foldsummary">30-year projection</summary>
          <div className="rc__foldbody">
            <EquityProjectionChart projection={result.projection} />
            <div className="rc__tablewrap">
              <table className="rc__table">
                <caption className="rc__flowhead">Value, equity and cash flow by year</caption>
                <thead>
                  <tr>
                    <th scope="col">Year</th>
                    <th scope="col">Value</th>
                    <th scope="col">Equity</th>
                    <th scope="col">Cash flow</th>
                  </tr>
                </thead>
                <tbody>
                  {milestones.map((p) => (
                    <tr key={p.year}>
                      <th scope="row">{p.year}</th>
                      <td>{formatUSD(p.propertyValue)}</td>
                      <td>{formatUSD(p.equity)}</td>
                      <td>{formatUSD(p.cashFlow)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <div className="rc__actions">
          <RentalLeadForm
            propertyLabel={propertyLabel}
            contextNote={`${formatUSD(purchasePrice)} · cash flow ${formatUSD(result.cashFlowMonthly)}/mo · cap rate ${formatPct(result.capRatePurchase)}`}
          />
          <V3Button
            variant="ghost"
            onClick={handleDownloadPdf}
            disabled={downloading}
          >
            {downloading ? 'Preparing report' : 'Download PDF report'}
          </V3Button>
          <V3Button variant="ghost" href="/homes-for-sale">
            Browse homes for sale
          </V3Button>
        </div>

        <p className="rc__note">
          Estimates only, not investment advice or a guarantee of rent, value, or return.
          Figures depend on the numbers you enter and current market conditions. Verify with
          your lender, tax advisor, and a Ryan Realty broker before you rely on them.
        </p>
      </div>
    </div>
  )
}
