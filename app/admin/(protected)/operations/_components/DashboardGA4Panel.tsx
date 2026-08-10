// Admin v2 migration of components/admin/DashboardGA4Panel.tsx — presentation
// only. Data, computations, conditionals, hrefs and copy are unchanged; every
// shadcn semantic color utility (card surface, muted foreground text, hairline
// borders, …) now reads its color from the locked admin tokens (components/admin/v2).
import Link from 'next/link'
import { unstable_cache } from 'next/cache'
import { getGA4Summary } from '@/app/actions/ga4-report'

// Live GA4 Data API call — cached so the admin dashboard doesn't pay the
// round-trip per render (args are part of the cache key).
const getGA4SummaryCached = unstable_cache(getGA4Summary, ['admin-ga4-summary'], {
  revalidate: 300,
  tags: ['admin-dashboard'],
})

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`
  const m = Math.floor(seconds / 60)
  const s = Math.round(seconds % 60)
  return `${m}m ${s}s`
}

// Shared style objects — module scope so they aren't rebuilt every render and
// every occurrence of the same visual role stays byte-identical.
const eyebrow = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }
const bodySm = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }
const rowTitleSm = { fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }
const tileValueXl = { fontSize: 'var(--a-text-xl)', color: 'var(--a-text)' }
const statTile = { borderRadius: 'var(--a-r-lg)', background: 'var(--a-inset)', padding: 'var(--a-s3)' }
const rowTile = { borderRadius: 'var(--a-r-md)', background: 'var(--a-inset)', padding: 'var(--a-s3)' }
const codeChip = { borderRadius: 'var(--a-r-sm)', background: 'var(--a-inset)', padding: '0 4px' }
const dangerBox = {
  border: '1px solid var(--a-danger)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-danger-wash)',
  padding: 'var(--a-s4)',
}
const warnBox = {
  border: '1px solid var(--a-warn)',
  borderRadius: 'var(--a-r-lg)',
  background: 'var(--a-warn-wash)',
  padding: 'var(--a-s4)',
}

export default async function DashboardGA4Panel() {
  const end = new Date()
  const start = new Date()
  start.setDate(start.getDate() - 30)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)

  const result = await getGA4SummaryCached(startDate, endDate)
  const ga4PropertyId = process.env.GOOGLE_GA4_PROPERTY_ID?.trim() || '(missing)'
  const ga4ServiceAccountEmail =
    process.env.GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL?.trim() || '(missing)'

  if (result.ok && (result.data.sessions > 0 || result.data.totalUsers > 0)) {
    const d = result.data
    return (
      <div className="space-y-4">
        <p style={bodySm}>
          Last 30 days with acquisition, social channel performance, and lead-event tracking so you can optimize for more seller leads.
          {' '}GA4 is consent-gated and undercounts vs first-party — use <code style={codeChip}>visitor_sessions</code> / live visitors as primary traffic (see docs/plans/seo-voice/MEASUREMENT_DUAL_SOURCE.md).
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div style={statTile}>
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Sessions</p>
            <p className="mt-1 a-num font-semibold" style={tileValueXl}>{d.sessions.toLocaleString()}</p>
          </div>
          <div style={statTile}>
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Total users</p>
            <p className="mt-1 a-num font-semibold" style={tileValueXl}>{d.totalUsers.toLocaleString()}</p>
          </div>
          <div style={statTile}>
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>New users</p>
            <p className="mt-1 a-num font-semibold" style={tileValueXl}>{d.newUsers.toLocaleString()}</p>
          </div>
          <div style={statTile}>
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Avg. session duration</p>
            <p className="mt-1 a-num font-semibold" style={tileValueXl}>{formatDuration(d.averageSessionDurationSeconds)}</p>
          </div>
          <div style={statTile}>
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Engagement rate</p>
            <p className="mt-1 a-num font-semibold" style={tileValueXl}>{(d.engagementRate * 100).toFixed(1)}%</p>
          </div>
          <div style={statTile}>
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Bounce rate</p>
            <p className="mt-1 a-num font-semibold" style={tileValueXl}>{(d.bounceRate * 100).toFixed(1)}%</p>
          </div>
          <div style={statTile}>
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Lead events</p>
            <p className="mt-1 a-num font-semibold" style={tileValueXl}>{d.totalLeadEvents.toLocaleString()}</p>
          </div>
          <div style={statTile}>
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Lead event rate</p>
            <p className="mt-1 a-num font-semibold" style={tileValueXl}>{(d.leadEventRate * 100).toFixed(2)}%</p>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="av2-pane">
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Top traffic sources</p>
            <div className="space-y-2">
              {d.topSources.length === 0 && (
                <p style={bodySm}>No source data for this date range yet.</p>
              )}
              {d.topSources.map((source) => (
                <div key={source.sourceMedium} style={rowTile}>
                  <p className="font-medium" style={rowTitleSm}>{source.sourceMedium}</p>
                  <p className="mt-1" style={eyebrow}>
                    {source.sessions.toLocaleString()} sessions • {source.users.toLocaleString()} users • {(source.engagementRate * 100).toFixed(1)}% engagement
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="av2-pane">
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Top pages</p>
            <div className="space-y-2">
              {d.topPages.length === 0 && (
                <p style={bodySm}>No page data for this date range yet.</p>
              )}
              {d.topPages.map((page) => (
                <div key={`${page.pagePath}-${page.pageTitle}`} style={rowTile}>
                  <p className="font-medium" style={rowTitleSm}>{page.pagePath}</p>
                  <p style={eyebrow}>{page.pageTitle}</p>
                  <p className="mt-1" style={eyebrow}>
                    {page.views.toLocaleString()} views • {page.users.toLocaleString()} users • {formatDuration(page.avgEngagementTimeSeconds)} avg engagement
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="av2-pane">
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Top lead actions</p>
            <div className="space-y-2">
              {d.topLeadEvents.length === 0 && (
                <p style={bodySm}>No lead events in this date range yet.</p>
              )}
              {d.topLeadEvents.map((lead) => (
                <div key={lead.eventName} style={rowTile}>
                  <p className="font-medium" style={rowTitleSm}>{lead.eventName}</p>
                  <p className="mt-1" style={eyebrow}>
                    {lead.eventCount.toLocaleString()} events • {lead.users.toLocaleString()} users
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div className="av2-pane">
            <p className="font-medium uppercase tracking-wider" style={eyebrow}>Lead sources</p>
            <div className="space-y-2">
              {d.leadSources.length === 0 && (
                <p style={bodySm}>No attributed lead sources yet.</p>
              )}
              {d.leadSources.map((source) => (
                <div key={source.sourceMedium} style={rowTile}>
                  <p className="font-medium" style={rowTitleSm}>{source.sourceMedium}</p>
                  <p className="mt-1" style={eyebrow}>
                    {source.leadEvents.toLocaleString()} lead events • {source.users.toLocaleString()} users
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="av2-pane">
          <p className="font-medium uppercase tracking-wider" style={eyebrow}>Social channel sessions</p>
          <div className="space-y-2">
            {d.socialChannels.length === 0 && (
              <p style={bodySm}>No social channel sessions reported yet.</p>
            )}
            {d.socialChannels.map((channel) => (
              <div key={channel.channel} style={rowTile}>
                <p className="font-medium" style={rowTitleSm}>{channel.channel}</p>
                <p className="mt-1" style={eyebrow}>
                  {channel.sessions.toLocaleString()} sessions • {channel.users.toLocaleString()} users • {(channel.engagementRate * 100).toFixed(1)}% engagement
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="av2-pane">
          <p className="font-medium uppercase tracking-wider" style={eyebrow}>Facebook ads attribution checklist</p>
          <p className="break-words" style={bodySm}>
            Keep UTM naming consistent in every ad URL so lead-source reporting is reliable:
            <code className="ml-1 break-all" style={codeChip}>utm_source=facebook</code>,
            <code className="ml-1 break-all" style={codeChip}>utm_medium=paid_social</code>,
            <code className="ml-1 break-all" style={codeChip}>utm_campaign=&lt;campaign-name&gt;</code>,
            <code className="ml-1 break-all" style={codeChip}>utm_content=&lt;ad-variant&gt;</code>.
          </p>
        </div>
        <p>
          <Link
            href="https://analytics.google.com"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium hover:underline"
            style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)' }}
          >
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
      <p style={bodySm}>
        Live GA4 metrics (sessions, users, engagement) appear here when the Data API is configured with a service account.
      </p>
      {apiError && (
        <div style={dangerBox}>
          <p className="font-medium" style={{ color: 'var(--a-danger)' }}>API error</p>
          <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>{apiError}</p>
        </div>
      )}
      {isPermissionDenied && (
        <div style={warnBox}>
          <p className="font-medium" style={{ color: 'var(--a-text)' }}>Google Analytics permission fix needed</p>
          <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }}>
            Add this service account as a Viewer (or Analyst) on GA4 property{' '}
            <code style={codeChip}>{ga4PropertyId}</code>:
          </p>
          <p className="mt-2" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }}>
            <code style={codeChip}>{ga4ServiceAccountEmail}</code>
          </p>
          <p className="mt-2" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }}>
            GA4 Admin → Property Access Management → Add users → paste service account email →
            role Viewer or Analyst. This dashboard will populate once access is granted.
          </p>
        </div>
      )}
      <div style={warnBox}>
        <p className="font-medium" style={{ color: 'var(--a-text)' }}>{isNotConfigured ? 'Optional' : 'Setup required'}</p>
        <p className="mt-1" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }}>
          GA4 live metrics are optional. To enable: create a <strong>Service Account</strong> in Google Cloud, enable <strong>Google Analytics Data API</strong>, grant the service account Viewer access to your GA4 property, then add three env vars.
        </p>
        <p className="mt-2" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-warn)' }}>
          See <code style={codeChip}>docs/GA4_SERVICE_ACCOUNT_SETUP.md</code>. Env vars: GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL and GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY (GOOGLE_GA4_PROPERTY_ID is often already set).
        </p>
      </div>
      <p>
        <Link
          href="https://analytics.google.com"
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline"
          style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-ok)' }}
        >
          Open Google Analytics
        </Link>
      </p>
    </div>
  )
}
