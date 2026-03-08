import Link from 'next/link'
import { getBrokersForAdmin } from '../../actions/brokers'

export const dynamic = 'force-dynamic'

export default async function AdminBrokersPage() {
  const brokers = await getBrokersForAdmin()

  return (
    <main className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-zinc-900">Brokers</h1>
        <Link
          href="/admin/brokers/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700"
        >
          Add broker
        </Link>
      </div>
      <p className="mt-2 text-sm text-zinc-500">
        Team members appear on the public <Link href="/team" className="text-emerald-600 hover:underline">/team</Link> page. Required: display name, title, Oregon license number.
      </p>
      <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200 bg-white">
        <table className="min-w-full divide-y divide-zinc-200">
          <thead>
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Name</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Title</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Slug</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Status</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Profile</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {brokers.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-zinc-500">
                  No brokers yet. Click &quot;Add broker&quot; to create one (required: display name, slug, title, Oregon license number).
                </td>
              </tr>
            ) : (
              brokers.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 text-sm font-medium text-zinc-900">{b.display_name}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{b.title}</td>
                  <td className="px-4 py-3 text-sm text-zinc-600">{b.slug}</td>
                  <td className="px-4 py-3">
                    {b.is_active ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs text-emerald-800">Active</span>
                    ) : (
                      <span className="rounded bg-zinc-200 px-1.5 py-0.5 text-xs text-zinc-600">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {b.is_active && (
                      <Link href={`/team/${b.slug}`} className="text-sm text-emerald-600 hover:underline" target="_blank" rel="noopener">
                        View
                      </Link>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/brokers/${b.id}`} className="text-sm font-medium text-zinc-700 hover:text-zinc-900">
                      Edit
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  )
}
