'use client'

import { useMemo, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { comparePriceCutVsConcession, type LoanType, type Occupancy } from '@/lib/concessions/payment-math'
import { formatPriceCents, formatPriceExact } from '@/lib/format/money'
import {
  LENDER_LINE,
  LOAN_TYPE_OPTIONS,
  OCCUPANCY_OPTIONS,
  POINTS_ASSUMPTION,
} from './constants'
import './concessions-calc.css'

type Props = {
  initialPrice: number
  initialDownPct: number
  initialRatePct: number
  initialDollars: number
  rateSourceLine: string
}

export function ConcessionsCalculator({
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

  return (
    <div className="concessions-calc">
      <div className="concessions-calc__grid">
        <div className="concessions-calc__field">
          <Label htmlFor="concessions-price">Home price</Label>
          <Input
            id="concessions-price"
            type="number"
            min={50_000}
            step={1_000}
            value={price}
            onChange={(e) => setPrice(Number(e.target.value) || 0)}
          />
        </div>
        <div className="concessions-calc__field">
          <Label htmlFor="concessions-down">Down payment (%)</Label>
          <Input
            id="concessions-down"
            type="number"
            min={0}
            max={100}
            step={1}
            value={downPct}
            onChange={(e) => setDownPct(Number(e.target.value) || 0)}
          />
        </div>
        <div className="concessions-calc__field">
          <Label htmlFor="concessions-rate">Interest rate (%)</Label>
          <Input
            id="concessions-rate"
            type="number"
            min={0}
            max={20}
            step={0.01}
            value={ratePct}
            onChange={(e) => setRatePct(Number(e.target.value) || 0)}
          />
        </div>
        <div className="concessions-calc__field">
          <Label htmlFor="concessions-dollars">Seller dollars</Label>
          <Input
            id="concessions-dollars"
            type="number"
            min={0}
            step={500}
            value={dollars}
            onChange={(e) => setDollars(Number(e.target.value) || 0)}
          />
        </div>
        <div className="concessions-calc__field">
          <Label htmlFor="concessions-points">Points per 0.25%</Label>
          <Input
            id="concessions-points"
            type="number"
            min={0.25}
            max={4}
            step={0.25}
            value={pointsPer025}
            onChange={(e) => setPointsPer025(Number(e.target.value) || 1)}
          />
          <p className="concessions-calc__hint">{POINTS_ASSUMPTION}</p>
        </div>
        <div className="concessions-calc__field">
          <Label htmlFor="concessions-loan">Loan type</Label>
          <Select value={loanType} onValueChange={(v) => setLoanType(v as LoanType)}>
            <SelectTrigger id="concessions-loan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LOAN_TYPE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="concessions-calc__field concessions-calc__field--full">
          <Label htmlFor="concessions-occupancy">How you will use the home</Label>
          <Select value={occupancy} onValueChange={(v) => setOccupancy(v as Occupancy)}>
            <SelectTrigger id="concessions-occupancy">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {OCCUPANCY_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="concessions-calc__hint">
            Conventional investment property is capped at 2%. Primary and second home follow 3 / 6 / 9 by down payment.
          </p>
        </div>
      </div>

      <p className="concessions-calc__source">{rateSourceLine}</p>

      <div className="concessions-calc__cards">
        <article className="concessions-calc__card">
          <p className="concessions-calc__card-label">Price cut</p>
          <p className="concessions-calc__card-value">{formatPriceCents(result.priceCut.pi)}/mo</p>
          <p className="concessions-calc__card-save">Saves {formatPriceCents(result.priceCut.saves)} a month</p>
          <p className="concessions-calc__card-note">
            Loan {formatPriceExact(result.priceCut.loan)} at {ratePct.toFixed(2)}%. Cash to close down by{' '}
            {formatPriceExact(result.priceCut.cashToCloseReduction)} because the down payment is {downPct}% of the lower
            price.
          </p>
        </article>
        <article className="concessions-calc__card">
          <p className="concessions-calc__card-label">Same dollars as a concession</p>
          <p className="concessions-calc__card-value">{formatPriceCents(result.concession.pi)}/mo</p>
          <p className="concessions-calc__card-save">Saves {formatPriceCents(result.concession.saves)} a month</p>
          <p className="concessions-calc__card-note">
            {result.concession.points.toFixed(2)} points. Rate about {result.concession.ratePct.toFixed(3)}% on a{' '}
            {formatPriceExact(result.loan)} loan. P&I only.
          </p>
        </article>
      </div>

      <p className="concessions-calc__advantage">
        Concession advantage: {formatPriceCents(result.monthlyAdvantage)} a month,{' '}
        {formatPriceExact(Math.round(result.fullTermAdvantage))} over 360 months if the loan is held the full term.
      </p>

      {result.withinCap ? (
        <p className="concessions-calc__hint">
          {formatPriceExact(dollars)} is within the {result.capPct}% {loanLabel} cap of{' '}
          {formatPriceExact(result.capDollars)} at {result.ltvPct.toFixed(0)}% LTV. The credit still cannot exceed actual
          closing costs.
        </p>
      ) : (
        <p className="concessions-calc__warn" role="status">
          {formatPriceExact(dollars)} is over the {result.capPct}% {loanLabel} cap of{' '}
          {formatPriceExact(result.capDollars)} at {result.ltvPct.toFixed(0)}% LTV. The credit also cannot exceed actual
          closing costs. {LENDER_LINE}
        </p>
      )}

      <p className="concessions-calc__legal">{LENDER_LINE} Figures are principal and interest only.</p>
    </div>
  )
}
