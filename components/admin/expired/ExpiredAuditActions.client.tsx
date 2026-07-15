'use client'

/**
 * Per-row actions on the Expireds Dashboard: build the expired audit, then
 * compose-and-send it by email or text (template or free-typed) via the
 * shared SendDocDialog. The send click is the approval.
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { buildExpiredAuditAction } from '@/app/actions/expired-dashboard'
import { SendDocDialog } from '@/components/admin/SendDocDialog.client'

export function ExpiredAuditActions(props: {
  listingKey: string
  hasAudit: boolean
  isAuditDoc: boolean
  needsReview: boolean
  hasEmail: boolean
  hardStop: boolean
  emailSentAt: string | null
}) {
  const { listingKey, hasAudit, isAuditDoc, hardStop, emailSentAt } = props
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const build = () =>
    startTransition(async () => {
      setMsg('Building audit (about a minute)...')
      const res = await buildExpiredAuditAction(listingKey)
      setMsg(res.error ? `Build failed: ${res.error}` : 'Audit built.')
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
          <SendDocDialog kind="expired" id={listingKey} buttonLabel={emailSentAt ? 'Send again' : 'Send audit'} />
        ) : null}
      </div>
      {msg ? <span className="max-w-[240px] text-right text-[11px] leading-tight text-muted-foreground">{msg}</span> : null}
    </div>
  )
}
