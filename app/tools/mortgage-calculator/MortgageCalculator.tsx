'use client'

import { useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type Props = {
  initialHomePrice?: number
  initialDownPaymentPct?: number
  initialInterestRate?: number
  initialLoanTermYears?: number
  /** Annual property tax estimate (dollars). Sourced from app_config default_tax_rate_pct × default home price. */
  initialPropertyTaxYear?: number
  /** Annual homeowners insurance estimate (dollars). Sourced from app_config insurance_rate_pct × default home price. */
  initialInsuranceYear?: number
  /** design-audit: on the /tools page the KB section already provides the card +
   *  "Mortgage calculator" title, so the component's own Card/header double-framed
   *  it. `bare` drops the component's frame + title; the listing page keeps it. */
  bare?: boolean
}

export default function MortgageCalculator({
  initialHomePrice,
  initialDownPaymentPct,
  initialInterestRate,
  initialLoanTermYears,
  initialPropertyTaxYear,
  initialInsuranceYear,
  bare = false,
}: Props) {
  const [homePrice, setHomePrice] = useState(
    initialHomePrice && initialHomePrice > 0 ? initialHomePrice : 500000
  )
  const [downPaymentPct, setDownPaymentPct] = useState(
    initialDownPaymentPct != null && initialDownPaymentPct >= 0 && initialDownPaymentPct <= 100
      ? initialDownPaymentPct
      : 20
  )
  const [interestRate, setInterestRate] = useState(
    initialInterestRate != null && initialInterestRate >= 0 && initialInterestRate <= 20
      ? initialInterestRate
      : 7
  )
  const [loanTermYears, setLoanTermYears] = useState(
    initialLoanTermYears != null && [10, 15, 20, 30].includes(initialLoanTermYears)
      ? initialLoanTermYears
      : 30
  )
  const [propertyTaxYear, setPropertyTaxYear] = useState(
    initialPropertyTaxYear != null && initialPropertyTaxYear >= 0 ? initialPropertyTaxYear : 5000
  )
  const [insuranceYear, setInsuranceYear] = useState(
    initialInsuranceYear != null && initialInsuranceYear >= 0 ? initialInsuranceYear : 1500
  )

  const { downPayment, loanAmount, monthlyPrincipalInterest, monthlyTax, monthlyInsurance, monthlyTotal, pmi } =
    useMemo(() => {
      const down = Math.round((homePrice * downPaymentPct) / 100)
      const loan = homePrice - down
      const monthlyRate = interestRate / 100 / 12
      const numPayments = loanTermYears * 12
      const principalInterest =
        loan > 0 && numPayments > 0
          ? (loan * (monthlyRate * Math.pow(1 + monthlyRate, numPayments))) /
            (Math.pow(1 + monthlyRate, numPayments) - 1)
          : 0
      const tax = propertyTaxYear / 12
      const insurance = insuranceYear / 12
      const needsPmi = downPaymentPct < 20 && loan > 0
      const pmiMonthly = needsPmi ? (loan * 0.005) / 12 : 0
      return {
        downPayment: down,
        loanAmount: loan,
        monthlyPrincipalInterest: principalInterest,
        monthlyTax: tax,
        monthlyInsurance: insurance,
        monthlyTotal: principalInterest + tax + insurance + pmiMonthly,
        pmi: pmiMonthly,
      }
    }, [homePrice, downPaymentPct, interestRate, loanTermYears, propertyTaxYear, insuranceYear])

  return (
    <Card className={bare ? 'border-0 bg-transparent shadow-none' : undefined}>
      {bare ? null : (
        <CardHeader>
          <CardTitle>Mortgage calculator</CardTitle>
        </CardHeader>
      )}
      <CardContent className={bare ? 'space-y-8 p-0' : 'space-y-8'}>
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="home-price">Home price</Label>
            <Input
              id="home-price"
              type="number"
              value={homePrice}
              onChange={(e) => setHomePrice(Number(e.target.value) || 0)}
              min={50000}
              step={10000}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="down-payment">Down payment (%)</Label>
            <Input
              id="down-payment"
              type="number"
              value={downPaymentPct}
              onChange={(e) => setDownPaymentPct(Number(e.target.value) || 0)}
              min={0}
              max={100}
              step={1}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="interest-rate">Interest rate (%)</Label>
            <Input
              id="interest-rate"
              type="number"
              value={interestRate}
              onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
              min={0}
              max={20}
              step={0.125}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="loan-term">Loan term (years)</Label>
            <Select value={String(loanTermYears)} onValueChange={(e) => setLoanTermYears(Number(e))}>
              <SelectTrigger id="loan-term">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="10">10</SelectItem>
                <SelectItem value="15">15</SelectItem>
                <SelectItem value="20">20</SelectItem>
                <SelectItem value="30">30</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="property-tax">Property tax (yearly, optional)</Label>
            <Input
              id="property-tax"
              type="number"
              value={propertyTaxYear}
              onChange={(e) => setPropertyTaxYear(Number(e.target.value) || 0)}
              min={0}
              step={500}
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="home-insurance">Home insurance (yearly, optional)</Label>
            <Input
              id="home-insurance"
              type="number"
              value={insuranceYear}
              onChange={(e) => setInsuranceYear(Number(e.target.value) || 0)}
              min={0}
              step={100}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-muted-foreground">
            Down payment: {formatCurrency(downPayment)} · Loan amount: {formatCurrency(loanAmount)}
            {pmi > 0 && (
              <span className="ml-2 text-warning">· PMI (est.): {formatCurrency(pmi)}/mo</span>
            )}
          </p>
          <p className="mt-4 text-3xl font-bold text-foreground">
            {formatCurrency(monthlyTotal)}
            <span className="text-lg font-normal text-muted-foreground">/month</span>
          </p>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Principal &amp; interest: {formatCurrency(monthlyPrincipalInterest)}</span>
            <span>Tax: {formatCurrency(monthlyTax)}</span>
            <span>Insurance: {formatCurrency(monthlyInsurance)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
