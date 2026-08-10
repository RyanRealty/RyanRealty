/**
 * /admin/analytics/competition — CO closed-sales office + agent share (MVP)
 * Uses admin v2 + analytics DataGrid (ReportGrid primitive).
 * I5: office query param drills agents to that office string.
 * I4: Ryan brand alias rollup (list + buy) from dim_office / catalog.
 * Competitor names are admin-only (I6 public naming locked).
 */
import Link from 'next/link'
import { SectionHead } from '@/components/admin/v2'
import { DataGrid } from '../_components/v2/DataGrid'
import { getCoMarketAnnual } from '@/lib/data/analytics/getCoMarketAnnual'
import { getCoOfficeShare } from '@/lib/data/analytics/getCoOfficeShare'
import { getCoAgentShare } from '@/lib/data/analytics/getCoAgentShare'
import { getRyanBrandShare } from '@/lib/data/analytics/getRyanBrandShare'
import { ANALYTICS_METHODOLOGY_V1 } from '@/lib/data/analytics/co-cities'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type SearchParams = Promise<Record<string, string | string[] | undefined>>

function money(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`
  if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`
  return `$${Math.round(n).toLocaleString('en-US')}`
}

function competitionHref(opts: {
  year: number
  side: string
  office?: string | null
}): string {
  const q = new URLSearchParams()
  q.set('year', String(opts.year))
  q.set('side', opts.side)
  if (opts.office) q.set('office', opts.office)
  return `/admin/analytics/competition?${q.toString()}`
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
  const officeFilter =
    typeof sp.office === 'string' && sp.office.trim() ? sp.office.trim() : null

  const [share, market, agents, ryanBrand] = await Promise.all([
    getCoOfficeShare({ year, side, limit: 40 }),
    getCoMarketAnnual({ year, typeScope: 'all' }),
    getCoAgentShare({
      year,
      side,
      limit: officeFilter ? 50 : 30,
      officeName: officeFilter ?? undefined,
    }),
    getRyanBrandShare({ year }),
  ])

  const ryanRows = share.rows.filter((r) => /ryan/i.test(r.officeName))
  const selectedOfficeRow = officeFilter
    ? share.rows.find((r) => r.officeName === officeFilter) ?? null
    : null

  const exportOfficesHref = `/admin/analytics/competition/export?year=${year}&side=${side}&kind=offices`
  const exportAgentsHref = officeFilter
    ? `/admin/analytics/competition/export?year=${year}&side=${side}&kind=agents&office=${encodeURIComponent(officeFilter)}`
    : `/admin/analytics/competition/export?year=${year}&side=${side}&kind=agents`

  return (
    <div className="space-y-8 p-6">
      <div>
        <p className="text-xs uppercase tracking-wide text-neutral-500">Market analytics</p>
        <SectionHead>Competition — office share ({year})</SectionHead>
        <p className="mt-2 text-sm text-neutral-600">
          Central Oregon closed sales. Side:{' '}
          {side === 'list' ? 'listing office' : 'buyer office'}. Rankings are
          string-level office names; brand alias groups live in{' '}
          <code className="text-xs">analytics_dim_office</code> (entity layer —
          not yet used to merge share %). Admin only — not for public competitor
          naming.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        <Link
          href={competitionHref({ year, side: 'list', office: officeFilter })}
          className={
            side === 'list'
              ? 'rounded bg-neutral-900 px-3 py-1.5 text-white'
              : 'rounded border border-neutral-300 px-3 py-1.5'
          }
        >
          List side
        </Link>
        <Link
          href={competitionHref({ year, side: 'buy', office: officeFilter })}
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
            href={competitionHref({ year: y, side, office: officeFilter })}
            className={
              y === year
                ? 'rounded bg-neutral-700 px-3 py-1.5 text-white'
                : 'rounded border border-neutral-300 px-3 py-1.5'
            }
          >
            {y}
          </Link>
        ))}
        <a
          href={exportOfficesHref}
          className="rounded border border-neutral-300 px-3 py-1.5 text-neutral-700"
        >
          Export offices CSV
        </a>
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

      {/* I4 — strategy-grade Ryan brand share (alias rollup, list + buy) */}
      <div className="rounded border border-amber-300 bg-amber-50 p-4 text-sm space-y-3">
        <div>
          <strong>Ryan Realty brand share ({year})</strong>
          <span className="ml-2 text-xs text-neutral-600">
            alias rollup · {ryanBrand.aliasSource} · source {ryanBrand.source}
          </span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded border border-amber-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">List side</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {ryanBrand.list.volumeSharePct.toFixed(3)}% $
            </div>
            <div className="mt-1 text-neutral-700 tabular-nums">
              {ryanBrand.list.sidesCount.toLocaleString('en-US')} sides ·{' '}
              {money(ryanBrand.list.totalVolume)} · {ryanBrand.list.unitSharePct.toFixed(3)}% units
            </div>
          </div>
          <div className="rounded border border-amber-200 bg-white p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Buy side</div>
            <div className="mt-1 text-xl font-semibold tabular-nums">
              {ryanBrand.buy.volumeSharePct.toFixed(3)}% $
            </div>
            <div className="mt-1 text-neutral-700 tabular-nums">
              {ryanBrand.buy.sidesCount.toLocaleString('en-US')} sides ·{' '}
              {money(ryanBrand.buy.totalVolume)} · {ryanBrand.buy.unitSharePct.toFixed(3)}% units
            </div>
          </div>
        </div>
        <p className="text-xs text-neutral-600 leading-relaxed">
          Canonical <code>{ryanBrand.canonicalName}</code>. Matched list strings:{' '}
          {ryanBrand.list.matchedOfficeNames.length
            ? ryanBrand.list.matchedOfficeNames.join('; ')
            : 'none'}
          . Matched buy strings:{' '}
          {ryanBrand.buy.matchedOfficeNames.length
            ? ryanBrand.buy.matchedOfficeNames.join('; ')
            : 'none'}
          . Market base: {(ryanBrand.list.marketSoldCount || market.soldCount).toLocaleString('en-US')}{' '}
          closes / {money(ryanBrand.list.marketVolume || market.totalVolume || 0)}. See{' '}
          <code>DIM_OFFICE_ENTITY_RESOLUTION.md</code> § I4.
        </p>
        {ryanRows.length > 0 ? (
          <p className="text-xs text-neutral-600">
            String rows in current top-{share.rows.length} ({side}):{' '}
            {ryanRows.map((r) => (
              <span key={r.officeName} className="mr-3">
                #{r.rank} {r.officeName} {r.volumeSharePct.toFixed(2)}%
              </span>
            ))}
          </p>
        ) : null}
      </div>

      <DataGrid
        label={`Office share ${year} ${side}`}
        rows={share.rows}
        getRowKey={(r) => r.officeName}
        cap={40}
        minWidth={520}
        empty={<p>No office share rows for this year/side.</p>}
        columns={[
          { key: 'rank', header: 'Rank', numeric: true, width: '64px', cell: (r) => r.rank },
          {
            key: 'office',
            header: 'Office',
            cell: (r) => (
              <Link
                href={competitionHref({ year, side, office: r.officeName })}
                className={
                  officeFilter === r.officeName
                    ? 'font-medium text-neutral-900 underline'
                    : 'text-neutral-800 underline decoration-neutral-300 hover:decoration-neutral-600'
                }
                title="Show agents at this office"
              >
                {r.officeName}
              </Link>
            ),
          },
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

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <SectionHead>
            {officeFilter
              ? `Agents at ${officeFilter} — ${side} side (${year})`
              : `Top agents — ${side} side (${year})`}
          </SectionHead>
          {officeFilter ? (
            <p className="mt-1 text-sm text-neutral-600">
              Filtered to exact office string match
              {selectedOfficeRow
                ? ` · office rank #${selectedOfficeRow.rank} · ${money(selectedOfficeRow.totalVolume)} · ${selectedOfficeRow.volumeSharePct.toFixed(2)}% $ share`
                : ' (office may be outside top-40 table)'}.{' '}
              <Link
                href={competitionHref({ year, side })}
                className="underline"
              >
                Clear office filter
              </Link>
              {' · '}
              <a href={exportAgentsHref} className="underline">
                Export agents CSV
              </a>
            </p>
          ) : (
            <p className="mt-1 text-sm text-neutral-600">
              Market-wide top agents. Click an office name above to drill into agents at
              that office.{' '}
              <a href={exportAgentsHref} className="underline">
                Export agents CSV
              </a>
            </p>
          )}
        </div>
      </div>

      <DataGrid
        label={
          officeFilter
            ? `Agent share ${year} ${side} @ ${officeFilter}`
            : `Agent share ${year} ${side}`
        }
        rows={agents.rows}
        getRowKey={(r) => `${r.agentName}-${r.officeName}`}
        cap={officeFilter ? 50 : 30}
        minWidth={520}
        empty={
          <p>
            {officeFilter
              ? `No agents for office “${officeFilter}” this year/side.`
              : 'No agent rows for this year/side.'}
          </p>
        }
        columns={[
          { key: 'rank', header: 'Rank', numeric: true, width: '64px', cell: (r) => r.rank },
          { key: 'agent', header: 'Agent', cell: (r) => r.agentName },
          {
            key: 'office',
            header: 'Office',
            cell: (r) =>
              officeFilter ? (
                r.officeName
              ) : (
                <Link
                  href={competitionHref({ year, side, office: r.officeName })}
                  className="underline decoration-neutral-300 hover:decoration-neutral-600"
                >
                  {r.officeName}
                </Link>
              ),
          },
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
            header: '$ share mkt',
            numeric: true,
            cell: (r) => `${r.volumeSharePct.toFixed(2)}%`,
          },
        ]}
      />

      <p className="text-xs leading-relaxed text-neutral-500">
        {ANALYTICS_METHODOLOGY_V1}. Side = {side}
        {officeFilter ? `; office filter = ${officeFilter}` : ''}. Source offices ={' '}
        {share.source}; agents = {agents.source}. Entity aliases: see{' '}
        <code>docs/plans/seo-voice/DIM_OFFICE_ENTITY_RESOLUTION.md</code>. Not for public
        advertising of competitor production without policy review (I6). Computed{' '}
        {share.computedAt}.
      </p>

      <p className="text-sm">
        <Link href="/admin/analytics" className="text-neutral-700 underline">
          Analytics hub
        </Link>
      </p>
    </div>
  )
}
