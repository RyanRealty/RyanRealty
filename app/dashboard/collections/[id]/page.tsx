import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getCollectionById } from '@/app/actions/collections'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getListingTiles } from '@/lib/data'
import { tileToCardData } from '@/lib/site/listing-card'
import ListingCard, { type ListingCardData } from '@/components/site/ListingCard'
import CollectionDeleteButton from '@/components/dashboard/CollectionDeleteButton'
import CollectionListingButton from '@/components/dashboard/CollectionListingButton'

export const metadata: Metadata = {
  title: 'Collection',
  description: 'Your saved-home collection at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session?.user) redirect(`/login?next=/dashboard/collections/${id}`)

  const { data: collection } = await getCollectionById(id)
  if (!collection) notFound()

  // Homes in this collection.
  const inTiles = collection.listing_keys.length
    ? await getListingTiles({ listingKeys: collection.listing_keys, status: 'all', limit: 200 })
    : []
  const inCards: ListingCardData[] = inTiles
    .map((t) => tileToCardData(t))
    .filter((c): c is ListingCardData => c !== null)

  // Saved homes the user could still add (not already in the collection).
  const savedKeys = await getSavedListingKeys()
  const addableKeys = savedKeys.filter((k) => !collection.listing_keys.includes(k))
  const addableTiles = addableKeys.length
    ? await getListingTiles({ listingKeys: addableKeys, status: 'all', limit: 200 })
    : []
  const addableCards: ListingCardData[] = addableTiles
    .map((t) => tileToCardData(t))
    .filter((c): c is ListingCardData => c !== null)

  return (
    <>
      <Link
        href="/dashboard/collections"
        className="text-sm font-medium text-muted-foreground underline-offset-4 hover:underline"
      >
        ← All collections
      </Link>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{collection.name}</h1>
          {collection.description ? (
            <p className="mt-1 text-muted-foreground">{collection.description}</p>
          ) : null}
          <p className="mt-1 text-sm text-muted-foreground tabular-nums">
            {inCards.length} {inCards.length === 1 ? 'home' : 'homes'}
          </p>
        </div>
        <CollectionDeleteButton collectionId={collection.id} redirectTo="/dashboard/collections" />
      </div>

      {inCards.length === 0 ? (
        <div className="mt-8 rounded-xl border border-border bg-muted p-8 text-center">
          <p className="text-muted-foreground">This collection is empty.</p>
          <p className="mt-1 text-sm text-muted-foreground">Add homes from your saved list below.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {inCards.map((card) => (
            <div key={card.listingKey}>
              <ListingCard listing={card} />
              <div className="mt-2">
                <CollectionListingButton collectionId={collection.id} listingKey={card.listingKey} mode="remove" />
              </div>
            </div>
          ))}
        </div>
      )}

      {addableCards.length > 0 ? (
        <section className="mt-12 border-t border-border pt-8">
          <h2 className="text-lg font-semibold text-foreground">Add from your saved homes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Saved homes that aren&apos;t in this collection yet.
          </p>
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {addableCards.map((card) => (
              <div key={card.listingKey}>
                <ListingCard listing={card} />
                <div className="mt-2">
                  <CollectionListingButton collectionId={collection.id} listingKey={card.listingKey} mode="add" />
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  )
}
