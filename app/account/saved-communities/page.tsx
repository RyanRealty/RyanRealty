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
      <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Saved communities</h1>
      <p className="mt-1 text-zinc-600">
        Your favorite neighborhoods and communities. Remove any from here or from the community tile.
      </p>
      {savedKeys.length === 0 ? (
        <div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50 p-8 text-center">
          <p className="text-zinc-600">You haven’t saved any communities yet.</p>
          <Link
            href="/"
            className="mt-4 inline-block rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
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
                className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm"
              >
                <Link href={href} className="font-medium text-zinc-900 hover:text-zinc-700">
                  {subdivision}, {city}
                </Link>
                <div className="flex items-center gap-2">
                  <Link
                    href={href}
                    className="text-sm font-medium text-zinc-500 hover:text-zinc-700"
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
