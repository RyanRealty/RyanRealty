import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getSavedCommunityKeys } from '@/app/actions/saved-communities'
import { parseEntityKey, listingsBrowsePath } from '@/lib/slug'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import RemoveSavedCommunityButton from './RemoveSavedCommunityButton'

export const metadata: Metadata = {
  title: 'Saved communities',
  description: 'Your saved favorite communities at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function SavedCommunitiesPage() {
  const session = await getSession()
  if (!session?.user) redirect('/')

  const savedKeys = await getSavedCommunityKeys()

  return (
    <div className="space-y-8">
      {/* ── Header ── */}
      <header className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Saved communities</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          The neighborhoods and communities you follow. Remove any here or from its community tile.
        </p>
      </header>

      {/* ── Communities ── */}
      <section>
        <div className="mb-3 flex items-end justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-foreground">Communities you follow</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {savedKeys.length === 0
                ? 'Nothing saved yet.'
                : `${savedKeys.length} ${savedKeys.length === 1 ? 'community' : 'communities'} saved.`}
            </p>
          </div>
        </div>

        {savedKeys.length === 0 ? (
          <Card className="flex flex-col items-center gap-3 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">No saved communities yet.</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Tap the heart on any community to follow it here and keep tabs on new listings.
            </p>
            <Button asChild size="sm">
              <Link href={listingsBrowsePath()}>Browse homes</Link>
            </Button>
          </Card>
        ) : (
          <Card className="divide-y divide-border overflow-hidden p-0">
            {savedKeys.map((entityKey) => {
              const { city, subdivision } = parseEntityKey(entityKey)
              const slug = entityKey.replace(':', '/')
              const href = `/homes-for-sale/${slug}`
              return (
                <div
                  key={entityKey}
                  className="flex min-h-14 items-center justify-between gap-3 px-4 py-3 transition-colors hover:bg-muted/40"
                >
                  <Link href={href} className="min-w-0 flex-1">
                    <span className="block break-words text-sm font-medium text-foreground">{subdivision}</span>
                    <span className="block break-words text-xs text-muted-foreground">{city}</span>
                  </Link>
                  <div className="flex shrink-0 items-center gap-3">
                    <Link href={href} className="text-sm font-medium text-primary hover:underline">
                      View
                    </Link>
                    <RemoveSavedCommunityButton entityKey={entityKey} />
                  </div>
                </div>
              )
            })}
          </Card>
        )}
      </section>
    </div>
  )
}
