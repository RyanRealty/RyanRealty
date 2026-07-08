'use client'

import { useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import RentalLeadForm from '@/components/tools/RentalLeadForm'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { cn } from '@/lib/utils'
import { analyzeRental, formatUSD, formatPct, type RentalAnalysisInputs } from '@/lib/rental-analysis'

const EquityProjectionChart = dynamic(() => import('./EquityProjectionChart.client'), {
  ssr: false,
  loading: () => <div aria-hidden className="h-[260px] rounded-[14px] border border-border bg-card animate-pulse" />,
})

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

/** Small "?" glossary affordance. */
function Glossary({ children }: { children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label="What is this?"
          className="ml-1 inline-flex size-4 items-center justify-center rounded-full border border-border text-[10px] leading-none text-muted-foreground hover:bg-secondary"
        >
          ?
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-[240px] text-pretty">{children}</TooltipContent>
    </Tooltip>
  )
}

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
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center text-sm">
        {label}
      </Label>
      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {prefix}
          </span>
        )}
        <Input
          id={id}
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : 0}
          onChange={(e) => onChange(num(e.target.value))}
          min={min}
          step={step}
          className={cn('tabular-nums', prefix && 'pl-7', suffix && 'pr-10')}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function KpiTile({
  label,
  value,
  glossary,
  tone = 'default',
}: {
  label: string
  value: string
  glossary?: React.ReactNode
  tone?: 'default' | 'positive' | 'negative'
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
        {glossary && <Glossary>{glossary}</Glossary>}
      </div>
      {/* clamp instead of a fixed text-2xl: the widest state (negative
          five-figure + "/mo") overflowed the tile at a fixed size and read as
          clipped (design-audit P3). */}
      <div
        className={cn(
          'mt-1 font-semibold tabular-nums break-words',
          'text-[clamp(1.15rem,5vw,1.5rem)]',
          tone === 'positive' && 'text-success',
          tone === 'negative' && 'text-destructive',
          tone === 'default' && 'text-foreground'
        )}
      >
        {value}
      </div>
    </div>
  )
}

function FlowRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={cn('flex items-center justify-between py-1.5 text-sm', strong && 'font-semibold')}>
      <span className={cn(strong ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  )
}

