'use client'

/**
 * SignOffControls — the principal broker's per-item stamp, mounted in the
 * `action` slot of each sign-off QueueRow (see ./page.tsx).
 *
 * 11F: taken off shadcn and onto the LOCKED admin v2 language
 * (design_system/admin/ADMIN_UI.md). Presentation only — recordPrincipalReview,
 * the sent-back reason prompt, the failure alert and the reload all run exactly
 * as before, and both button words are unchanged.
 *
 * The sign-off button loses its solid green. §1 of the lock reserves
 * green/amber/red for STATUS semantics and gives interactive things ONE accent,
 * so the primary action is the accent button — and it stays the file's single
 * primary (ci:admin-ui rule C), with "Send back" quiet. The green also could
 * not have survived as an inline background anyway: an inline style outranks
 * .av2-btn:hover and would have left the control dead under the pointer.
 *
 * The h-11 / sm:h-8 pair stays: 44px under a thumb (WCAG 2.5.8), tight in a
 * 48px desktop queue row.
 */

import { useTransition } from 'react'
import { Button } from '@/components/admin/v2'
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
        className="h-11 flex-1 sm:h-8 sm:flex-none"
      >
        {pending ? '…' : 'Sign off'}
      </Button>
      <Button
        variant="quiet"
        disabled={pending}
        onClick={sendBack}
        className="h-11 flex-1 sm:h-8 sm:flex-none"
      >
        Send back
      </Button>
    </div>
  )
}
