'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { removeRecentListingView } from '@/app/actions/dashboard-history'

type RemoveViewedButtonProps = {
  activityId: string
}

export default function RemoveViewedButton({ activityId }: RemoveViewedButtonProps) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleRemove() {
    startTransition(async () => {
      await removeRecentListingView(activityId)
      router.refresh()
    })
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={handleRemove}
      disabled={pending}
      className="text-muted-foreground hover:text-destructive"
    >
      {pending ? 'Removing…' : 'Remove'}
    </Button>
  )
}
