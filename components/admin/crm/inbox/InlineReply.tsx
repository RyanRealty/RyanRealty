'use client'

/**
 * InlineReply — the inbox thread reply box (Wave 7).
 *
 * Switches between a text reply and an email reply, both of which post through
 * the EXISTING suppression-gated send actions (sendCrmSmsAction /
 * sendCrmEmailAction), passed in pre-bound from the server page. This component
 * NEVER introduces a new send path; it only chooses which existing composer to
 * show. The composers (SmsComposer / EmailComposer) own the preview + the form.
 *
 * Drafts (delivery #5): when a saved draft exists for the open conversation, the
 * page passes its body/subject as the initial value and the matching channel is
 * pre-selected. Each composer also gets an optional saveDraftAction so the broker
 * can persist an unsent reply (stored text only — no send).
 */

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { SmsComposer } from '@/components/admin/crm/SmsComposer'
import { EmailComposer } from '@/components/admin/crm/EmailComposer'

type Channel = 'text' | 'email'

export default function InlineReply({
  smsAction,
  emailAction,
  signatureHtml,
  canText,
  canEmail,
  initialSmsBody = '',
  initialEmailSubject = '',
  initialEmailBody = '',
  saveSmsDraftAction,
  saveEmailDraftAction,
  hasTextDraft = false,
  hasEmailDraft = false,
}: {
  smsAction: (formData: FormData) => Promise<void>
  emailAction: (formData: FormData) => Promise<void>
  signatureHtml: string | null
  canText: boolean
  canEmail: boolean
  initialSmsBody?: string
  initialEmailSubject?: string
  initialEmailBody?: string
  saveSmsDraftAction?: (formData: FormData) => Promise<void>
  saveEmailDraftAction?: (formData: FormData) => Promise<void>
  hasTextDraft?: boolean
  hasEmailDraft?: boolean
}) {
  // A saved draft on a channel pre-selects it so the broker lands on the reply
  // they started; otherwise text is the default when available.
  const [channel, setChannel] = useState<Channel>(
    hasTextDraft && canText ? 'text' : hasEmailDraft && canEmail ? 'email' : canText ? 'text' : 'email',
  )

  if (!canText && !canEmail) {
    return (
      <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
        No phone or email on file for this contact. Add one on the contact card to reply.
      </p>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        {canText ? (
          <Button
            type="button"
            size="sm"
            variant={channel === 'text' ? 'default' : 'ghost'}
            onClick={() => setChannel('text')}
          >
            Text{hasTextDraft ? ' · draft' : ''}
          </Button>
        ) : null}
        {canEmail ? (
          <Button
            type="button"
            size="sm"
            variant={channel === 'email' ? 'default' : 'ghost'}
            onClick={() => setChannel('email')}
          >
            Email{hasEmailDraft ? ' · draft' : ''}
          </Button>
        ) : null}
      </div>

      {channel === 'text' && canText ? (
        <SmsComposer initialBody={initialSmsBody} sendAction={smsAction} saveDraftAction={saveSmsDraftAction} />
      ) : null}
      {channel === 'email' && canEmail ? (
        <EmailComposer
          initialSubject={initialEmailSubject}
          initialBody={initialEmailBody}
          signatureHtml={signatureHtml}
          sendAction={emailAction}
          saveDraftAction={saveEmailDraftAction}
        />
      ) : null}
    </div>
  )
}
