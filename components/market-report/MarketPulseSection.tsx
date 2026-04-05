import { getMarketReportData } from '@/app/actions/market-report'
import MarketPulseCarousel from '@/components/market-report/MarketPulseCarousel'

type Props = {
  className?: string
}

async function withTimeout<T>(promise: Promise<T>, fallback: T, timeoutMs = 2000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), timeoutMs)),
  ])
}

export default async function MarketPulseSection({ className }: Props = {}) {
  const end = new Date()
  const start = new Date(end.getFullYear(), 0, 1)
  const periodStart = start.toISOString().slice(0, 10)
  const periodEnd = end.toISOString().slice(0, 10)
  const data = await withTimeout(
    getMarketReportData({ periodStart, periodEnd }),
    {
      periodStart,
      periodEnd,
      metricsByCity: [],
      priceBandsSample: null,
      priceBandsSampleCity: null,
      timeseriesSample: null,
      timeseriesSampleCity: null,
    }
  )
  return <MarketPulseCarousel data={data} className={className} />
}
