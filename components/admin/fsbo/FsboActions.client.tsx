'use client'

/**
 * Per-row actions on the FSBO Dashboard: build the CMA, approve+send it by
 * email, and send the initial-contact SMS. Every send is an explicit click
 * with a confirm; guards re-run server-side, fail-closed.
 */

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { buildFsboCmaAction, sendFsboCmaEmailAction, sendFsboIntroSmsAction } from '@/app/actions/fsbo-dashboard'

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
  const { fsboUrl, hasCma, needsReview, hasEmail, hasPhone, hardStop, smsSentAt, emailSentAt } = props
  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<string | null>(null)

  const build = () =>
    startTransition(async () => {
      setMsg('Building CMA (about a minute)...')
      const res = await buildFsboCmaAction(fsboUrl)
      setMsg(res.error ? `Build failed: ${res.error}` : 'CMA built.')
    })

  const sendEmail = () =>
    startTransition(async () => {
      const lines = ['Send the CMA to this owner by email?', 'Your confirmation is the approval to send.']
      if (needsReview) lines.push('THIS CMA IS FLAGGED FOR REVIEW. Confirming acknowledges you reviewed the flags.')
      if (!window.confirm(lines.join('\n\n'))) return
      setMsg('Sending...')
      const res = await sendFsboCmaEmailAction(fsboUrl, { acknowledgeReview: needsReview })
      setMsg(res.error ? `Send failed: ${res.error}` : `Sent (${res.data?.transport}).`)
    })

  const sendSms = () =>
    startTransition(async () => {
      if (!window.confirm('Send the FSBO intro text to this owner?\n\nYour confirmation is the approval to send.')) return
      setMsg('Sending text...')
      const res = await sendFsboIntroSmsAction(fsboUrl)
      setMsg(res.ok ? 'Text sent.' : `Text failed: ${res.error}`)
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
          <Button size="sm" className="h-8" disabled={pending || !hasEmail} onClick={sendEmail} title={hasEmail ? undefined : 'No owner email on file'}>
            {emailSentAt ? 'Resend CMA' : 'Send CMA'}
          </Button>
        )}
        <Button size="sm" variant={smsSentAt ? 'outline' : 'default'} className="h-8" disabled={pending || !hasPhone || !!smsSentAt} onClick={sendSms} title={hasPhone ? undefined : 'No owner phone on file'}>
          {smsSentAt ? 'Text sent' : 'Send text'}
        </Button>
      </div>
      {msg ? <span className="max-w-[240px] text-right text-[11px] leading-tight text-muted-foreground">{msg}</span> : null}
    </div>
  )
}
