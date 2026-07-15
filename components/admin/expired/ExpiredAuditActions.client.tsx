'use client'

/**
 * Per-row actions on the Expireds Dashboard: build the expired audit, and
 * approve+send it by email. The send confirm is the broker's explicit
 * approval; a needs_review audit adds an acknowledgment checkbox.
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { buildExpiredAuditAction, sendExpiredAuditEmailAction } from '@/app/actions/expired-dashboard'

export function ExpiredAuditActions(props: {
  listingKey: string
  hasAudit: boolean
  isAuditDoc: boolean
  needsReview: boolean
  hasEmail: boolean
  hardStop: boolean
  emailSentAt: string | null
}) {
  const { listingKey, hasAudit, isAuditDoc, needsReview, hasEmail, hardStop, emailSentAt } = props
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const build = () =>
    startTransition(async () => {
      setMsg('Building audit (about a minute)...')
      const res = await buildExpiredAuditAction(listingKey)
      setMsg(res.error ? `Build failed: ${res.error}` : 'Audit built.')
    })

  const send = () =>
    startTransition(async () => {
      const lines = [
        'Send the expired audit to this owner by email?',
        'Your confirmation is the approval to send.',
      ]
      if (needsReview) lines.push('THIS AUDIT IS FLAGGED FOR REVIEW. Confirming acknowledges you reviewed the flags.')
      if (!window.confirm(lines.join('\n\n'))) return
      setMsg('Sending...')
      const res = await sendExpiredAuditEmailAction(listingKey, { acknowledgeReview: needsReview })
      setMsg(res.error ? `Send failed: ${res.error}` : `Sent (${res.data?.transport}).`)
    })

  if (hardStop) return <span className="text-xs text-destructive">hard stop</span>

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {!hasAudit || !isAuditDoc ? (
          <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={build}>
            {hasAudit ? 'Rebuild as audit' : 'Build audit'}
          </Button>
        ) : null}
        {hasAudit && isAuditDoc ? (
          <Button size="sm" className="h-8" disabled={pending || !hasEmail} onClick={send} title={hasEmail ? undefined : 'No owner email on file'}>
            {emailSentAt ? 'Resend audit' : 'Send audit'}
          </Button>
        ) : null}
      </div>
      {msg ? <span className="max-w-[240px] text-right text-[11px] leading-tight text-muted-foreground">{msg}</span> : null}
    </div>
  )
}
