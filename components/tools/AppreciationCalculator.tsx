'use client'

import { useMemo, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

function currency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

// Named constant so the stale-rate risk is visible and easy to update.
// No app_config key covers appreciation rate — this is a historical-average
// scenario default, not a live market rate.
const DEFAULT_APPRECIATION_RATE_PCT = 4.5

type Props = {
  /** Override the default annual appreciation rate. Useful if a future
   *  app_config key is added (e.g. "local_appreciation_rate_pct"). */
  initialAnnualRate?: number
}

export default function AppreciationCalculator({ initialAnnualRate }: Props) {
  const [purchasePrice, setPurchasePrice] = useState('550000')
  const [annualRate, setAnnualRate] = useState(
    String(
      initialAnnualRate != null && initialAnnualRate > 0
        ? initialAnnualRate
        : DEFAULT_APPRECIATION_RATE_PCT
    )
  )
  const [yearsHeld, setYearsHeld] = useState('5')

  const result = useMemo(() => {
    const price = Number(purchasePrice)
    const rate = Number(annualRate)
    const years = Number(yearsHeld)
    if (!Number.isFinite(price) || !Number.isFinite(rate) || !Number.isFinite(years) || price <= 0 || years <= 0) {
      return null
    }
    const future = price * Math.pow(1 + rate / 100, years)
    const gain = future - price
    return { future, gain }
  }, [purchasePrice, annualRate, yearsHeld])

  return (
    <Card>
      <CardHeader>
        <CardTitle>Home appreciation calculator</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="purchase-price">Purchase price</Label>
            <Input
              id="purchase-price"
              inputMode="numeric"
              value={purchasePrice}
              onChange={(event) => setPurchasePrice(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="annual-rate">Annual appreciation rate (%)</Label>
            <Input
              id="annual-rate"
              inputMode="decimal"
              value={annualRate}
              onChange={(event) => setAnnualRate(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="years-held">Years held</Label>
            <Input
              id="years-held"
              inputMode="numeric"
              value={yearsHeld}
              onChange={(event) => setYearsHeld(event.target.value)}
            />
          </div>
        </div>
        <div className="rounded-lg border border-border p-4">
          {result ? (
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Estimated future value</p>
              <p className="text-2xl font-semibold text-foreground">{currency(result.future)}</p>
              <p className="text-sm text-muted-foreground">Estimated appreciation gain {currency(result.gain)}</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Enter valid inputs to calculate projected value.</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
