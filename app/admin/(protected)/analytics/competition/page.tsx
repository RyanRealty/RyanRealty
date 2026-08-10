/**
 * /admin/analytics/competition — CO closed-sales office + agent share (MVP)
 * Uses admin v2 + analytics DataGrid (ReportGrid primitive).
 */
import Link from 'next/link'
import { SectionHead } from '@/components/admin/v2'
import { DataGrid } from '../_components/v2/DataGrid'
import { getCoMarketAnnual } from '@/lib/data/analytics/getCoMarketAnnual'
import { getCoOfficeShare } from '@/lib/data/analytics/getCoOfficeShare'
import { getCoAgentShare } from '@/lib/data/analytics/getCoAgentShare'
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

export default async function CompetitionAnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  const sp = await searchParams
  const yearRaw = typeof sp.year === 'string' ? Number(sp.year) : 2024
  const year = Number.isFinite(yearRaw) && yearRaw >= 1998 && yearRaw <= 2030 ? yearRaw : 2024
  const side = sp.side === 'buy' ? 'buy' : 'list'

  const [share, market, agents] = await Promise.all([
    getCoOfficeShare({ year, side, limit: 40 }),
    getCoMarketAnnual({ year, typeScope: 'all' }),
    getCoAgentShare({ year, side, limit: 30 }),
  ])

  const ryanRows = share.rows.filter((r) => /ryan/i.test(r.officeName))

  return (
    <div className="space-y-8 p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Market analytics</p>
        <SectionHead>Competition — office share ({year})</SectionHead>
        <p className="mt-2 text-sm text-neutral-600">
          Central Oregon closed sales. Side:{' '}
          {side === 'list' ? 'listing office' : 'buyer office'}. String-level
          names until brand aliases are fully merged.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={`/admin/analytics/competition?year=${year}&side=list`}
          className={
            side === 'list'
              ? 'rounded bg-neutral-900 px-3 py-1.5 text-white'
              : 'rounded border border-neutral-300 px-3 py-1.5'
          }
        >
          List side
        </Link>
        <Link
          href={`/admin/analytics/competition?year=${year}&side=buy`}
          className={
            side === 'buy'
              ? 'rounded bg-neutral-900 px-3 py-1.5 text-white'
              : 'rounded border border-neutral-300 px-3 py-1.5'
          }
        >
          Buy side
        </Link>
        {[2022, 2023, 2024, 2025].map((y) => (
          <Link
            key={y}
            href={`/admin/analytics/competition?year=${y}&side=${side}`}
            className={
              y === year
                ? 'rounded bg-neutral-700 px-3 py-1.5 text-white'
                : 'rounded border border-neutral-300 px-3 py-1.5'
            }
          >
            {y}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Market volume</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {money(market.totalVolume || share.marketVolume)}
          </div>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Closes</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {(market.soldCount || share.marketSoldCount).toLocaleString('en-US')}
          </div>
        </div>
        <div className="rounded border border-neutral-200 bg-white p-4">
          <div className="text-xs uppercase tracking-wide text-neutral-500">Median close</div>
          <div className="mt-1 text-2xl font-semibold tabular-nums">
            {market.medianClose != null
              ? `$${Math.round(market.medianClose).toLocaleString('en-US')}`
              : '—'}
          </div>
        </div>
      </div>

      {ryanRows.length > 0 ? (
        <div className="rounded border border-amber-200 bg-amber-50 p-4 text-sm">
          <strong>Ryan string match:</strong>{' '}
          {ryanRows.map((r) => (
            <span key={r.officeName} className="mr-4">
              #{r.rank} {r.officeName} — {r.volumeSharePct.toFixed(2)}% $ / {r.sidesCount}{' '}
              sides
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          No /ryan/i office in top {share.rows.length} this side/year. Buy-side and aliases
          still needed for a true share.
        </div>
      )}

      <DataGrid
        label={`Office share ${year} ${side}`}
        rows={share.rows}
        getRowKey={(r) => r.officeName}
        cap={40}
        minWidth={520}
        empty={<p>No office share rows for this year/side.</p>}
        columns={[
          { key: 'rank', header: 'Rank', numeric: true, width: '64px', cell: (r) => r.rank },
          { key: 'office', header: 'Office', cell: (r) => r.officeName },
          {
            key: 'sides',
            header: 'Sides',
            numeric: true,
            cell: (r) => r.sidesCount.toLocaleString('en-US'),
          },
          {
            key: 'vol',
            header: 'Volume',
            numeric: true,
            cell: (r) => money(r.totalVolume),
          },
          {
            key: 'share',
            header: '$ share',
            numeric: true,
            cell: (r) => `${r.volumeSharePct.toFixed(2)}%`,
          },
        ]}
      />

      <SectionHead>Top agents — {side} side ({year})</SectionHead>
      <DataGrid
        label={`Agent share ${year} ${side}`}
        rows={agents.rows}
        getRowKey={(r) => `${r.agentName}-${r.officeName}`}
        cap={30}
        minWidth={520}
        empty={<p>No agent rows for this year/side.</p>}
        columns={[
          { key: 'rank', header: 'Rank', numeric: true, width: '64px', cell: (r) => r.rank },
          { key: 'agent', header: 'Agent', cell: (r) => r.agentName },
          { key: 'office', header: 'Office', cell: (r) => r.officeName },
          {
            key: 'sides',
            header: 'Sides',
            numeric: true,
            cell: (r) => r.sidesCount.toLocaleString('en-US'),
          },
          {
            key: 'vol',
            header: 'Volume',
            numeric: true,
            cell: (r) => money(r.totalVolume),
          },
          {
            key: 'share',
            header: '$ share',
            numeric: true,
            cell: (r) => `${r.volumeSharePct.toFixed(2)}%`,
          },
        ]}
      />

      <p className="text-xs leading-relaxed text-neutral-500">
        {ANALYTICS_METHODOLOGY_V1}. Side = {side}. Source = {share.source}. Not for public
        advertising of competitor production without policy review. Computed {share.computedAt}.
      </p>

      <p className="text-sm">
        <Link href="/admin/analytics" className="text-neutral-700 underline">
          Analytics hub
        </Link>
      </p>
    </div>
  )
}
