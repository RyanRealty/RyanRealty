'use client'

import { useState, useMemo } from 'react'
import { trackEvent } from '@/lib/tracking'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type Props = {
  listPrice: number
  taxAmount?: number
  associationFee?: number
}

const DEFAULT_RATE = 6.5
const INSURANCE_RATE = 0.0035

export default function PaymentCalculator({ listPrice, taxAmount, associationFee }: Props) {
  const [price, setPrice] = useState(listPrice)
  const [downPct, setDownPct] = useState(20)
  const [rate, setRate] = useState(DEFAULT_RATE)
  const [termYears, setTermYears] = useState(30)

  const { monthlyPandI, monthlyTax, monthlyHoa, monthlyInsurance, total } = useMemo(() => {
    const principal = price * (1 - downPct / 100)
    const monthlyRate = rate / 100 / 12
    const numPayments = termYears * 12
    const monthlyPandI =
      monthlyRate > 0
        ? (principal * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) /
          (Math.pow(1 + monthlyRate, numPayments) - 1)
        : principal / numPayments
    const monthlyTax = (taxAmount ?? 0) / 12
    const monthlyHoa = associationFee ?? 0
    const monthlyInsurance = (price * INSURANCE_RATE) / 12
    return {
      monthlyPandI,
      monthlyTax,
      monthlyHoa,
      monthlyInsurance,
      total: monthlyPandI + monthlyTax + monthlyHoa + monthlyInsurance,
    }
  }, [price, downPct, rate, termYears, taxAmount, associationFee])

  const handleInteract = () => {
    trackEvent('calculator_used', { listing_price: price, down_pct: downPct, rate, term_years: termYears })
    trackEvent('calculator_interact', { listing_price: price })
  }

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold text-primary">Estimated Monthly Payment</h2>
      <p className="text-3xl font-bold text-accent-foreground">
        ${total.toLocaleString('en-US', { maximumFractionDigits: 0 })}
        <span className="text-lg font-normal text-muted-foreground">/mo</span>
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
        <Label className="flex flex-col gap-1">
          <span className="text-primary">Purchase price</span>
          <Input
            type="number"
            value={price}
            onChange={(e) => { setPrice(Number(e.target.value) || 0); handleInteract() }}
            className="rounded-lg border border-border px-3 py-2 text-primary"
          />
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-primary">Down payment %</span>
          <Input
            type="number"
            min={0}
            max={100}
            value={downPct}
            onChange={(e) => { setDownPct(Number(e.target.value) || 0); handleInteract() }}
            className="rounded-lg border border-border px-3 py-2 text-primary"
          />
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-primary">Interest rate %</span>
          <Input
            type="number"
            step={0.1}
            value={rate}
            onChange={(e) => { setRate(Number(e.target.value) || 0); handleInteract() }}
            className="rounded-lg border border-border px-3 py-2 text-primary"
          />
        </Label>
        <Label className="flex flex-col gap-1">
          <span className="text-primary">Loan term</span>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => { setTermYears(30); handleInteract() }}
              className={`flex-1 rounded-lg border px-3 py-2 ${termYears === 30 ? 'border-accent bg-accent/10 text-primary' : 'border-border text-muted-foreground'}`}
            >
              30 yr
            </Button>
            <Button
              type="button"
              onClick={() => { setTermYears(15); handleInteract() }}
              className={`flex-1 rounded-lg border px-3 py-2 ${termYears === 15 ? 'border-accent bg-accent/10 text-primary' : 'border-border text-muted-foreground'}`}
            >
              15 yr
            </Button>
          </div>
        </Label>
      </div>
      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Principal & Interest</span>
          <span className="text-primary">${monthlyPandI.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Property Tax</span>
          <span className="text-primary">${monthlyTax.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
        {monthlyHoa > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">HOA</span>
            <span className="text-primary">${monthlyHoa.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Home Insurance</span>
          <span className="text-primary">${monthlyInsurance.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
        </div>
      </div>
      <div className="h-3 flex rounded-full overflow-hidden bg-border" role="presentation">
        <div
          className="bg-accent"
          style={{ width: `${(monthlyPandI / total) * 100}%` }}
        />
        <div
          className="bg-primary"
          style={{ width: `${(monthlyTax / total) * 100}%` }}
        />
        {monthlyHoa > 0 && (
          <div
            className="bg-muted-foreground"
            style={{ width: `${(monthlyHoa / total) * 100}%` }}
          />
        )}
        <div
          className="bg-muted-foreground"
          style={{ width: `${(monthlyInsurance / total) * 100}%` }}
        />
      </div>
    </section>
  )
}
