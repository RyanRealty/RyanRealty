'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { addToCollection, removeFromCollection } from '@/app/actions/collections'
import { Button } from '@/components/ui/button'

/**
 * Add or remove a single listing from a collection. Used on the collection
 * detail page: "Remove" on homes already in the collection, "Add" on the user's
 * saved homes that aren't in it yet.
 */
export default function CollectionListingButton({
  collectionId,
  listingKey,
  mode,
}: {
  collectionId: string
  listingKey: string
  mode: 'add' | 'remove'
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleClick() {
    startTransition(async () => {
      if (mode === 'add') await addToCollection(collectionId, listingKey)
      else await removeFromCollection(collectionId, listingKey)
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant={mode === 'add' ? 'default' : 'ghost'}
      size="sm"
      onClick={handleClick}
      disabled={pending}
      className={mode === 'remove' ? 'text-muted-foreground hover:text-destructive' : undefined}
    >
      {pending ? '…' : mode === 'add' ? 'Add to collection' : 'Remove'}
    </Button>
  )
}
