'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { recordPrincipalReview } from '@/app/actions/tc-signoff'

export function SignOffControls({ itemId }: { itemId: string }) {
  const [pending, startTransition] = useTransition()

  const signOff = () =>
    startTransition(async () => {
      const res = await recordPrincipalReview(itemId, 'approved')
      if (!res.ok) window.alert(res.error || 'Failed')
      else window.location.reload()
    })

  const sendBack = () => {
    const reason = window.prompt('Reason for sending back to the broker:', '')
    if (reason === null) return
    startTransition(async () => {
      const res = await recordPrincipalReview(itemId, 'sent_back', reason || undefined)
      if (!res.ok) window.alert(res.error || 'Failed')
      else window.location.reload()
    })
  }

  return (
    <div className="flex w-full shrink-0 gap-2 sm:w-auto">
      <Button
        disabled={pending}
        onClick={signOff}
        className="h-11 flex-1 bg-success text-success-foreground hover:bg-success/90 sm:h-8 sm:flex-none"
      >
        {pending ? '…' : 'Sign off'}
      </Button>
      <Button
        variant="outline"
        disabled={pending}
        onClick={sendBack}
        className="h-11 flex-1 sm:h-8 sm:flex-none"
      >
        Send back
      </Button>
    </div>
  )
}
