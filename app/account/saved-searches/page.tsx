import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedSearches } from '@/app/actions/saved-searches'
import SavedSearchesList from './SavedSearchesList'

export const metadata: Metadata = {
  title: 'My saved searches',
  description: 'Your saved listing searches at Ryan Realty.',
}

export default async function SavedSearchesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const searches = await getSavedSearches()

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">My saved searches</h1>
      <p className="mt-1 text-zinc-600">
        Quick links to your saved searches. Create a search with our advanced filters (city, price, beds, status, and more), then save it here.
      </p>
      <div className="mt-4">
        <Link
          href="/listings"
          className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-zinc-800"
        >
          Create & save a search
        </Link>
        <p className="mt-1.5 text-xs text-zinc-500">
          Use the search page to set filters, then click “Save this search” to add it to this list.
        </p>
      </div>
      {searches.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-zinc-600">You haven’t saved any searches yet.</p>
          <Link
            href="/listings"
            className="mt-4 inline-block rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Go to search
          </Link>
        </div>
      ) : (
        <SavedSearchesList searches={searches} />
      )}
    </main>
  )
}
