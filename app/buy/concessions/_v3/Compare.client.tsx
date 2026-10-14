'use client'

/**
 * /buy/concessions: the "Same $10,000" instrument, live.
 *
 * The paid ad shows the same seller dollars two ways with rolling figures;
 * this is that device on the page, on the V3Compare primitive. The reader
 * drags the seller dollars and both monthly savings roll to their new
 * values, drawn as two lengths on one scale. Price, down payment, rate, the
 * points assumption, loan type and occupancy fold under "Your numbers".
 *
 * §0: every figure here is computed in the browser by
 * lib/concessions/payment-math from inputs the reader can see. The starting
 * rate is the page's live Freddie Mac read (rateSourceLine names it); the
 * starting dollars are the median Bend credit from lib/concessions/results.
 * Figures are principal and interest only, and the section says so.
 */
import { useMemo, useState } from 'react'
import { V3Compare, type V3CompareField, type V3CompareOutcome } from '@/components/site/v3'
import { comparePriceCutVsConcession, type LoanType, type Occupancy } from '@/lib/concessions/payment-math'
import { formatPriceCents, formatPriceExact } from '@/lib/format/money'
import {
  AMOUNT_HINT,
  AMOUNT_LABEL,
  COMPARE_CLAIM,
  COMPARE_EYEBROW,
  COMPARE_HEADING,
  INPUTS_LABEL,
  LENDER_LINE,
  LOAN_TYPE_OPTIONS,
  OCCUPANCY_OPTIONS,
  POINTS_ASSUMPTION,
} from './constants'

type Props = {
  initialPrice: number
  initialDownPct: number
  initialRatePct: number
  initialDollars: number
  rateSourceLine: string
}

const AMOUNT_STEP = 500

function wholeDollars(n: number): string {
  return Math.max(0, Math.round(n)).toLocaleString('en-US')
}

function roundUpTo(n: number, step: number): number {
  return Math.ceil(n / step) * step
}

