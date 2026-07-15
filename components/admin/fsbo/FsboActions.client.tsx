'use client'

/**
 * Per-row actions on the FSBO Dashboard: build the CMA, then compose-and-send
 * by email or text (template or free-typed) via the shared SendDocDialog.
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { buildFsboCmaAction } from '@/app/actions/fsbo-dashboard'
import { SendDocDialog } from '@/components/admin/SendDocDialog.client'

export function FsboActions(props: {
  fsboUrl: string
  hasCma: boolean
  needsReview: boolean
  hasEmail: boolean
  hasPhone: boolean
  hardStop: boolean
  smsSentAt: string | null
  emailSentAt: string | null
}) {
  const { fsboUrl, hasCma, hardStop, smsSentAt, emailSentAt } = props
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const build = () =>
    startTransition(async () => {
      setMsg('Building CMA (about a minute)...')
      const res = await buildFsboCmaAction(fsboUrl)
      setMsg(res.error ? `Build failed: ${res.error}` : 'CMA built.')
    })

  if (hardStop) return <span className="text-xs text-destructive">hard stop</span>

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex gap-1.5">
        {!hasCma ? (
          <Button size="sm" variant="outline" className="h-8" disabled={pending} onClick={build}>
            Build CMA
          </Button>
        ) : (
          <SendDocDialog kind="fsbo" id={fsboUrl} buttonLabel={emailSentAt || smsSentAt ? 'Send again' : 'Send'} />
        )}
      </div>
      {msg ? <span className="max-w-[240px] text-right text-[11px] leading-tight text-muted-foreground">{msg}</span> : null}
    </div>
  )
}
