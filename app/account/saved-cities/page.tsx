import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import RemoveSavedCityButton from './RemoveSavedCityButton'

export const metadata: Metadata = {
  title: 'Saved cities',
  description: 'Your saved favorite cities at Ryan Realty.',
}

function slugToName(slug: string): string {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

export default async function SavedCitiesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const savedSlugs = await getSavedCitySlugs()

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Saved cities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The places you follow. Remove any from here or from the city tile.
        </p>
      </header>

      {/* ── Saved cities ── */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Cities you follow</h2>
            {savedSlugs.length > 0 ? (
              <p className="mt-0.5 text-sm text-muted-foreground">
                {savedSlugs.length} {savedSlugs.length === 1 ? 'city' : 'cities'} saved.
              </p>
            ) : null}
          </div>
        </div>

        {savedSlugs.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No saved cities yet.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Follow a city to keep it here and jump back to its homes and market data.
            </p>
            <Button asChild size="sm">
              <Link href="/cities">Browse cities</Link>
            </Button>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            {savedSlugs.map((slug) => (
              <div key={slug} className="flex min-h-14 items-center justify-between gap-3 px-4 py-3">
                <Link
                  href={`/cities/${slug}`}
                  className="min-w-0 flex-1 break-words text-sm font-medium text-foreground transition-colors hover:text-primary"
                >
                  {slugToName(slug)}
                </Link>
                <div className="flex shrink-0 items-center gap-1">
                  <Button asChild variant="ghost" size="sm">
                    <Link href={`/cities/${slug}`}>View</Link>
                  </Button>
                  <RemoveSavedCityButton citySlug={slug} />
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  )
}
