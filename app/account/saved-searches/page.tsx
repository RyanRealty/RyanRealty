import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedSearches } from '@/app/actions/saved-searches'
import SavedSearchControls from './SavedSearchControls'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { listingsBrowsePath } from '@/lib/slug'

export const metadata: Metadata = {
  title: 'My saved searches',
  description: 'Your saved listing searches at Ryan Realty.',
}

export default async function SavedSearchesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const searches = await getSavedSearches()

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Saved searches</h1>
          <p className="mt-1 text-sm text-muted-foreground">We watch these for new and updated listings that match.</p>
        </div>
        <Button asChild size="sm">
          <Link href={listingsBrowsePath()}>Start a search</Link>
        </Button>
      </header>

      {/* ── Saved searches ── */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Your searches</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Pause or resume alerts, change how often we email, rename, or remove a search.
            </p>
          </div>
        </div>
        {searches.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No saved searches yet.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Save any search to get notified when matching homes hit the market.
            </p>
            <Button asChild size="sm">
              <Link href={listingsBrowsePath()}>Start a search</Link>
            </Button>
          </Card>
        ) : (
          <SavedSearchControls searches={searches} />
        )}
      </section>
    </div>
  )
}
