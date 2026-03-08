import Link from 'next/link'
import { listSubdivisionsWithFlags } from '../../actions/subdivision-flags'
import ResortCommunityToggle from './ResortCommunityToggle'
import SeedResortButton from './SeedResortButton'

export const dynamic = 'force-dynamic'

export default async function AdminResortCommunitiesPage() {
  const rows = await listSubdivisionsWithFlags()

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-zinc-900">Resort communities</h1>
      <p className="mt-2 text-zinc-600">
        Flag subdivisions as resort communities. When flagged, the community page shows the full amenities & lifestyle section (attractions, dining) and resort schema. Unflagged subdivisions use the standard community page.
      </p>
      <p className="mt-2 text-sm text-zinc-500">
        <Link href="/admin" className="underline">← Admin</Link>
      </p>

      <section className="mt-6 flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4">
        <span className="text-sm text-zinc-600">Copy the built-in Oregon resort list into the database so you can edit it here.</span>
        <SeedResortButton />
      </section>

      <section className="mt-8 rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-zinc-200">
            <thead className="bg-zinc-50">
              <tr>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">City</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Subdivision</th>
                <th scope="col" className="px-4 py-3 text-left text-xs font-medium uppercase text-zinc-500">Resort</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-sm text-zinc-500">
                    No subdivisions found. Sync listings first so city/subdivision pairs appear.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.entity_key} className="hover:bg-zinc-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-zinc-900">{r.city}</td>
                    <td className="px-4 py-3 text-sm text-zinc-900">{r.subdivision}</td>
                    <td className="px-4 py-3">
                      <ResortCommunityToggle entityKey={r.entity_key} initialResort={r.is_resort} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <p className="mt-4 text-xs text-zinc-500">
        If no flags are set in the database, the site falls back to a built-in list of Oregon resort communities. Once you set at least one flag here, only DB flags are used.
      </p>
    </main>
  )
}
