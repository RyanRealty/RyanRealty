'use client'

import { useState, useMemo } from 'react'

function formatCurrency(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

type Props = { initialHomePrice?: number }

export default function MortgageCalculator({ initialHomePrice }: Props) {
  const [homePrice, setHomePrice] = useState(initialHomePrice && initialHomePrice > 0 ? initialHomePrice : 500000)
  const [downPaymentPct, setDownPaymentPct] = useState(20)
  const [interestRate, setInterestRate] = useState(7)
  const [loanTermYears, setLoanTermYears] = useState(30)
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
    <div className="mt-8 space-y-8 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="grid gap-6 sm:grid-cols-2">
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Home price</span>
          <input
            type="number"
            value={homePrice}
            onChange={(e) => setHomePrice(Number(e.target.value) || 0)}
            min={50000}
            step={10000}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Down payment (%)</span>
          <input
            type="number"
            value={downPaymentPct}
            onChange={(e) => setDownPaymentPct(Number(e.target.value) || 0)}
            min={0}
            max={100}
            step={1}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Interest rate (%)</span>
          <input
            type="number"
            value={interestRate}
            onChange={(e) => setInterestRate(Number(e.target.value) || 0)}
            min={0}
            max={20}
            step={0.125}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        <label className="block">
          <span className="text-sm font-medium text-zinc-700">Loan term (years)</span>
          <select
            value={loanTermYears}
            onChange={(e) => setLoanTermYears(Number(e.target.value))}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          >
            <option value={10}>10</option>
            <option value={15}>15</option>
            <option value={20}>20</option>
            <option value={30}>30</option>
          </select>
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Property tax (yearly, optional)</span>
          <input
            type="number"
            value={propertyTaxYear}
            onChange={(e) => setPropertyTaxYear(Number(e.target.value) || 0)}
            min={0}
            step={500}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
        <label className="block sm:col-span-2">
          <span className="text-sm font-medium text-zinc-700">Home insurance (yearly, optional)</span>
          <input
            type="number"
            value={insuranceYear}
            onChange={(e) => setInsuranceYear(Number(e.target.value) || 0)}
            min={0}
            step={100}
            className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-zinc-900"
          />
        </label>
      </div>

      <div className="border-t border-zinc-200 pt-6">
        <p className="text-sm text-zinc-500">
          Down payment: {formatCurrency(downPayment)} · Loan amount: {formatCurrency(loanAmount)}
          {pmi > 0 && (
            <span className="ml-2 text-amber-600">· PMI (est.): {formatCurrency(pmi)}/mo</span>
          )}
        </p>
        <p className="mt-4 text-3xl font-bold text-zinc-900">
          {formatCurrency(monthlyTotal)}
          <span className="text-lg font-normal text-zinc-500">/month</span>
        </p>
        <div className="mt-2 flex flex-wrap gap-4 text-sm text-zinc-600">
          <span>Principal & interest: {formatCurrency(monthlyPrincipalInterest)}</span>
          <span>Tax: {formatCurrency(monthlyTax)}</span>
          <span>Insurance: {formatCurrency(monthlyInsurance)}</span>
        </div>
      </div>
    </div>
  )
}
