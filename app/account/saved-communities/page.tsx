import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { parseEntityKey } from '@/lib/slug'
import RemoveSavedCommunityButton from './RemoveSavedCommunityButton'

export const metadata: Metadata = {
  title: 'Saved communities',
  description: 'Your saved favorite communities at Ryan Realty.',
}

export default async function SavedCommunitiesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const savedKeys = await getSavedCommunityKeys()

  return (
    <>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">Saved communities</h1>
      <p className="mt-1 text-muted-foreground">
        Your favorite neighborhoods and communities. Remove any from here or from the community tile.
      </p>
      {savedKeys.length === 0 ? (
        <div className="mt-8 rounded-lg border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">You haven’t saved any communities yet.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Browse home
          </Link>
        </div>
      ) : (
        <ul className="mt-8 space-y-3">
          {savedKeys.map((entityKey) => {
            const { city, subdivision } = parseEntityKey(entityKey)
            const slug = entityKey.replace(':', '/')
            const href = `/search/${slug}`
            return (
              <li
                key={entityKey}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-card px-4 py-3 shadow-sm"
              >
                <Link href={href} className="font-medium text-foreground hover:text-muted-foreground">
                  {subdivision}, {city}
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    href={href}
                    className="text-sm font-medium text-muted-foreground hover:text-muted-foreground"
                  >
                    View →
                  </Link>
                  <RemoveSavedCommunityButton entityKey={entityKey} />
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
