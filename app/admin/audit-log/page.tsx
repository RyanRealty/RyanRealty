import { getAdminActions } from '../../actions/admin-audit'
import Link from 'next/link'

export default async function AdminAuditLogPage() {
  const actions = await getAdminActions({ limit: 100 })

  return (
    <div>
      <h1 className="text-xl font-bold text-zinc-900">Audit log</h1>
      <p className="mt-1 text-sm text-zinc-600">Recent admin actions (create, update, delete).</p>
      <div className="mt-6 overflow-x-auto rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50">
              <th className="px-4 py-3 font-medium text-zinc-900">Time</th>
              <th className="px-4 py-3 font-medium text-zinc-900">Admin</th>
              <th className="px-4 py-3 font-medium text-zinc-900">Role</th>
              <th className="px-4 py-3 font-medium text-zinc-900">Action</th>
              <th className="px-4 py-3 font-medium text-zinc-900">Resource</th>
              <th className="px-4 py-3 font-medium text-zinc-900">ID</th>
            </tr>
          </thead>
          <tbody>
            {actions.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                  No actions recorded yet.
                </td>
              </tr>
            ) : (
              actions.map((row) => (
                <tr key={row.id} className="border-b border-zinc-100">
                  <td className="whitespace-nowrap px-4 py-2 text-zinc-600">
                    {new Date(row.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-2 font-medium text-zinc-900">{row.admin_email}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.role ?? '—'}</td>
                  <td className="px-4 py-2 text-zinc-900">{row.action_type}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.resource_type ?? '—'}</td>
                  <td className="px-4 py-2 text-zinc-600">{row.resource_id ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-4 text-xs text-zinc-500">
        <Link href="/admin" className="underline hover:no-underline">Back to Dashboard</Link>
      </p>
    </div>
  )
}
