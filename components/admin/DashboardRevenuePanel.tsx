import { unstable_cache } from 'next/cache'
import { getRevenueDashboardData } from '@/app/actions/partnership-revenue'

const getRevenueDashboardDataCached = unstable_cache(
  getRevenueDashboardData,
  ['admin-revenue-dashboard'],
  { revalidate: 300, tags: ['admin-dashboard'] }
)

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default async function DashboardRevenuePanel() {
  const data = await getRevenueDashboardDataCached()

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Revenue (30d)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(data.revenueLast30d)}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Partner pipeline</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatCurrency(data.partnerPipelineValue)}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Partner referrals (30d)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{data.partnerReferralsLast30d.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Leads tracked (30d)</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{data.leadsLast30d.toLocaleString()}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Lead sources</h3>
          {data.leadsBySource.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No partner referrals recorded yet.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {data.leadsBySource.slice(0, 6).map((row) => (
                  <li key={row.source} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{row.source}</span>
                    <span className="text-muted-foreground">{row.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              {data.leadsBySource.length > 6 ? (
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  Showing top 6 of {data.leadsBySource.length.toLocaleString()} sources
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Revenue by page cluster</h3>
          {data.revenueByPageCluster.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">No revenue events recorded yet.</p>
          ) : (
            <>
              <ul className="mt-3 space-y-2">
                {data.revenueByPageCluster.slice(0, 6).map((row) => (
                  <li key={row.pageCluster} className="flex items-center justify-between text-sm">
                    <span className="text-foreground">{row.pageCluster}</span>
                    <span className="text-muted-foreground">{formatCurrency(row.amount)}</span>
                  </li>
                ))}
              </ul>
              {data.revenueByPageCluster.length > 6 ? (
                <p className="mt-3 text-xs font-medium text-muted-foreground">
                  Showing top 6 of {data.revenueByPageCluster.length.toLocaleString()} clusters
                </p>
              ) : null}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
