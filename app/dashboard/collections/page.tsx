import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getUserCollections } from '@/app/actions/collections'
import { getListingTiles } from '@/lib/data'
import CreateCollectionForm from '@/components/dashboard/CreateCollectionForm'
import CollectionDeleteButton from '@/components/dashboard/CollectionDeleteButton'

export const metadata: Metadata = {
  title: 'My Collections',
  description: 'Organize your saved homes into collections at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function DashboardCollectionsPage() {
  const session = await getSession()
  if (!session?.user) redirect('/login?next=/dashboard/collections')

  const { data: collections } = await getUserCollections()

  // Hydrate up to 4 preview photos per collection in one read.
  const previewKeys = [...new Set(collections.flatMap((c) => c.listing_keys.slice(0, 4)))]
  const previewTiles = previewKeys.length
    ? await getListingTiles({ listingKeys: previewKeys, status: 'all', limit: 400 })
    : []
  const photoByKey = new Map(previewTiles.map((t) => [t.listingKey, t.photoUrl]))

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">My collections</h1>
          <p className="mt-1 text-muted-foreground">
            Group your saved homes into lists. Build one for each search, neighborhood, or shortlist.
          </p>
        </div>
        <CreateCollectionForm />
      </div>

      {collections.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">You haven&apos;t created a collection yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Create one above, then add homes from your{' '}
            <Link href="/dashboard/saved" className="font-medium text-primary underline-offset-4 hover:underline">
              saved homes
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {collections.map((c) => {
            const previews = c.listing_keys.slice(0, 4)
            const count = c.listing_keys.length
            return (
              <div key={c.id} className="rounded-xl border border-border bg-card shadow-sm ring-1 ring-foreground/5">
                <Link href={`/dashboard/collections/${c.id}`} className="block">
                  <div className="grid aspect-[16/9] grid-cols-2 grid-rows-2 gap-px overflow-hidden rounded-t-xl bg-muted">
                    {previews.length > 0 ? (
                      previews.map((k) => {
                        const photo = photoByKey.get(k)
                        return (
                          <div
                            key={k}
                            className={`relative bg-muted ${previews.length === 1 ? 'col-span-2 row-span-2' : ''}`}
                          >
                            {photo ? (
                              <Image src={photo} alt="" fill className="object-cover" sizes="200px" />
                            ) : (
                              <div className="absolute inset-0 bg-gradient-to-br from-muted to-muted-foreground/15" />
                            )}
                          </div>
                        )
                      })
                    ) : (
                      <div className="col-span-2 row-span-2 flex items-center justify-center text-sm text-muted-foreground">
                        No homes yet
                      </div>
                    )}
                  </div>
                </Link>
                <div className="p-4">
                  <Link href={`/dashboard/collections/${c.id}`} className="block min-w-0">
                    <div className="truncate font-semibold text-foreground">{c.name}</div>
                    {c.description ? (
                      <div className="truncate text-sm text-muted-foreground">{c.description}</div>
                    ) : null}
                  </Link>
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground tabular-nums">
                      {count} {count === 1 ? 'home' : 'homes'}
                    </span>
                    <CollectionDeleteButton collectionId={c.id} />
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}
