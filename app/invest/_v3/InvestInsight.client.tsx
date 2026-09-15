'use client'

/**
 * beautifului-insight on /invest — InsightPager + V3Chart year pages +
 * chart scrubber. Source: components/motion/insight-pager. Navy/cream paint
 * is V3Chart tokens only. Do not rebuild a KPI cream box around the pager.
 */
import { InsightPager } from '@/components/motion/insight-pager'
import { V3Chart, type V3ChartProps } from '@/components/site/v3'

export { InsightPager }

export function InvestInsight(props: V3ChartProps) {
  return <V3Chart {...props} yearPages keysToggle hover restingRead="last" marks />
}
