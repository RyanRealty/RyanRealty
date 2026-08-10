/**
 * /admin/analytics/competition — CO closed-sales office market share (MVP A8)
 *
 * List-side and buy-side rankings from getCoOfficeShare (§0 methodology).
 * Not public. String-level office names until dim_office aliases land.
 */
import Link from 'next/link'
import {
  getCoOfficeShare,
  getCoAgentShare,
  getCoMarketAnnual,
  ANALYTICS_METHODOLOGY_V1,
} from '@/lib/data'
import { SectionHead } from '@/components/admin/v2'

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
    <div className="mx-auto max-w-6xl space-y-8 p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Market analytics</p>
        <SectionHead>Competition — office share ({year})</SectionHead>
        <p className="mt-2 text-sm text-neutral-600">
          Central Oregon closed sales. Side:{' '}
          {side === 'list' ? 'listing office' : 'buyer office'}. String-level names (aliases not
          merged yet).
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
          <strong>Ryan string match (not alias-resolved):</strong>{' '}
          {ryanRows.map((r) => (
            <span key={r.officeName} className="mr-4">
              #{r.rank} {r.officeName} — {r.volumeSharePct.toFixed(2)}% $ /{' '}
              {r.sidesCount} sides
            </span>
          ))}
        </div>
      ) : (
        <div className="rounded border border-neutral-200 bg-neutral-50 p-4 text-sm text-neutral-600">
          No office name matching /ryan/i in top {share.rows.length} on this side/year. Buy side
          and aliases still required for a true Ryan share.
        </div>
      )}

      <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Office</th>
              <th className="px-3 py-2 tabular-nums">Sides</th>
              <th className="px-3 py-2 tabular-nums">Volume</th>
              <th className="px-3 py-2 tabular-nums">$ share</th>
              <th className="px-3 py-2 tabular-nums">Unit share</th>
            </tr>
          </thead>
          <tbody>
            {share.rows.map((r) => (
              <tr key={r.officeName} className="border-b border-neutral-100">
                <td className="px-3 py-2 tabular-nums text-neutral-500">{r.rank}</td>
                <td className="px-3 py-2 font-medium">{r.officeName}</td>
                <td className="px-3 py-2 tabular-nums">{r.sidesCount.toLocaleString('en-US')}</td>
                <td className="px-3 py-2 tabular-nums">{money(r.totalVolume)}</td>
                <td className="px-3 py-2 tabular-nums">{r.volumeSharePct.toFixed(2)}%</td>
                <td className="px-3 py-2 tabular-nums">{r.unitSharePct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionHead>Top agents — {side} side ({year})</SectionHead>
      <div className="overflow-x-auto rounded border border-neutral-200 bg-white">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b bg-neutral-50 text-xs uppercase tracking-wide text-neutral-500">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Agent</th>
              <th className="px-3 py-2">Office</th>
              <th className="px-3 py-2 tabular-nums">Sides</th>
              <th className="px-3 py-2 tabular-nums">Volume</th>
              <th className="px-3 py-2 tabular-nums">$ share</th>
            </tr>
          </thead>
          <tbody>
            {agents.rows.map((r) => (
              <tr key={`${r.agentName}-${r.officeName}`} className="border-b border-neutral-100">
                <td className="px-3 py-2 tabular-nums text-neutral-500">{r.rank}</td>
                <td className="px-3 py-2 font-medium">{r.agentName}</td>
                <td className="px-3 py-2 text-neutral-600">{r.officeName}</td>
                <td className="px-3 py-2 tabular-nums">{r.sidesCount.toLocaleString('en-US')}</td>
                <td className="px-3 py-2 tabular-nums">{money(r.totalVolume)}</td>
                <td className="px-3 py-2 tabular-nums">{r.volumeSharePct.toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs leading-relaxed text-neutral-500">
        {ANALYTICS_METHODOLOGY_V1}. Side = {side}. Source = {share.source}. Dual-agency closes
        credit both offices when list≠buy; same-office both sides still one row per side count.
        Not for public advertising of competitor production without policy review. Computed{' '}
        {share.computedAt}.
      </p>

      <p className="text-sm">
        <Link href="/admin/analytics" className="text-neutral-700 underline">
          ← Analytics hub
        </Link>
      </p>
    </div>
  )
}
