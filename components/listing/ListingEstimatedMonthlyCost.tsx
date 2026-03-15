'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { estimatedMonthlyPayment, formatMonthlyPayment } from '@/lib/mortgage'
import { setBuyingPreferences } from '@/app/actions/buying-preferences'
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

type DisplayPrefs = {
  downPaymentPercent: number
  interestRate: number
  loanTermYears: number
}

type Props = {
  listPrice: number
  initialPrefs: DisplayPrefs
  signedIn: boolean
}

export default function ListingEstimatedMonthlyCost({ listPrice, initialPrefs, signedIn }: Props) {
  const router = useRouter()
  const [expanded, setExpanded] = useState(false)
  const [downPct, setDownPct] = useState(initialPrefs.downPaymentPercent)
  const [rate, setRate] = useState(initialPrefs.interestRate)
  const [termYears, setTermYears] = useState(initialPrefs.loanTermYears)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState<'saved' | 'error' | null>(null)

  const monthlyPayment = useMemo(() => {
    if (listPrice <= 0) return null
    return estimatedMonthlyPayment(listPrice, downPct, rate, termYears)
  }, [listPrice, downPct, rate, termYears])

  async function handleSaveToProfile() {
    setSaving(true)
    setSaveMsg(null)
    const { error } = await setBuyingPreferences({
      downPaymentPercent: downPct,
      interestRate: rate,
      loanTermYears: termYears,
    })
    setSaving(false)
    setSaveMsg(error ? 'error' : 'saved')
    if (!error) router.refresh()
  }

  if (listPrice <= 0) {
    return (
      <section className="mb-8 rounded-lg border border-border bg-card p-6 shadow-sm" aria-labelledby="estimated-monthly-cost-heading">
        <h2 id="estimated-monthly-cost-heading" className="text-lg font-semibold text-foreground">Estimated monthly cost</h2>
        <p className="mt-2 text-muted-foreground">List price not set.</p>
      </section>
    )
  }

  return (
    <section className="mb-8 rounded-lg border border-border bg-card p-6 shadow-sm" aria-labelledby="estimated-monthly-cost-heading">
      <h2 id="estimated-monthly-cost-heading" className="mb-3 text-lg font-semibold text-foreground">Estimated monthly cost</h2>
      <p className="text-2xl font-semibold text-foreground">
        {monthlyPayment != null && monthlyPayment > 0 ? `Est. ${formatMonthlyPayment(monthlyPayment)}/mo` : 'â€”'}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">Principal & interest. Adjust below or use the calculator.</p>

      <Button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-3 flex items-center gap-2 font-medium text-primary hover:text-accent-foreground hover:underline"
        aria-expanded={expanded}
        aria-controls="listing-mortgage-calculator"
      >
        <span className="inline-block transition-transform duration-200" style={{ transform: expanded ? 'rotate(90deg)' : 'none' }}>â–¶</span>
        Mortgage Calculator
      </Button>

      <div
        id="listing-mortgage-calculator"
        role="region"
        aria-labelledby="estimated-monthly-cost-heading"
        className="overflow-hidden transition-[max-height] duration-200 ease-out"
        style={{ maxHeight: expanded ? '800px' : '0' }}
      >
        {expanded && (
          <div className="mt-4 space-y-4 border-t border-border pt-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Down payment %</span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={downPct}
                  onChange={(e) => setDownPct(Number(e.target.value) || 0)}
                  className="rounded-lg border border-border px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Label>
              <Label className="flex flex-col gap-1">
                <span className="text-sm font-medium text-muted-foreground">Interest rate %</span>
                <Input
                  type="number"
                  min={0}
                  max={20}
                  step={0.125}
                  value={rate}
                  onChange={(e) => setRate(Number(e.target.value) || 0)}
                  className="rounded-lg border border-border px-3 py-2 text-foreground focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </Label>
            </div>
            <div>
              <span className="block text-sm font-medium text-muted-foreground mb-2">Loan term</span>
              <div className="flex flex-wrap gap-2">
                {([10, 15, 20, 30] as const).map((term) => (
                  <Button
                    key={term}
                    type="button"
                    onClick={() => setTermYears(term)}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
                      termYears === term
                        ? 'border-accent bg-accent/10 text-primary'
                        : 'border-border text-muted-foreground hover:border-border'
                    }`}
                  >
                    {term} yr
                  </Button>
                ))}
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Est. payment: <strong className="text-foreground">{monthlyPayment != null ? formatMonthlyPayment(monthlyPayment) : 'â€”'}</strong>/mo (principal & interest)
            </p>
            {signedIn && (
              <div className="flex items-center gap-3">
                <Button
                  type="button"
                  onClick={handleSaveToProfile}
                  disabled={saving}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                >
                  {saving ? 'Savingâ€¦' : 'Save to my profile'}
                </Button>
                {saveMsg === 'saved' && <span className="text-sm text-success">Saved to your buying preferences.</span>}
                {saveMsg === 'error' && <span className="text-sm text-destructive">Could not save.</span>}
              </div>
            )}
            {!signedIn && (
              <p className="text-sm text-muted-foreground">Sign in to save these numbers to your profile and see estimated payments on other listings.</p>
            )}
          </div>
        )}
      </div>
    </section>
  )
}
