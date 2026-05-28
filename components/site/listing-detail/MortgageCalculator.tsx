'use client'

import { useMemo, useState } from 'react'
import {
  Body,
  Eyebrow,
  H2,
  Price,
  Stack,
  TabularNumber,
} from '@/components/site/primitives'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

/**
 * Listing-detail MortgageCalculator — fresh interactive island. Given
 * the list price, down payment %, rate, and term, returns the monthly
 * principal-and-interest payment plus a rough taxes + insurance
 * estimate so a buyer can see the all-in PITI on this specific listing.
 *
 * Defaults:
 *   - listPrice from the listing
 *   - downPaymentPct = 20
 *   - ratePct = 7.0 (rough current 30-yr conventional; user can change)
 *   - termYears = 30
 *
 * Tax estimate uses the listing's taxAnnualAmount when known; otherwise
 * a Central Oregon county-effective default of 0.85% of value (assessed
 * value runs ~80% of market in Deschutes County). Insurance estimate
 * uses $1,000/yr per $300k of value as a rough catch-all.
 *
 * Per CLAUDE.md §0 Data Accuracy: the calculator is explicitly labeled
 * as an estimate so the user knows it's not a quote. Real quotes come
 * from a lender.
 *
 * Per plan §9 Layer 4.
 */

type Props = {
  listPrice: number | null
  taxAnnualAmount?: number | null
  className?: string
}

const DEFAULT_RATE_PCT = 7.0
const DEFAULT_DOWN_PCT = 20
const DEFAULT_TERM_YEARS = 30
const TAX_FALLBACK_PCT = 0.85
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

function parsePercent(raw: string): number {
  const n = parseFloat(raw.replace(/[^\d.]/g, ''))
  return Number.isFinite(n) ? n : 0
}

export function MortgageCalculator({ listPrice, taxAnnualAmount, className }: Props) {
  const [priceInput, setPriceInput] = useState(listPrice ? String(listPrice) : '')
  const [downPctInput, setDownPctInput] = useState(String(DEFAULT_DOWN_PCT))
  const [rateInput, setRateInput] = useState(String(DEFAULT_RATE_PCT))
  const [termInput, setTermInput] = useState(String(DEFAULT_TERM_YEARS))

  const result = useMemo(() => {
    const price = parseCurrency(priceInput)
    const downPct = parsePercent(downPctInput)
    const ratePct = parsePercent(rateInput)
    const termYears = Math.max(1, Math.round(parsePercent(termInput)))
    const down = price * (downPct / 100)
    const principal = Math.max(0, price - down)
    const pi = monthlyPI(principal, ratePct, termYears)
    const taxesPerYear = taxAnnualAmount ?? price * (TAX_FALLBACK_PCT / 100)
    const insurancePerYear = (price / 300_000) * INSURANCE_PER_300K
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
  }, [priceInput, downPctInput, rateInput, termInput, taxAnnualAmount])

  return (
    <Stack gap="default" className={className}>
      <div>
        <Eyebrow>Estimate</Eyebrow>
        <H2 className="mt-1.5">Monthly payment estimate</H2>
        <Body size="small" tone="muted" className="mt-1.5">
          A rough estimate, not a quote. A real number comes from a lender.
        </Body>
      </div>

      <div className="bg-card border border-border rounded-[14px] p-5 grid gap-3">
        <Field label="Home price" id="mc-price">
          <Input
            id="mc-price"
            type="text"
            inputMode="decimal"
            value={priceInput}
            onChange={(e) => setPriceInput(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Down payment %" id="mc-down">
            <Input
              id="mc-down"
              type="text"
              inputMode="decimal"
              value={downPctInput}
              onChange={(e) => setDownPctInput(e.target.value)}
            />
          </Field>
          <Field label="Rate %" id="mc-rate">
            <Input
              id="mc-rate"
              type="text"
              inputMode="decimal"
              value={rateInput}
              onChange={(e) => setRateInput(e.target.value)}
            />
          </Field>
        </div>
        <Field label="Term (years)" id="mc-term">
          <Input
            id="mc-term"
            type="text"
            inputMode="numeric"
            value={termInput}
            onChange={(e) => setTermInput(e.target.value)}
          />
        </Field>
      </div>

      <div className="bg-muted border border-border rounded-[14px] p-5 grid gap-2">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Principal + interest</span>
          <span className="text-sm font-semibold text-foreground">
            <Price value={Math.round(result.pi)} />/mo
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Property taxes</span>
          <span className="text-sm font-semibold text-foreground">
            <Price value={Math.round(result.taxesMonthly)} />/mo
          </span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Homeowners insurance</span>
          <span className="text-sm font-semibold text-foreground">
            <Price value={Math.round(result.insuranceMonthly)} />/mo
          </span>
        </div>
        <div className="border-t border-border mt-2 pt-2 flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">Total monthly (PITI)</span>
          <span className="text-base font-bold text-foreground">
            <Price value={Math.round(result.piti)} />
          </span>
        </div>
        <Body size="small" tone="muted" className="mt-2">
          Loan amount <Price value={Math.round(result.principal)} /> ·{' '}
          <TabularNumber value={result.down ? Math.round(result.down) : 0} /> down ·{' '}
          {termInput} year term
        </Body>
      </div>
    </Stack>
  )
}

function Field({
  label,
  id,
  children,
}: {
  label: string
  id: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  )
}