export default function RentalCalculator({
  initialPrice,
  initialRent,
  initialPropertyTaxesYear,
  initialDownPaymentPct,
  initialInterestRate,
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
      : roundTo(price0 * 0.0075, 50)
  )
  const [insuranceYear, setInsuranceYear] = useState(1400)
  const [mgmtPct, setMgmtPct] = useState(8)
  const [maintPct, setMaintPct] = useState(5)
  const [capexPct, setCapexPct] = useState(5)
  const [hoaMonthly, setHoaMonthly] = useState(0)

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
    <TooltipProvider delayDuration={150}>
      <Card>
        {!embedded && (
          <CardHeader>
            <CardTitle>Rental property calculator</CardTitle>
            {propertyLabel && <p className="text-sm text-muted-foreground">{propertyLabel}</p>}
          </CardHeader>
        )}
        <CardContent className={cn('grid gap-8 lg:grid-cols-5', embedded && 'pt-6')}>
          {/* ── Inputs ───────────────────────────────────────────── */}
          <div className="space-y-6 lg:col-span-3">
            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Purchase &amp; financing</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="price" label="Purchase price" prefix="$" step={5000} min={0} value={purchasePrice} onChange={setPurchasePrice} />
                <NumberField id="rehab" label="Rehab budget (optional)" prefix="$" step={1000} min={0} value={rehabCost} onChange={setRehabCost} />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="down" className="text-sm">Down payment</Label>
                  <span className="text-sm tabular-nums text-muted-foreground">
                    {downPaymentPct}% &middot; {formatUSD(downPayment)}
                  </span>
                </div>
                <Slider
                  id="down"
                  aria-label="Down payment percent"
                  value={[downPaymentPct]}
                  onValueChange={(v) => setDownPaymentPct(v[0] ?? 0)}
                  min={0}
                  max={50}
                  step={1}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="rate" label="Interest rate" suffix="%" step={0.125} min={0} value={interestRate} onChange={setInterestRate} />
                <div className="space-y-1.5">
                  <Label htmlFor="term" className="text-sm">Loan term</Label>
                  <Select value={String(loanTermYears)} onValueChange={(v) => setLoanTermYears(Number(v))}>
                    <SelectTrigger id="term"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 years</SelectItem>
                      <SelectItem value="20">20 years</SelectItem>
                      <SelectItem value="30">30 years</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Income</h3>
              <div className="grid gap-4 sm:grid-cols-2">
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
                            ? ` (${formatUSD(rentEstimate.low)}–${formatUSD(rentEstimate.high)})`
                            : ''
                        }${rentEstimate.source ? ` · ${rentEstimate.source}` : ''}. Edit to your own number.`
                      : 'Your expected market rent. Edit to your own number.'
                  }
                />
                <NumberField id="vacancy" label="Vacancy" suffix="%" step={0.5} min={0} value={vacancyPct} onChange={setVacancyPct} />
              </div>
            </section>

            <section className="space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Operating expenses</h3>
              <div className="grid gap-4 sm:grid-cols-2">
                <NumberField id="taxes" label="Property taxes (yearly)" prefix="$" step={50} min={0} value={propertyTaxesYear} onChange={setPropertyTaxesYear} />
                <NumberField id="insurance" label="Insurance (yearly)" prefix="$" step={50} min={0} value={insuranceYear} onChange={setInsuranceYear} />
                <NumberField id="mgmt" label="Management (% of rent)" suffix="%" step={0.5} min={0} value={mgmtPct} onChange={setMgmtPct} />
                <NumberField id="maint" label="Maintenance (% of rent)" suffix="%" step={0.5} min={0} value={maintPct} onChange={setMaintPct} />
                <NumberField id="capex" label="Capital reserves (% of rent)" suffix="%" step={0.5} min={0} value={capexPct} onChange={setCapexPct} />
                <NumberField id="hoa" label="HOA (monthly)" prefix="$" step={10} min={0} value={hoaMonthly} onChange={setHoaMonthly} />
              </div>
            </section>

            <Accordion type="single" collapsible>
              <AccordionItem value="assumptions" className="border-b-0">
                <AccordionTrigger className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  Long-term assumptions
                </AccordionTrigger>
                <AccordionContent>
                  <div className="grid gap-4 sm:grid-cols-3">
                    <NumberField id="appr" label="Appreciation / yr" suffix="%" step={0.5} min={0} value={appreciationPct} onChange={setAppreciationPct} />
                    <NumberField id="rentgrow" label="Rent growth / yr" suffix="%" step={0.5} min={0} value={rentGrowthPct} onChange={setRentGrowthPct} />
                    <NumberField id="expgrow" label="Expense growth / yr" suffix="%" step={0.5} min={0} value={expenseGrowthPct} onChange={setExpenseGrowthPct} />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* ── Results ──────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="space-y-5 lg:sticky lg:top-24">
              <div className="grid grid-cols-2 gap-3">
                <KpiTile
                  label="Cash flow"
                  value={`${formatUSD(result.cashFlowMonthly)}/mo`}
                  tone={cashFlowPositive ? 'positive' : 'negative'}
                  glossary="Money left each month after the mortgage, taxes, insurance, management, and reserves are paid."
                />
                <KpiTile
                  label="Cap rate"
                  value={formatPct(result.capRatePurchase)}
                  glossary="Net operating income divided by purchase price. A price-independent yardstick of yield."
                />
                <KpiTile
                  label="Cash on cash"
                  value={formatPct(result.cashOnCash)}
                  glossary="Annual cash flow divided by the cash you put in (down payment, closing, rehab)."
                />
                <KpiTile
                  label="Cash needed"
                  value={formatUSD(result.totalCashNeeded)}
                  glossary="Down payment plus cash closing costs plus rehab budget."
                />
              </div>

              <p className="text-sm text-pretty text-foreground">{verdict}</p>

              <div className="rounded-xl border border-border bg-card p-4">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Monthly cash flow
                </div>
                <div className="mt-1 divide-y divide-border">
                  <FlowRow label="Gross rent" value={formatUSD(result.grossRentMonthly)} />
                  <FlowRow label={`Vacancy (${vacancyPct}%)`} value={`- ${formatUSD(result.vacancyAnnual / 12)}`} />
                  <FlowRow label="Operating income" value={formatUSD(result.operatingIncomeAnnual / 12)} strong />
                  <FlowRow label="Operating expenses" value={`- ${formatUSD(result.operatingExpensesMonthly)}`} />
                  <FlowRow label="Net operating income" value={formatUSD(result.noiMonthly)} strong />
                  <FlowRow label="Loan payment" value={`- ${formatUSD(result.monthlyDebtService)}`} />
                  <FlowRow label="Cash flow" value={formatUSD(result.cashFlowMonthly)} strong />
                </div>
              </div>

              <Accordion type="single" collapsible>
                <AccordionItem value="projection" className="border-b-0">
                  <AccordionTrigger className="text-sm font-medium">Show 30-year projection</AccordionTrigger>
                  <AccordionContent>
                    <div className="space-y-4">
                      <EquityProjectionChart projection={result.projection} />
                      <div className="overflow-hidden rounded-xl border border-border">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Year</TableHead>
                              <TableHead className="text-right">Value</TableHead>
                              <TableHead className="text-right">Equity</TableHead>
                              <TableHead className="text-right">Cash flow</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody className="tabular-nums">
                            {milestones.map((p) => (
                              <TableRow key={p.year}>
                                <TableCell>{p.year}</TableCell>
                                <TableCell className="text-right">{formatUSD(p.propertyValue)}</TableCell>
                                <TableCell className="text-right">{formatUSD(p.equity)}</TableCell>
                                <TableCell className="text-right">{formatUSD(p.cashFlow)}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <Separator />

              <div className="space-y-3">
                <RentalLeadForm
                  propertyLabel={propertyLabel}
                  contextNote={`${formatUSD(purchasePrice)} · cash flow ${formatUSD(result.cashFlowMonthly)}/mo · cap rate ${formatPct(result.capRatePurchase)}`}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleDownloadPdf}
                  disabled={downloading}
                >
                  {downloading ? 'Preparing report…' : 'Download PDF report'}
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/homes-for-sale">Browse homes for sale</Link>
                </Button>
              </div>

              <p className="text-xs text-muted-foreground text-pretty">
                Estimates only, not investment advice or a guarantee of rent, value, or return. Figures depend on the
                numbers you enter and current market conditions. Verify with your lender, tax advisor, and a Ryan Realty
                broker before you rely on them.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </TooltipProvider>
  )
}
