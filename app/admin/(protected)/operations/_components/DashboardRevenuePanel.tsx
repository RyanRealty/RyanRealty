import { unstable_cache } from 'next/cache'
import { getRevenueDashboardData } from '@/app/actions/partnership-revenue'
import { ReportNumbers, SectionHead } from '@/components/admin/v2'
import { formatPriceExact } from '@/lib/format/money'

const getRevenueDashboardDataCached = unstable_cache(
  getRevenueDashboardData,
  ['admin-revenue-dashboard'],
  { revalidate: 300, tags: ['admin-dashboard'] }
)

// The local formatter was Intl(en-US, currency USD, maximumFractionDigits 0),
// which is exactly lib/format/money's USD0 — formatPriceExact was proven
// byte-identical on 0 / 1 / 12.4 / 12.6 / 999.5 / 1,250 / 48,375 / 894,750 /
// 1,234,567.89 / -500 before the swap. NOT formatPrice: that rounds to the
// nearest $1,000 and would move every figure on this panel.
const formatCurrency = formatPriceExact

export default async function DashboardRevenuePanel() {
  const data = await getRevenueDashboardDataCached()

  return (
    <div className="space-y-6">
      <ReportNumbers
        items={[
          { key: 'revenue30d', label: 'Revenue (30d)', value: formatCurrency(data.revenueLast30d) },
          { key: 'pipeline', label: 'Partner pipeline', value: formatCurrency(data.partnerPipelineValue) },
          { key: 'referrals30d', label: 'Partner referrals (30d)', value: data.partnerReferralsLast30d.toLocaleString() },
          { key: 'leads30d', label: 'Leads tracked (30d)', value: data.leadsLast30d.toLocaleString() },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="av2-pane">
          <SectionHead>Lead sources</SectionHead>
          {data.leadsBySource.length === 0 ? (
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No partner referrals recorded yet.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {data.leadsBySource.slice(0, 6).map((row) => (
                  <li key={row.source} className="flex items-center justify-between" style={{ fontSize: 'var(--a-text-sm)' }}>
                    <span style={{ color: 'var(--a-text)' }}>{row.source}</span>
                    <span className="a-num" style={{ color: 'var(--a-text-2)' }}>{row.count.toLocaleString()}</span>
                  </li>
                ))}
              </ul>
              {data.leadsBySource.length > 6 ? (
                <p className="a-num font-medium" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                  Showing top 6 of {data.leadsBySource.length.toLocaleString()} sources
                </p>
              ) : null}
            </>
          )}
        </div>

        <div className="av2-pane">
          <SectionHead>Revenue by page cluster</SectionHead>
          {data.revenueByPageCluster.length === 0 ? (
            <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>No revenue events recorded yet.</p>
          ) : (
            <>
              <ul className="space-y-2">
                {data.revenueByPageCluster.slice(0, 6).map((row) => (
                  <li key={row.pageCluster} className="flex items-center justify-between" style={{ fontSize: 'var(--a-text-sm)' }}>
                    <span style={{ color: 'var(--a-text)' }}>{row.pageCluster}</span>
                    <span className="a-num" style={{ color: 'var(--a-text-2)' }}>{formatCurrency(row.amount)}</span>
                  </li>
                ))}
              </ul>
              {data.revenueByPageCluster.length > 6 ? (
                <p className="a-num font-medium" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
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
