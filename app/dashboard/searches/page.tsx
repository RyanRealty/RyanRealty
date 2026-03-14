import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedSearches } from '@/app/actions/saved-searches'
import DashboardSearchesList from '@/components/dashboard/DashboardSearchesList'

export const metadata: Metadata = {
  title: 'Saved Searches',
  description: 'Your saved listing searches at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardSearchesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login')

  const searches = await getSavedSearches()

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Saved Searches</h1>
      <p className="mt-1 text-muted-foreground">
        We&apos;ll notify you when new homes match. View results or edit filters.
      </p>

      <div className="mt-4">
        <Link
          href="/homes-for-sale"
          className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent/90"
        >
          Create new search
        </Link>
      </div>

      {searches.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">
            Set up a search and we&apos;ll notify you when new homes match.
          </p>
          <Link
            href="/homes-for-sale"
            className="mt-4 inline-block rounded-lg border border-primary/20 bg-card px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted"
          >
            Go to search
          </Link>
        </div>
      ) : (
        <DashboardSearchesList searches={searches} className="mt-8" />
      )}
    </>
  )
}
