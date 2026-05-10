import Link from 'next/link'
import { getGA4Summary } from '@/app/actions/ga4-report'

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

export default async function DashboardGA4Panel() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const result = await getGA4Summary(startDate, endDate)
  const ga4PropertyId = process.env.GOOGLE_GA4_PROPERTY_ID?.trim() || '(missing)'
  const ga4ServiceAccountEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim() || '(missing)'

  if (result.ok && (result.data.sessions > 0 || result.data.totalUsers > 0)) {
    const d = result.data
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Last 30 days (GA4 Data API) with acquisition and top content so you can see where traffic comes from and what pages are performing.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Sessions</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{d.sessions.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Total users</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{d.totalUsers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">New users</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{d.newUsers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Avg. session duration</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{formatDuration(d.averageSessionDurationSeconds)}</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Engagement rate</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{(d.engagementRate * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-muted p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Bounce rate</p>
            <p className="mt-1 text-xl font-semibold text-foreground">{(d.bounceRate * 100).toFixed(1)}%</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top traffic sources</p>
            <div className="mt-3 space-y-2">
              {d.topSources.length === 0 && (
                <p className="text-sm text-muted-foreground">No source data for this date range yet.</p>
              )}
              {d.topSources.map((source) => (
                <div key={source.sourceMedium} className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium text-foreground">{source.sourceMedium}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {source.sessions.toLocaleString()} sessions • {source.users.toLocaleString()} users • {(source.engagementRate * 100).toFixed(1)}% engagement
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Top pages</p>
            <div className="mt-3 space-y-2">
              {d.topPages.length === 0 && (
                <p className="text-sm text-muted-foreground">No page data for this date range yet.</p>
              )}
              {d.topPages.map((page) => (
                <div key={`${page.pagePath}-${page.pageTitle}`} className="rounded-md bg-muted p-3">
                  <p className="text-sm font-medium text-foreground">{page.pagePath}</p>
                  <p className="text-xs text-muted-foreground">{page.pageTitle}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {page.views.toLocaleString()} views • {page.users.toLocaleString()} users • {formatDuration(page.avgEngagementTimeSeconds)} avg engagement
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <p>
          <Link href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-success hover:underline">
            Open Google Analytics
          </Link>
        </p>
      </div>
    )
  }

  const isNotConfigured = !result.ok && result.error === 'GA4_NOT_CONFIGURED'
  const isPermissionDenied =
    !result.ok &&
    !isNotConfigured &&
    /PERMISSION_DENIED|insufficient permissions/i.test(result.error)
  const apiError = !result.ok && !isNotConfigured ? result.error : null
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Live GA4 metrics (sessions, users, engagement) appear here when the Data API is configured with a service account.
      </p>
      {apiError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <p className="font-medium text-destructive">API error</p>
          <p className="mt-1 text-sm text-destructive">{apiError}</p>
        </div>
      )}
      {isPermissionDenied && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
          <p className="font-medium text-foreground">Google Analytics permission fix needed</p>
          <p className="mt-1 text-sm text-warning">
            Add this service account as a Viewer (or Analyst) on GA4 property{' '}
            <code className="rounded bg-warning/15 px-1">{ga4PropertyId}</code>:
          </p>
          <p className="mt-2 text-sm text-warning">
            <code className="rounded bg-warning/15 px-1">{ga4ServiceAccountEmail}</code>
          </p>
          <p className="mt-2 text-sm text-warning">
            GA4 Admin → Property Access Management → Add users → paste service account email →
            role Viewer or Analyst. This dashboard will populate once access is granted.
          </p>
        </div>
      )}
      <div className="rounded-lg border border-warning/30 bg-warning/10 p-4">
        <p className="font-medium text-foreground">{isNotConfigured ? 'Optional' : 'Setup required'}</p>
        <p className="mt-1 text-sm text-warning">
          GA4 live metrics are optional. To enable: create a <strong>Service Account</strong> in Google Cloud, enable <strong>Google Analytics Data API</strong>, grant the service account Viewer access to your GA4 property, then add three env vars.
        </p>
        <p className="mt-2 text-sm text-warning">
          See <code className="rounded bg-warning/15 px-1">docs/GA4_SERVICE_ACCOUNT_SETUP.md</code>. Env vars: GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (GOOGLE_GA4_PROPERTY_ID is often already set).
        </p>
      </div>
      <p>
        <Link href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-success hover:underline">
          Open Google Analytics
        </Link>
      </p>
    </div>
  )
}
