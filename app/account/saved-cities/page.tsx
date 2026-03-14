import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedCitySlugs } from '@/app/actions/saved-cities'
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
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Saved cities</h1>
      <p className="mt-1 text-muted-foreground">
        Your favorite cities. Remove any from here or from the city tile.
      </p>
      {savedSlugs.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">You haven’t saved any cities yet.</p>
          <Link
            href="/cities"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Browse cities
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {savedSlugs.map((slug) => (
            <li
              key={slug}
              className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
            >
              <Link href={`/cities/${slug}`} className="font-medium text-foreground hover:text-muted-foreground">
                {slugToName(slug)}
              </Link>
              <div className="flex items-center gap-2">
                <Link
                  href={`/cities/${slug}`}
                  className="text-sm font-medium text-muted-foreground hover:text-muted-foreground"
                >
                  View →
                </Link>
                <RemoveSavedCityButton citySlug={slug} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
