'use client'

/**
 * One sendable row in the expired-outreach queue: merged-message preview and
 * the guarded Send. Every guard re-runs server-side; this component only
 * confirms intent and reports the outcome.
 */

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { sendExpiredIntroAction } from '@/app/actions/expired-outreach'

export function ExpiredOutreachSendButton(props: {
  listingKey: string
  address: string
  phoneMasked: string
  previewBody: string
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [sent, setSent] = useState(false)

  function send() {
    const ok = confirm(
      `Send the intro text for ${props.address} to ${props.phoneMasked}?\n\n"${props.previewBody}"`,
    )
    if (!ok) return
    startTransition(async () => {
      const res = await sendExpiredIntroAction(props.listingKey)
      if (res.ok) {
        setSent(true)
        toast.success(`Sent to ${props.phoneMasked}.`)
        router.refresh()
      } else {
        toast.error(res.error)
      }
    })
  }

  return (
    <Button size="sm" onClick={send} disabled={pending || sent} className="h-11">
      {sent ? 'Sent' : pending ? 'Sending…' : 'Send intro text'}
    </Button>
  )
}
