import type { DashboardLeadData } from '@/app/actions/dashboard'

function formatTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return iso
  }
}

type Props = { data: DashboardLeadData }

export default function DashboardLeadPanel({ data }: Props) {
  const rate = data.totalVisits > 0 ? ((data.visitsWithUser / data.totalVisits) * 100).toFixed(1) : '0'
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total visits</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{data.totalVisits.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Identified sessions</p>
          <p className="mt-1 text-xl font-semibold text-emerald-700">{data.visitsWithUser.toLocaleString()}</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Identification rate</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{rate}%</p>
        </div>
        <div className="rounded-lg bg-zinc-50 p-3">
          <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Visits (24h)</p>
          <p className="mt-1 text-xl font-semibold text-zinc-900">{data.visitsLast24h.toLocaleString()}</p>
          <p className="mt-0.5 text-xs text-zinc-500">{data.visitsWithUserLast24h} identified</p>
        </div>
      </div>
      <div>
        <h3 className="text-sm font-semibold text-zinc-700">Recent activity (last 50)</h3>
        {data.recentVisits.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-500">No visits yet.</p>
        ) : (
          <div className="mt-2 max-h-64 overflow-y-auto">
            <table className="min-w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-zinc-50">
                <tr className="border-b border-zinc-200">
                  <th className="py-1.5 pr-3 text-left font-medium text-zinc-600">Time</th>
                  <th className="py-1.5 pr-3 text-left font-medium text-zinc-600">Path</th>
                  <th className="py-1.5 pl-3 text-left font-medium text-zinc-600">User</th>
                </tr>
              </thead>
              <tbody>
                {data.recentVisits.map((v) => (
                  <tr key={v.visit_id + v.created_at} className="border-b border-zinc-100">
                    <td className="py-1.5 pr-3 text-zinc-600 whitespace-nowrap">{formatTime(v.created_at)}</td>
                    <td className="py-1.5 pr-3 font-mono text-zinc-900 truncate max-w-[200px]" title={v.path}>{v.path}</td>
                    <td className="py-1.5 pl-3 text-zinc-600">{v.user_id ? 'Yes' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <p className="text-sm text-zinc-500">Hot leads and engagement scoring require FUB API or a contacts table. GA4 panel will show acquisition and conversion funnel.</p>
    </div>
  )
}
