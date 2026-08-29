'use client'

/**
 * Shared From / Reply-To / signature controls for every batch email host
 * (people-list Batch Email and /admin/email/compose). The client never types a
 * From address. It picks the named Resend identity (default, volume-safe) or
 * the actor's Gmail mailbox, and whether the Gmail-matched signature is on.
 */

import { useEffect, useRef, useState } from 'react'
import { getBulkEmailSendOptionsAction } from '@/app/actions/crm-bulk'
import {
  GMAIL_SEND_DAILY_CAP,
  GMAIL_SEND_WARN_AT,
  type BulkEmailSendVia,
} from '@/lib/crm/bulk-email-identity'
import { ToolbarCheck, ToolbarRadio } from '@/components/admin/v2'

export type BulkEmailSendChoice = {
  includeSignature: boolean
  sendVia: BulkEmailSendVia
}

const CHECK_ROW = { display: 'flex' } as const
const QUIET = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' } as const

export function BulkEmailSendOptions({
  value,
  onChange,
  onSignatureHtml,
  recipientCount,
}: {
  value: BulkEmailSendChoice
  onChange: (next: BulkEmailSendChoice) => void
  /** Preview HTML. Null when the signature is off or still loading. */
  onSignatureHtml?: (html: string | null) => void
  recipientCount?: number
}) {
  const [opts, setOpts] = useState<Awaited<ReturnType<typeof getBulkEmailSendOptionsAction>> | null>(null)
  const onSigRef = useRef(onSignatureHtml)
  onSigRef.current = onSignatureHtml

  useEffect(() => {
    let live = true
    getBulkEmailSendOptionsAction().then((res) => {
      if (!live) return
      setOpts(res)
    })
    return () => {
      live = false
    }
  }, [])

  const signatureHtml = opts?.ok ? opts.signatureHtml : null
  useEffect(() => {
    onSigRef.current?.(value.includeSignature ? signatureHtml : null)
  }, [value.includeSignature, signatureHtml])

  const loaded = Boolean(opts?.ok)
  const actorEmail = opts?.ok ? opts.actorEmail : ''
  const fromLabel = opts?.ok ? opts.resendFromLabel : ''
  const replyTo = opts?.ok ? opts.replyTo : ''
  const canMailbox = opts?.ok ? opts.canSendFromMailbox : false
  const count = recipientCount ?? 0
  const gmailWarn = value.sendVia === 'gmail' && count >= GMAIL_SEND_WARN_AT
  const gmailCap = value.sendVia === 'gmail' && count >= GMAIL_SEND_DAILY_CAP

  return (
    <div className="space-y-2">
      <ToolbarCheck
        label="Include your Gmail signature"
        labelStyle={CHECK_ROW}
        checked={value.includeSignature}
        onChange={(e) => onChange({ ...value, includeSignature: e.target.checked })}
      />
      <fieldset className="space-y-1" style={{ border: 0, margin: 0, padding: 0 }}>
        <legend style={{ ...QUIET, marginBottom: 4 }}>Send as</legend>
        {loaded ? (
          <>
            <ToolbarRadio
              name="bulk-email-send-via"
              label={`${fromLabel}. Replies come to ${replyTo}.`}
              labelStyle={CHECK_ROW}
              checked={value.sendVia === 'resend'}
              onChange={() => onChange({ ...value, sendVia: 'resend' })}
            />
            {canMailbox ? (
              <ToolbarRadio
                name="bulk-email-send-via"
                label={`${actorEmail}. Sends from your mailbox.`}
                labelStyle={CHECK_ROW}
                checked={value.sendVia === 'gmail'}
                onChange={() => onChange({ ...value, sendVia: 'gmail' })}
              />
            ) : null}
          </>
        ) : (
          <p style={QUIET}>Loading who this sends as</p>
        )}
      </fieldset>
      {loaded ? (
        <p style={QUIET}>
          {value.sendVia === 'gmail'
            ? `From ${actorEmail}. Replies come to the same inbox.`
            : `From ${fromLabel}. Replies go to ${replyTo}.`}
        </p>
      ) : null}
      {gmailCap ? (
        <p role="alert" style={{ ...QUIET, color: 'var(--a-danger)' }}>
          Gmail will not send {count.toLocaleString('en-US')} messages in one day. Keep {fromLabel} as the
          sender. Replies still come to you.
        </p>
      ) : gmailWarn ? (
        <p style={QUIET}>
          Gmail caps around 2,000 messages a day. Fine for a small list. This list is {count.toLocaleString('en-US')}.
        </p>
      ) : null}
    </div>
  )
}
