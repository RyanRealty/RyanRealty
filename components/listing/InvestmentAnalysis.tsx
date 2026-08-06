'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

export type InvestmentMetrics = {
  /** Estimated monthly rental income */
  estimatedMonthlyRent: number | null
  /** Estimated annual rental income */
  estimatedAnnualRent: number | null
  /** Cap rate (annual rent / price × 100) */
  capRate: number | null
  /** Estimated 5-year appreciation percentage */
  fiveYearAppreciation: number | null
  /** Estimated future value in 5 years */
  estimatedFutureValue: number | null
  /** Whether the property allows short-term rentals */
  strAllowed: boolean | null
  /** Data source description */
  source: string
}

type Props = {
  metrics: InvestmentMetrics | null
  listPrice: number
  className?: string
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—'
  return `$${value.toLocaleString()}`
}

/**
 * InvestmentAnalysis — shows investment potential for applicable properties.
 *
 * Displays:
 * - Estimated rental income (monthly/annual)
 * - Cap rate
 * - 5-year appreciation forecast
 * - STR eligibility
 *
 * Only shown for properties where investment analysis is relevant
 * (not primary residences in HOA-restricted areas).
 */
export default function InvestmentAnalysis({ metrics, className }: Props) {
  if (!metrics) return null
  if (!metrics.estimatedMonthlyRent && !metrics.fiveYearAppreciation) return null

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Investment potential</h3>
          {metrics.strAllowed != null && (
            <Badge variant={metrics.strAllowed ? 'default' : 'outline'} className="text-xs">
              {metrics.strAllowed ? 'STR Eligible' : 'Long-Term Only'}
            </Badge>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          {metrics.estimatedMonthlyRent != null && (
            <div>
              <p className="text-xs text-muted-foreground">Est. Monthly Rent</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(metrics.estimatedMonthlyRent)}</p>
            </div>
          )}

          {metrics.estimatedAnnualRent != null && (
            <div>
              <p className="text-xs text-muted-foreground">Est. Annual Income</p>
              <p className="text-lg font-bold text-foreground">{formatCurrency(metrics.estimatedAnnualRent)}</p>
            </div>
          )}

          {metrics.capRate != null && (
            <div>
              <p className="text-xs text-muted-foreground">Cap Rate</p>
              <p className="text-lg font-bold text-foreground">{metrics.capRate.toFixed(1)}%</p>
            </div>
          )}

          {metrics.fiveYearAppreciation != null && (
            <div>
              <p className="text-xs text-muted-foreground">5-Year Appreciation</p>
              <p className="text-lg font-bold text-success">+{metrics.fiveYearAppreciation.toFixed(1)}%</p>
              {metrics.estimatedFutureValue != null && (
                <p className="text-xs text-muted-foreground">
                  Est. value: {formatCurrency(metrics.estimatedFutureValue)}
                </p>
              )}
            </div>
          )}
        </div>

        <p className="mt-3 text-[10px] text-muted-foreground">
          Estimates are for informational purposes only. Based on {metrics.source}.
          Consult a financial advisor before making investment decisions.
        </p>
      </CardContent>
    </Card>
  )
}
