'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { deleteCollection } from '@/app/actions/collections'
import { Button } from '@/components/ui/button'

/** Delete a whole collection, with an inline confirm step. */
export default function CollectionDeleteButton({
  collectionId,
  redirectTo,
}: {
  collectionId: string
  /** Where to send the user after delete (e.g. back to the collections list). */
  redirectTo?: string
}) {
  const [confirm, setConfirm] = useState(false)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleDelete() {
    if (!confirm) {
      setConfirm(true)
      return
    }
    startTransition(async () => {
      await deleteCollection(collectionId)
      if (redirectTo) router.push(redirectTo)
      else router.refresh()
    })
  }

  if (confirm) {
    return (
      <span className="inline-flex items-center gap-2">
        <Button type="button" variant="destructive" size="sm" onClick={handleDelete} disabled={pending}>
          {pending ? 'Deleting…' : 'Delete'}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(false)} disabled={pending}>
          Cancel
        </Button>
      </span>
    )
  }

  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => setConfirm(true)} className="text-muted-foreground hover:text-destructive">
      Delete
    </Button>
  )
}
