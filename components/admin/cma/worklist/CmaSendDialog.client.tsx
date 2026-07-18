'use client'

/**
 * CmaSendDialog — the warm, EMAIL-ONLY send-to-client compose dialog for an
 * approved CMA. Unlike ProspectSendDialog (components/admin/prospecting/
 * ProspectSendDialog.client.tsx), there is no SMS tab, no compliance ribbon,
 * and no quiet-hours gate: a CMA client is a known contact who requested (or
 * is expecting) a home-value analysis, sent from the signing broker's own
 * mailbox via lib/cma/send.ts sendCmaToLead (Gmail DWD, Resend fallback,
 * PDF attached, FUB BCC'd). NO native confirm() anywhere in this flow.
 *
 * `context.defaultSubject` / `defaultBodyText` are the server-composed
 * default message (lib/cma/send.ts prepareCmaSendPreview) — editable here.
 * "Send test to myself" always uses the current edits. "Send CMA" sends the
 * edits ONLY when they differ from the default (bodyOverride), otherwise the
 * server composes the live default at send time (lib/cma/send.ts
 * sendCmaToLead's `override` param).
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import { formatDate } from './format'

/** The compose context for one CMA's send dialog. Owned by the parent
 *  (prepared alongside the guarded send action so the preview always matches
 *  what the server would actually compose). */
export interface CmaSendContext {
  slug: string
  subjectAddress: string
  clientName: string | null
  clientEmail: string | null
  defaultSubject: string
  defaultBodyText: string
  docUrl: string
  alreadySent: { at: string } | null
}

type SendResult = {
  data: { transport: 'gmail' | 'resend'; mailbox: string | null } | null
  error: string | null
}
type TestResult = { ok: boolean; error?: string; message?: string }

export function CmaSendDialog({
  open,
  onClose,
  context,
  sendAction,
  testSendAction,
}: {
  open: boolean
  onClose: () => void
  context: CmaSendContext | null
  /** The guarded production send — CMA must be finalized/delivered server-side. */
  sendAction: (slug: string, override?: { subject?: string; bodyText?: string }) => Promise<SendResult>
  testSendAction: (args: { channel: 'email'; subject: string; body: string }) => Promise<TestResult>
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to {context?.clientName ?? 'client'}</DialogTitle>
        </DialogHeader>

        {context ? (
          // Keyed by slug: React remounts fresh local edit state (subject/body
          // text, error) whenever the dialog is handed a new CMA, instead of
          // syncing props into state via an effect.
          <CmaSendDialogBody
            key={context.slug}
            context={context}
            onClose={onClose}
            sendAction={sendAction}
            testSendAction={testSendAction}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function CmaSendDialogBody({
  context,
  onClose,
  sendAction,
  testSendAction,
}: {
  context: CmaSendContext
  onClose: () => void
  sendAction: (slug: string, override?: { subject?: string; bodyText?: string }) => Promise<SendResult>
  testSendAction: (args: { channel: 'email'; subject: string; body: string }) => Promise<TestResult>
}) {
  const [subject, setSubject] = useState(context.defaultSubject)
  const [body, setBody] = useState(context.defaultBodyText)
  const [error, setError] = useState<string | null>(null)
  const [sendPending, startSend] = useTransition()
  const [testPending, startTest] = useTransition()

  const channelMissing = !context.clientEmail

  function handleSendTest() {
    if (testPending || sendPending) return
    setError(null)
    startTest(async () => {
      const res = await testSendAction({ channel: 'email', subject, body })
      if (res.ok) {
        toast.success('Test email sent to your own inbox.')
      } else {
        setError(res.error ?? 'Test send failed.')
      }
    })
  }

  function handleSend() {
    if (sendPending || testPending) return
    setError(null)
    const edited = subject.trim() !== context.defaultSubject.trim() || body.trim() !== context.defaultBodyText.trim()
    startSend(async () => {
      const res = await sendAction(context.slug, edited ? { subject, bodyText: body } : undefined)
      if (res.error) {
        setError(res.error)
        return
      }
      const from = res.data?.transport === 'gmail' && res.data.mailbox ? ` from ${res.data.mailbox}` : ''
      toast.success(`Sent to ${context.clientEmail ?? 'the client'}${from}.`)
      onClose()
    })
  }

  return (
    <div className="space-y-3">
      {/* Pre-populated recipient */}
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <p className="text-sm font-medium text-foreground">{context.clientName ?? 'Client unknown'}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{context.clientEmail ?? 'No email on file'}</p>
      </div>

      {/* Already-sent */}
      {context.alreadySent ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium text-foreground">Already sent {formatDate(context.alreadySent.at)}</p>
        </div>
      ) : null}

      <EmailBodyEditor subject={subject} onSubjectChange={setSubject} body={body} onBodyChange={setBody} signatureHtml={null} />

      <a
        href={context.docUrl}
        target="_blank"
        rel="noreferrer"
        className="inline-block text-xs text-muted-foreground underline underline-offset-2"
      >
        Open the document
      </a>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-11" disabled={testPending || sendPending} onClick={handleSendTest}>
            {testPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending test…
              </span>
            ) : (
              'Send test to myself'
            )}
          </Button>
          <Button className="h-11 flex-1" disabled={sendPending || testPending || channelMissing} onClick={handleSend}>
            {sendPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
              </span>
            ) : (
              'Send CMA'
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Sends from your own mailbox with the PDF attached, FUB BCC&apos;d. Your edits above are what sends.
        </p>
      </div>
    </div>
  )
}