export function ConcessionsCompare({
  initialPrice,
  initialDownPct,
  initialRatePct,
  initialDollars,
  rateSourceLine,
}: Props) {
  const [price, setPrice] = useState(initialPrice)
  const [downPct, setDownPct] = useState(initialDownPct)
  const [ratePct, setRatePct] = useState(initialRatePct)
  const [dollars, setDollars] = useState(initialDollars)
  const [pointsPer025, setPointsPer025] = useState(1)
  const [loanType, setLoanType] = useState<LoanType>('conventional')
  const [occupancy, setOccupancy] = useState<Occupancy>('principal')

  const result = useMemo(
    () =>
      comparePriceCutVsConcession({
        price,
        downPct,
        ratePct,
        dollars,
        pointsPer025,
        loanType,
        occupancy,
      }),
    [price, downPct, ratePct, dollars, pointsPer025, loanType, occupancy],
  )

  const loanLabel = LOAN_TYPE_OPTIONS.find((o) => o.value === loanType)?.label ?? 'This loan'

  // The scrubber runs a little past the loan's cap so the reader can see the
  // cap line turn, and never below the amount already set.
  const amountMax = Math.max(
    roundUpTo(result.capDollars + 5 * AMOUNT_STEP, AMOUNT_STEP),
    roundUpTo(dollars, AMOUNT_STEP),
    10 * AMOUNT_STEP,
  )

  const outcomes: [V3CompareOutcome, V3CompareOutcome] = [
    {
      key: 'price-cut',
      label: 'Off the price',
      value: result.priceCut.saves,
      formatted: wholeDollars(result.priceCut.saves),
      prefix: '$',
      unit: 'a month lower',
      sentence: `Payment ${formatPriceCents(result.priceCut.pi)} a month on a ${formatPriceExact(result.priceCut.loan)} loan at ${ratePct.toFixed(2)}%.`,
      detail: `Cash to close down ${formatPriceExact(result.priceCut.cashToCloseReduction)}, because the down payment is ${downPct}% of the lower price.`,
    },
    {
      key: 'concession',
      label: 'Toward your rate',
      value: result.concession.saves,
      formatted: wholeDollars(result.concession.saves),
      prefix: '$',
      unit: 'a month lower',
      sentence: `Payment ${formatPriceCents(result.concession.pi)} a month on the full ${formatPriceExact(result.loan)} loan at about ${result.concession.ratePct.toFixed(3)}%.`,
      detail: `${result.concession.points.toFixed(2)} discount points bought with the seller's credit. Principal and interest only.`,
    },
  ]

  const advantage = result.monthlyAdvantage
  const verdict =
    advantage > 0.5
      ? `Toward the rate saves ${formatPriceCents(advantage)} more a month.`
      : advantage < -0.5
        ? `Off the price saves ${formatPriceCents(Math.abs(advantage))} more a month at these numbers.`
        : 'At these numbers the two come out about even.'
  const verdictNote =
    advantage > 0.5
      ? `${formatPriceExact(Math.round(result.fullTermAdvantage))} over 360 months if the loan is held the full term.`
      : undefined

  const status = result.withinCap
    ? {
        text: `${formatPriceExact(dollars)} is within the ${result.capPct}% ${loanLabel} cap of ${formatPriceExact(result.capDollars)} at ${result.ltvPct.toFixed(0)}% LTV. The credit still cannot exceed actual closing costs.`,
      }
    : {
        text: `${formatPriceExact(dollars)} is over the ${result.capPct}% ${loanLabel} cap of ${formatPriceExact(result.capDollars)} at ${result.ltvPct.toFixed(0)}% LTV. The credit also cannot exceed actual closing costs. ${LENDER_LINE}`,
        exception: true,
      }

  const fields: V3CompareField[] = [
    { kind: 'number', name: 'price', label: 'Home price', value: price, min: 50_000, step: 1_000, onChange: (n) => setPrice(n || 0) },
    { kind: 'number', name: 'down', label: 'Down payment (%)', value: downPct, min: 0, max: 100, step: 1, onChange: (n) => setDownPct(n || 0) },
    { kind: 'number', name: 'rate', label: 'Interest rate (%)', value: ratePct, min: 0, max: 20, step: 0.01, onChange: (n) => setRatePct(n || 0) },
    {
      kind: 'number',
      name: 'points',
      label: 'Points per 0.25%',
      value: pointsPer025,
      min: 0.25,
      max: 4,
      step: 0.25,
      hint: POINTS_ASSUMPTION,
      onChange: (n) => setPointsPer025(n || 1),
    },
    {
      kind: 'select',
      name: 'loan',
      label: 'Loan type',
      value: loanType,
      options: LOAN_TYPE_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      onChange: (v) => setLoanType(v as LoanType),
    },
    {
      kind: 'select',
      name: 'occupancy',
      label: 'How you will use the home',
      value: occupancy,
      options: OCCUPANCY_OPTIONS.map((o) => ({ value: o.value, label: o.label })),
      hint: 'Conventional investment property is capped at 2%. Primary and second home follow 3 / 6 / 9 by down payment.',
      onChange: (v) => setOccupancy(v as Occupancy),
    },
  ]

  return (
    <V3Compare
      id="calculator"
      eyebrow={COMPARE_EYEBROW}
      heading={COMPARE_HEADING}
      claim={COMPARE_CLAIM}
      amount={{
        label: AMOUNT_LABEL,
        value: dollars,
        min: 0,
        max: amountMax,
        step: AMOUNT_STEP,
        formatted: formatPriceExact(dollars),
        onChange: setDollars,
        hint: AMOUNT_HINT,
      }}
      outcomes={outcomes}
      verdict={verdict}
      verdictNote={verdictNote}
      status={status}
      inputs={{ label: INPUTS_LABEL, fields }}
      source={`${rateSourceLine} Payment math is principal and interest on a 30-year fixed loan; the buy-down assumes ${pointsPer025.toFixed(2)} point per 0.25% of rate, which varies by lender.`}
      sourceName="Freddie Mac PMMS"
      legal={`${LENDER_LINE} Figures are principal and interest only.`}
    />
  )
}
