import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { getSearchConsoleSummary } from '@/app/actions/search-console-report'

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
        <p className="text-sm text-muted-foreground">
          Search Console performance appears here with query and page level search visibility data.
        </p>
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <p className="font-medium text-foreground">{configured ? 'Search Console API error' : 'Setup required'}</p>
          <p className="mt-1 text-sm text-warning">
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
      <p className="text-sm text-muted-foreground">Last 28 days from Google Search Console.</p>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Clicks</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{data.clicks.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Impressions</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{data.impressions.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">CTR</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{formatPercent(data.ctr)}</p>
        </div>
        <div className="rounded-lg bg-muted p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg position</p>
          <p className="mt-1 text-xl font-semibold text-foreground">{data.position.toFixed(1)}</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Top queries</h3>
          <ul className="mt-3 space-y-2">
            {topQueries.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{row.key}</span>
                <span className="text-muted-foreground">{row.clicks.toLocaleString()} clicks</span>
              </li>
            ))}
          </ul>
          {data.topQueries.length > TOP_N ? (
            <Link
              href="https://search.google.com/search-console/performance/search-analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-success hover:underline"
            >
              See all ({data.topQueries.length.toLocaleString()}) →
            </Link>
          ) : null}
        </div>
        <div className="rounded-lg border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground">Top pages</h3>
          <ul className="mt-3 space-y-2">
            {topPages.map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 text-sm">
                <span className="truncate text-foreground">{row.key.replace(/^https?:\/\/[^/]+/i, '') || row.key}</span>
                <span className="text-muted-foreground">{row.clicks.toLocaleString()} clicks</span>
              </li>
            ))}
          </ul>
          {data.topPages.length > TOP_N ? (
            <Link
              href="https://search.google.com/search-console/performance/search-analytics"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-medium text-success hover:underline"
            >
              See all ({data.topPages.length.toLocaleString()}) →
            </Link>
          ) : null}
        </div>
      </div>

      <p>
        <Link href="https://search.google.com/search-console" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-success hover:underline">
          Open Google Search Console
        </Link>
      </p>
    </div>
  )
}
