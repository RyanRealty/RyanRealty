'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { unhideListing } from '@/app/actions/hidden-listings'
import { Button } from '@/components/ui/button'

type Props = { listingKey: string }

export default function UnhideButton({ listingKey }: Props) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleUnhide() {
    startTransition(async () => {
      await unhideListing(listingKey)
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleUnhide}
      disabled={pending}
      className="mt-2"
    >
      {pending ? 'Unhiding…' : 'Unhide'}
    </Button>
  )
}
