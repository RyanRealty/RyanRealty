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
 *
 * 11F: outer chrome on the LOCKED admin v2 language (Dialog, Button). This is
 * a SEND surface — the send handler, recipient handling and every guard are
 * byte-for-byte unchanged. The EmailBodyEditor import STAYS pointed at
 * components/admin/crm — that is the G50 compose chokepoint
 * ci:composer-discipline requires, and forking it to satisfy a color gate
 * would defeat the gate that matters more. Same sanctioned call already
 * recorded for BpoSendDialog, DscrEmailDialog, people/[id]'s CommsSection,
 * and crm/inbox. `max-w-xl` is gone: the content now mounts inside the
 * locked <Dialog> primitive, whose own av2-dialog CSS owns width
 * (max-width:460px, width:calc(100vw - var(--a-s8))) — Dialog exposes no
 * className/style passthrough to reintroduce a wider cap without editing
 * components/admin/v2/Dialog.tsx, which is out of scope here.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button, Dialog } from '@/components/admin/v2'
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
    <Dialog open={open} onClose={onClose} title={`Send to ${context?.clientName ?? 'client'}`}>
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
      <div style={{ borderRadius: 'var(--a-r-md)', background: 'var(--a-inset)', padding: '8px 12px' }}>
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
          {context.clientName ?? 'Client unknown'}
        </p>
        <p className="a-num" style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {context.clientEmail ?? 'No email on file'}
        </p>
      </div>

      {/* Already-sent */}
      {context.alreadySent ? (
        <div style={{ borderRadius: 'var(--a-r-md)', border: '1px solid var(--a-border)', background: 'var(--a-inset)', padding: '8px 12px' }}>
          <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
            Already sent {formatDate(context.alreadySent.at)}
          </p>
        </div>
      ) : null}

      <EmailBodyEditor
        subject={subject}
        onSubjectChange={setSubject}
        body={body}
        onBodyChange={setBody}
        signatureHtml={null}
        hideMergeFields
      />

      <a
        href={context.docUrl}
        target="_blank"
        rel="noreferrer"
        style={{
          display: 'inline-block',
          fontSize: 'var(--a-text-xs)',
          color: 'var(--a-text-2)',
          textDecoration: 'underline',
          textUnderlineOffset: 2,
        }}
      >
        Open the document
      </a>

      {error ? <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>{error}</p> : null}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid var(--a-border)', paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Button variant="quiet" touch disabled={testPending || sendPending} onClick={handleSendTest}>
            {testPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending test…
              </span>
            ) : (
              'Send test to myself'
            )}
          </Button>
          <Button className="flex-1" touch disabled={sendPending || testPending || channelMissing} onClick={handleSend}>
            {sendPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
              </span>
            ) : (
              'Send CMA'
            )}
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Sends from your own mailbox with the PDF attached. Your edits above are what sends.
        </p>
      </div>
    </div>
  )
}
