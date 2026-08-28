/**
 * Streamed islands for /housing-market/reports.
 *
 * ReportsByCityView (range table) and ReportsIndexContent (sales TilesSlider +
 * weekly list) stay as leftover mixed islands. They are not v3 patterns. D9:
 * do not flatten the range series into a figure.
 *
 * Dataset JSON-LD is emitted here, next to the rows it describes, so a slow
 * range fetch cannot blank the hub's breadcrumb/WebPage markup.
 */
import { Suspense } from 'react'
import { listMarketReports } from '@/lib/data'
import { getSalesReportCardsData } from '@/app/actions/market-reports'
import { getEngagementCountsBatchCached } from '@/app/actions/engagement'
import { getReportCities } from '@/app/actions/reports'
import { getCityRangeReport } from '@/lib/data/market/getCityRangeReport'
import { getCityReportSnapshots, hasReportSignal } from '@/lib/data/market/getCityReportSnapshot'
import { PRIMARY_CITIES } from '@/lib/cities'
import type { RangePeriod } from '@/lib/market/range-periods'
import { formatDate } from '@/lib/format/date'
import ReportsByCityView from '@/components/reports/ReportsByCityView'
import ReportsIndexContent from '@/app/reports/ReportsIndexContent'
import { MetadataBlock } from '@/components/site/MetadataBlock'
import {
  v3Text,
  V3Ledger,
  type V3LedgerFigureRow,
} from '@/components/site/v3'
import { buildCityLedgerRows, buildRangeDataset } from './hub-sections'

function ReportsSkeleton() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading market data">
      <p>Loading market data.</p>
    </div>
  )
}

export function CityHeadlineSection({ selectedCities }: { selectedCities: string[] }) {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <CityHeadlineLedger selectedCities={selectedCities} />
    </Suspense>
  )
}

async function CityHeadlineLedger({ selectedCities }: { selectedCities: string[] }) {
  const snapshots = (await getCityReportSnapshots(selectedCities)).filter(hasReportSignal)
  const rows: V3LedgerFigureRow[] = buildCityLedgerRows(snapshots)
  const [first, ...rest] = rows
  const stamp = snapshots
    .map((s) => s.live?.refreshedAt)
    .filter((value): value is string => typeof value === 'string' && value.length > 0)
    .sort()
    .at(-1)

  if (!first) {
    return (
      <V3Ledger
        id="cities"
        eyebrow={v3Text('By city')}
        heading={v3Text('Live figures by city')}
        rows={[]}
        emptyMessage={v3Text('No city in this selection returned a live single-family market row.')}
      />
    )
  }

  return (
    <V3Ledger
      id="cities"
      eyebrow={v3Text('By city')}
      heading={v3Text('Live figures by city')}
      rows={[first, ...rest]}
      source={v3Text(
        'Active single-family houses, one count per city. A missing figure is omitted.',
      )}
      updated={stamp ? v3Text(formatDate(stamp)) : undefined}
      action={{ label: v3Text('All Central Oregon cities'), href: '/cities' }}
    />
  )
}

export function RangeTableSection({
  selectedCities,
  period,
}: {
  selectedCities: string[]
  period: RangePeriod
}) {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <ReportsDataSection selectedCities={selectedCities} period={period} />
    </Suspense>
  )
}

async function ReportsDataSection({
  selectedCities,
  period,
}: {
  selectedCities: string[]
  period: RangePeriod
}) {
  const [reportData, allCitiesRes] = await Promise.all([
    getCityRangeReport(selectedCities, period),
    getReportCities(),
  ])
  const allCities = allCitiesRes.cities ?? []
  const datasetSchema = buildRangeDataset(reportData)

  return (
    <>
      {datasetSchema ? <MetadataBlock schema={datasetSchema} /> : null}
      <ReportsByCityView
        data={reportData}
        selectedCities={selectedCities}
        allCities={allCities}
      />
    </>
  )
}

export function SalesAndWeeklySection() {
  return (
    <Suspense fallback={<ReportsSkeleton />}>
      <SalesReportsSection />
    </Suspense>
  )
}

async function SalesReportsSection() {
  const [reports, salesCardsRaw] = await Promise.all([
    listMarketReports(30),
    getSalesReportCardsData(PRIMARY_CITIES),
  ])
  const allListingKeys = salesCardsRaw.flatMap((c) => c.listingKeys).slice(0, 200)
  const engagementMap =
    allListingKeys.length > 0 ? await getEngagementCountsBatchCached(allListingKeys) : {}
  const salesCards = salesCardsRaw.map((card) => ({
    ...card,
    likeCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.like_count ?? 0), 0),
    saveCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.save_count ?? 0), 0),
    shareCount: card.listingKeys.reduce((s, k) => s + (engagementMap[k]?.share_count ?? 0), 0),
  }))

  return <ReportsIndexContent reports={reports} salesCards={salesCards} />
}
