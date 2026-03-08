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

  if (result.ok && (result.data.sessions > 0 || result.data.totalUsers > 0)) {
    const d = result.data
    return (
      <div className="space-y-4">
        <p className="text-sm text-zinc-600">
          Last 30 days (GA4 Data API). More metrics (acquisition, top content, real-time) can be added later.
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Sessions</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{d.sessions.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total users</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{d.totalUsers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">New users</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{d.newUsers.toLocaleString()}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Avg. session duration</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{formatDuration(d.averageSessionDurationSeconds)}</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Engagement rate</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{(d.engagementRate * 100).toFixed(1)}%</p>
          </div>
          <div className="rounded-lg bg-zinc-50 p-3">
            <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Bounce rate</p>
            <p className="mt-1 text-xl font-semibold text-zinc-900">{(d.bounceRate * 100).toFixed(1)}%</p>
          </div>
        </div>
        <p>
          <Link href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-700 hover:underline">
            Open Google Analytics
          </Link>
        </p>
      </div>
    )
  }

  const errorMsg = !result.ok ? result.error : null
  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Live GA4 metrics (sessions, users, engagement) appear here when the Data API is configured with a service account.
      </p>
      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <p className="font-medium text-red-900">API error</p>
          <p className="mt-1 text-sm text-red-800">{errorMsg}</p>
        </div>
      )}
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <p className="font-medium text-amber-900">Setup required</p>
        <p className="mt-1 text-sm text-amber-800">
          Create a <strong>Service Account</strong> in Google Cloud, enable <strong>Google Analytics Data API</strong>, grant the service account Viewer access to your GA4 property, then add three env vars. Step-by-step:
        </p>
        <p className="mt-2 text-sm text-amber-800">
          See <code className="rounded bg-amber-100 px-1">docs/GA4_SERVICE_ACCOUNT_SETUP.md</code> in the repo. Env vars: GOOGLE_GA4_PROPERTY_ID, GOOGLE_SERVICE_ACCOUNT_CLIENT_EMAIL, GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY.
        </p>
      </div>
      <p>
        <Link href="https://analytics.google.com" target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-emerald-700 hover:underline">
          Open Google Analytics
        </Link>
      </p>
    </div>
  )
}
