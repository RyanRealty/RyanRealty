'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type MarketTrend = {
  /** What's being measured */
  metric: string
  /** Current value */
  currentValue: string
  /** Direction: up, down, flat */
  direction: 'up' | 'down' | 'flat'
  /** Percentage change (YoY or period-over-period) */
  changePercent: number
  /** Comparison context */
  context: string
  /** AI-generated insight */
  insight: string
}

type Props = {
  trends: MarketTrend[]
  /** Geography label (e.g., "Bend", "Central Oregon") */
  area: string
  /** Period label (e.g., "Last 12 months") */
  period?: string
  className?: string
}

/**
 * PredictiveInsights — AI-powered forward-looking market commentary.
 *
 * Displays trend direction, velocity, and AI-generated insights
 * based on real historical data. Not speculation — data-grounded predictions.
 *
 * Example: "Bend prices trending up 8% YoY, faster than the regional average.
 * At this pace, the median home will reach $625K by end of year."
 */
export default function PredictiveInsights({ trends, area, period, className }: Props) {
  if (!trends || trends.length === 0) return null

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">Market Insights: {area}</h3>
            {period && <p className="text-xs text-muted-foreground">{period}</p>}
          </div>
          <Badge variant="secondary" className="text-xs">AI Analysis</Badge>
        </div>

        <div className="mt-4 space-y-4">
          {trends.map((trend, i) => (
            <div key={i} className="border-l-2 border-border pl-3">
              <div className="flex items-center gap-2">
                <span className={cn(
                  'text-sm font-bold',
                  trend.direction === 'up' && 'text-success',
                  trend.direction === 'down' && 'text-destructive',
                  trend.direction === 'flat' && 'text-muted-foreground',
                )}>
                  {trend.direction === 'up' ? '↑' : trend.direction === 'down' ? '↓' : '→'}
                  {' '}{Math.abs(trend.changePercent).toFixed(1)}%
                </span>
                <span className="text-sm font-medium text-foreground">{trend.metric}</span>
                <span className="text-xs text-muted-foreground">({trend.currentValue})</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{trend.insight}</p>
              <p className="mt-0.5 text-xs text-muted-foreground/70">{trend.context}</p>
            </div>
          ))}
        </div>

        <p className="mt-4 text-[10px] text-muted-foreground">
          Insights are generated from historical market data and should not be considered financial advice.
          Past performance does not guarantee future results.
        </p>
      </CardContent>
    </Card>
  )
}
