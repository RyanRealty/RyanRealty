'use client'

/**
 * Lazy wrapper around CentralOregonSalesChart. Defers recharts (~100KB
 * gzipped) until the homepage's market snapshot section is actually
 * scrolled into view. Without this lazy boundary, every cold homepage
 * visit ships recharts even though most visitors never reach the chart
 * (SITE_SPEC line 50 initial bundle budget).
 */
import dynamic from 'next/dynamic'
import type { ComponentProps } from 'react'
import type CentralOregonSalesChart from '@/components/home/CentralOregonSalesChart'

const CentralOregonSalesChartClient = dynamic(
  () => import('@/components/home/CentralOregonSalesChart'),
  {
    ssr: false,
    loading: () => (
      <div
        className="flex w-full items-center justify-center bg-muted/40 text-sm text-muted-foreground"
        style={{ minHeight: '320px' }}
      >
        Loading chart…
      </div>
    ),
  }
)

export default function LazyCentralOregonSalesChart(
  props: ComponentProps<typeof CentralOregonSalesChart>,
) {
  return <CentralOregonSalesChartClient {...props} />
}
