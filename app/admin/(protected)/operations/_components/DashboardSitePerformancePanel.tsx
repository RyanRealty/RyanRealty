import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { getSearchConsoleSummary } from '@/app/actions/search-console-report'
import { ReportNumbers, SectionHead } from '@/components/admin/v2'

// Live Search Console API call — cached per-args so the dashboard render
// doesn't pay the round-trip every request.
const getSearchConsoleSummaryCached = unstable_cache(
  getSearchConsoleSummary,
  ['admin-gsc-summary'],
  { revalidate: 300, tags: ['admin-dashboard'] }
)

function formatPercent(value: number) {
  return `${(value * 100).toFixed(2)}%`
}

export default async function DashboardSitePerformancePanel() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 28)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const result = await getSearchConsoleSummaryCached(startDate, endDate)

  if (!result.ok) {
    const configured = result.error !== 'SEARCH_CONSOLE_NOT_CONFIGURED'
    return (
      <div className="space-y-4">
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Search Console performance appears here with query and page level search visibility data.
        </p>
        <div className="rounded-lg p-4" style={{ background: 'var(--a-warn-wash)' }}>
          <p className="font-medium" style={{ color: 'var(--a-text)' }}>{configured ? 'Search Console API error' : 'Setup required'}</p>
          <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }}>
            {configured
              ? result.error
              : 'Set GOOGLE_SEARCH_CONSOLE_SITE_URL and reuse your Google service account credentials to enable this panel.'}
          </p>
        </div>
      </div>
    )
  }

  const data = result.data
  const TOP_N = 8
  const topQueries = data.topQueries.slice(0, TOP_N)
  const topPages = data.topPages.slice(0, TOP_N)

  return (
    <div className="space-y-4">
      <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>Last 28 days from Google Search Console.</p>

      <ReportNumbers
        items={[
          { key: 'clicks', label: 'Clicks', value: data.clicks.toLocaleString() },
          { key: 'impressions', label: 'Impressions', value: data.impressions.toLocaleString() },
          { key: 'ctr', label: 'CTR', value: formatPercent(data.ctr) },
          { key: 'position', label: 'Avg position', value: data.position.toFixed(1) },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="av2-pane">
          <SectionHead>Top queries</SectionHead>
          <ul className="space-y-2">
            {topQueries.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3" style={{ fontSize: 'var(--a-text-sm)' }}>
                <span className="truncate" style={{ color: 'var(--a-text)' }}>{row.key}</span>
                <span className="a-num" style={{ color: 'var(--a-text-2)' }}>{row.clicks.toLocaleString()} clicks</span>
              </li>
            ))}
          </ul>
          {data.topQueries.length > TOP_N ? (
            <Link
              href="https://search.google.com/search-console/performance/search-analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="a-num inline-block hover:underline"
              style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-ok)' }}
            >
              See all ({data.topQueries.length.toLocaleString()}) →
            </Link>
          ) : null}
        </div>
        <div className="av2-pane">
          <SectionHead>Top pages</SectionHead>
          <ul className="space-y-2">
            {topPages.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3" style={{ fontSize: 'var(--a-text-sm)' }}>
                <span className="truncate" style={{ color: 'var(--a-text)' }}>{row.key.replace(/^https?:\/\/[^/]+/i, '') || row.key}</span>
                <span className="a-num" style={{ color: 'var(--a-text-2)' }}>{row.clicks.toLocaleString()} clicks</span>
              </li>
            ))}
          </ul>
          {data.topPages.length > TOP_N ? (
            <Link
              href="https://search.google.com/search-console/performance/search-analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="a-num inline-block hover:underline"
              style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-ok)' }}
            >
              See all ({data.topPages.length.toLocaleString()}) →
            </Link>
          ) : null}
        </div>
      </div>

      <p>
        <Link
          href="https://search.google.com/search-console"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)' }}
        >
          Open Google Search Console
        </Link>
      </p>
    </div>
  )
}
