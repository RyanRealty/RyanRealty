'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { setTcChecklistStatus } from '@/app/actions/tc'

export function SignOffControls({ itemId }: { itemId: string }) {
  const [pending, startTransition] = useTransition()

  const signOff = () =>
    startTransition(async () => {
      const res = await setTcChecklistStatus(itemId, 'completed')
      if (!res.ok) window.alert(res.error || 'Failed')
      else window.location.reload()
    })

  const sendBack = () => {
    const reason = window.prompt('Reason for sending back to the broker:', '')
    if (reason === null) return
    startTransition(async () => {
      const res = await setTcChecklistStatus(itemId, 'required', reason || undefined)
      if (!res.ok) window.alert(res.error || 'Failed')
      else window.location.reload()
    })
  }

  return (
    <div className="flex shrink-0 gap-2">
      <Button size="sm" disabled={pending} onClick={signOff} className="bg-success text-success-foreground hover:bg-success/90">
        {pending ? '…' : 'Sign off'}
      </Button>
      <Button size="sm" variant="outline" disabled={pending} onClick={sendBack}>
        Send back
      </Button>
    </div>
  )
}
