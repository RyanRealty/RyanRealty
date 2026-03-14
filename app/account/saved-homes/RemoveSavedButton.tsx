'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unsaveListing } from '@/app/actions/saved-listings'
import { Button } from "@/components/ui/button"

type Props = { listingKey: string }

export default function RemoveSavedButton({ listingKey }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleRemove() {
    startTransition(async () => {
      await unsaveListing(listingKey)
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      onClick={handleRemove}
      disabled={pending}
      className="mt-2 text-sm font-medium text-muted-foreground hover:text-destructive disabled:opacity-50"
    >
      {pending ? 'Removing…' : 'Remove from saved'}
    </Button>
  )
}
