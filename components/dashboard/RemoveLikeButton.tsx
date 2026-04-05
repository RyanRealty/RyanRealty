'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { removeLikeItem } from '@/app/actions/dashboard-likes'

type RemoveLikeButtonProps = {
  kind: 'listing' | 'city' | 'community'
  id: string
}

export default function RemoveLikeButton({ kind, id }: RemoveLikeButtonProps) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function handleRemove() {
    startTransition(async () => {
      await removeLikeItem(kind, id)
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
