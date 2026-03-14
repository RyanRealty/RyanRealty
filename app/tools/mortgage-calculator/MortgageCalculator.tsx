'use client'

import { useState, useMemo } from 'react'
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type Props = {
  initialHomePrice?: number
  initialDownPaymentPct?: number
  initialInterestRate?: number
  initialLoanTermYears?: number
}

export default function MortgageCalculator({
  initialHomePrice,
  initialDownPaymentPct,
  initialInterestRate,
  initialLoanTermYears,
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
  const [propertyTaxYear, setPropertyTaxYear] = useState(5000)
  const [insuranceYear, setInsuranceYear] = useState(1500)

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
    <div className="mt-8 space-y-8 rounded-xl border border-border bg-card p-6 shadow-sm">
      <div className="grid gap-6 sm:grid-cols-2">
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Home price</span>
          <Input
            type="number"
            value={homePrice}
            onChange={(e) => setHomePrice(Number(e.target.value) || 0)}
            min={50000}
            step={10000}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground"
          />
        </Label>
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Down payment (%)</span>
          <Input
            type="number"
            value={downPaymentPct}
            onChange={(e) => setDownPaymentPct(Number(e.target.value) || 0)}
            min={0}
            max={100}
            step={1}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground"
          />
        </Label>
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Interest rate (%)</span>
          <Input
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
            min={0}
            max={20}
            step={0.125}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground"
          />
        </Label>
        <Label className="block">
          <span className="text-sm font-medium text-muted-foreground">Loan term (years)</span>
          <Select value={String(loanTermYears)} onValueChange={(e) => setLoanTermYears(Number(e))}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="10">10</SelectItem>
              <SelectItem value="15">15</SelectItem>
              <SelectItem value="20">20</SelectItem>
              <SelectItem value="30">30</SelectItem>
            </SelectContent>
          </Select>
        </Label>
        <Label className="block sm:col-span-2">
          <span className="text-sm font-medium text-muted-foreground">Property tax (yearly, optional)</span>
          <Input
            type="number"
            value={propertyTaxYear}
            onChange={(e) => setPropertyTaxYear(Number(e.target.value) || 0)}
            min={0}
            step={500}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground"
          />
        </Label>
        <Label className="block sm:col-span-2">
          <span className="text-sm font-medium text-muted-foreground">Home insurance (yearly, optional)</span>
          <Input
            type="number"
            value={insuranceYear}
            onChange={(e) => setInsuranceYear(Number(e.target.value) || 0)}
            min={0}
            step={100}
            className="mt-1 w-full rounded-lg border border-border px-3 py-2 text-foreground"
          />
        </Label>
      </div>

      <div className="border-t border-border pt-6">
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
          <span>Principal & interest: {formatCurrency(monthlyPrincipalInterest)}</span>
          <span>Tax: {formatCurrency(monthlyTax)}</span>
          <span>Insurance: {formatCurrency(monthlyInsurance)}</span>
        </div>
      </div>
    </div>
  )
}
