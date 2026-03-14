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
      <h1 className="text-2xl font-bold tracking-tight text-foreground">My saved searches</h1>
      <p className="mt-1 text-muted-foreground">
        Quick links to your saved searches. Create a search with our advanced filters (city, price, beds, status, and more), then save it here.
      </p>
      <div className="mt-4">
        <Link
          href="/listings"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Create & save a search
        </Link>
        <p className="mt-1.5 text-xs text-muted-foreground">
          Use the search page to set filters, then click “Save this search” to add it to this list.
        </p>
      </div>
      {searches.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">You haven’t saved any searches yet.</p>
          <Link
            href="/listings"
            className="mt-4 inline-block rounded-lg border border-border bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
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
