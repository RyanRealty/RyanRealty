/**
 * /account/collections/[id] — private Saved affordance, on the v3 barrel.
 *
 * Saved is an affordance, not a sixth marketing destination. No Stage, no
 * Instrument, no capture Sheet, no invented homepage. Dual objectives
 *: visitor: work a specific shortlist and step into any
 * home. machine: turn curated shortlist state into listing-detail re-entries.
 * Exits: listing detail, /compare, /account/collections.
 *
 * THE PAGE CONTRACT, carried across: getSession gate, getCollectionById,
 * getSavedListingKeys for addable homes, getListingTiles, CollectionDeleteButton,
 * CollectionListingButton mode="add" and mode="remove", noindex via account layout.
 *
 * Chrome: root layout mounts V3Chrome. This page does not remount it. V3Footer
 * sits outside <main> via AccountFrame. No V3Breadcrumb (AccountNav is the trail).
 * No on-page Value my home: the sticky chrome already carries that ask.
 *
 * KB-era deletion: ListingCard from the legacy components/site register. Homes
 * are Ledger doors. Add and remove stay working controls on the same keys.
 */

import type { Metadata } from 'next'
import { notFound, redirect } from 'next/navigation'
import { getSession } from '@/app/actions/auth'
import { getCollectionById } from '@/app/actions/collections'
import { getSavedListingKeys } from '@/app/actions/saved-listings'
import { getListingTiles } from '@/lib/data'
import { v3Text, V3Ledger, V3Quiet } from '@/components/site/v3'
import CollectionDeleteButton from '@/components/dashboard/CollectionDeleteButton'
import CollectionListingButton from '@/components/dashboard/CollectionListingButton'
import { AccountFrame } from '@/app/account/_v3/AccountFrame'
import { tileLabel, tileToSavedLedgerRow } from '@/app/account/_v3/listing-rows'

export const metadata: Metadata = {
  title: 'Collection',
  description: 'Your saved-home collection at Ryan Realty.',
}

export const dynamic = 'force-dynamic'

export default async function CollectionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const session = await getSession()
  if (!session?.user) redirect(`/login?next=/account/collections/${id}`)

  const { data: collection } = await getCollectionById(id)
  if (!collection) notFound()

  const inTiles = collection.listing_keys.length
    ? await getListingTiles({ listingKeys: collection.listing_keys, status: 'all', limit: 200 })
    : []
  const inRows = inTiles.map(tileToSavedLedgerRow).filter((row): row is NonNullable<typeof row> => row !== null)
  const [firstIn, ...restIn] = inRows

  const savedKeys = await getSavedListingKeys()
  const addableKeys = savedKeys.filter((k) => !collection.listing_keys.includes(k))
  const addableTiles = addableKeys.length
    ? await getListingTiles({ listingKeys: addableKeys, status: 'all', limit: 200 })
    : []
  const addableRows = addableTiles
    .map(tileToSavedLedgerRow)
    .filter((row): row is NonNullable<typeof row> => row !== null)
  const [firstAddable, ...restAddable] = addableRows

  const name = collection.name.trim() || 'Collection'
  const description = collection.description?.trim()
  const countLabel = `${inTiles.length} ${inTiles.length === 1 ? 'home' : 'homes'}`

  return (
    <AccountFrame>
      <V3Quiet
        id="collection"
        eyebrow="Collection"
        heading={name}
        headingLevel={1}
        items={[
          ...(description ? [{ kind: 'prose' as const, body: description }] : []),
          { kind: 'prose', body: countLabel },
          { label: 'All collections', href: '/account/collections' },
          { label: 'Saved homes', href: '/account/saved-homes' },
          { label: 'Compare homes', href: '/compare' },
        ]}
      />

      <CollectionDeleteButton collectionId={collection.id} redirectTo="/account/collections" />

      {firstIn ? (
        <V3Ledger
          id="in-collection"
          heading={v3Text('Homes in this collection')}
          rows={[firstIn, ...restIn]}
        />
      ) : (
        <V3Ledger
          id="in-collection"
          heading={v3Text('Homes in this collection')}
          rows={[]}
          emptyMessage={v3Text(
            inTiles.length === 0
              ? 'This collection is empty. Add homes from your saved list below.'
              : 'Homes in this collection did not return an address in this refresh.',
          )}
        />
      )}

      {inTiles.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {inTiles.map((tile) => {
            const listingKey = (tile.listingKey || tile.listNumber || '').toString().trim()
            if (!listingKey) return null
            return (
              <li key={listingKey} className="flex min-h-11 items-center justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-muted-foreground">{tileLabel(tile)}</span>
                <CollectionListingButton collectionId={collection.id} listingKey={listingKey} mode="remove" />
              </li>
            )
          })}
        </ul>
      ) : null}

      {addableTiles.length > 0 ? (
        <>
          <V3Quiet
            id="add-intro"
            heading="Add from your saved homes"
            items={[
              {
                kind: 'prose',
                body: 'Saved homes that are not in this collection yet.',
              },
            ]}
          />
          {firstAddable ? (
            <V3Ledger
              id="addable"
              heading={v3Text('Saved homes you can add')}
              rows={[firstAddable, ...restAddable]}
            />
          ) : null}
          <ul className="mt-4 space-y-2">
            {addableTiles.map((tile) => {
              const listingKey = (tile.listingKey || tile.listNumber || '').toString().trim()
              if (!listingKey) return null
              return (
                <li key={listingKey} className="flex min-h-11 items-center justify-between gap-3">
                  <span className="min-w-0 truncate text-sm text-muted-foreground">{tileLabel(tile)}</span>
                  <CollectionListingButton collectionId={collection.id} listingKey={listingKey} mode="add" />
                </li>
              )
            })}
          </ul>
        </>
      ) : null}
    </AccountFrame>
  )
}
