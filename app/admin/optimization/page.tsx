import { getLastOptimizationRun } from '../../actions/optimization-runs'
import Link from 'next/link'

export default async function AdminOptimizationPage() {
  const last = await getLastOptimizationRun()

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Optimization loop</h1>
      <p className="mt-1 text-sm text-zinc-600">
        Weekly cron analyzes GA4 and Search Console (when configured) and records findings here.
      </p>
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
        {last ? (
          <>
            <p className="text-sm font-medium text-zinc-900">
              Last run: {new Date(last.run_at).toLocaleString()}
            </p>
            {last.summary && (
              <p className="mt-2 text-sm text-zinc-600">{last.summary}</p>
            )}
            {last.findings?.length ? (
              <ul className="mt-2 list-inside list-disc text-sm text-zinc-600">
                {last.findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            ) : null}
            {last.suggested_changes?.length ? (
              <>
                <p className="mt-2 text-sm font-medium text-zinc-700">Suggested changes</p>
                <ul className="list-inside list-disc text-sm text-zinc-600">
                  {last.suggested_changes.map((s, i) => (
                    <li key={i}>{s}</li>
                  ))}
                </ul>
              </>
            ) : null}
          </>
        ) : (
          <p className="text-sm text-zinc-500">No runs recorded yet. Configure Vercel cron to call /api/cron/optimization-loop.</p>
        )}
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        <Link href="/admin" className="underline hover:no-underline">Back to Dashboard</Link>
      </p>
    </div>
  )
}
