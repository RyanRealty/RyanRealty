'use client'

/**
 * BpoSendDialog — the EMAIL-ONLY warm-send compose dialog for a finalized
 * BPO (mirrors ProspectSendDialog's editing shell, minus SMS/compliance/
 * quiet-hours — a BPO send is a 1:1 broker-to-client email, not a cold
 * compliance-gated outreach). A BPO can only ever go to its own linked CRM
 * contact (see lib/bpo/send.ts's prepareBpoSendPreview docblock) — the parent
 * board only opens this dialog once prepareSendAction has confirmed a
 * person_id exists, so `context.personId` is always non-null here.
 *
 * `subject`/`bodyText` are pre-composed with the recipient's real name and
 * the property's real numbers (no CRM merge-token syntax) — the editor hides
 * the merge-field dropdown accordingly.
 *
 * NO native confirm() anywhere in this flow.
 *
 * 11F: outer chrome on the LOCKED admin v2 language (Dialog, Button). This is
 * a SEND surface — the send handler, recipient handling and every guard are
 * byte-for-byte unchanged. The EmailBodyEditor import STAYS pointed at
 * components/admin/crm — that is the G50 compose chokepoint
 * ci:composer-discipline requires, and forking it to satisfy a color gate
 * would defeat the gate that matters more. Same sanctioned call already
 * recorded for DscrEmailDialog, people/[id]'s CommsSection, and crm/inbox.
 */

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button, Dialog } from '@/components/admin/v2'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import type { BpoSendContext } from '@/app/actions/contact-bpo'

type SendResult = { ok: true; transport: 'gmail' | 'resend' } | { ok: false; error: string }
type TestResult = { ok: boolean; error?: string }

type SendDialogActions = {
  /** The guarded, existing BPO send path (app/actions/contact-bpo.ts's
   *  sendBpoForContactAction). `includeOfferStrategy` is always false from
   *  this worklist — the internal offer strategy never rides along to a
   *  bulk/worklist send. `override` carries the broker's edits only when the
   *  broker actually changed the subject/body from the prefilled default. */
  sendAction: (
    personId: number,
    slug: string,
    includeOfferStrategy: boolean,
    override?: { subject?: string | null; bodyText?: string | null },
  ) => Promise<SendResult>
  sendTestAction: (args: { channel: 'sms' | 'email'; subject?: string; body: string }) => Promise<TestResult>
}

export function BpoSendDialog({
  open,
  onClose,
  slug,
  context,
  sendAction,
  sendTestAction,
}: SendDialogActions & {
  open: boolean
  onClose: () => void
  /** The BPO this dialog was opened for — kept separate from `context` since
   *  the prefill context (mirrors lib/cma/send.ts's prepareCmaSendPreview
   *  shape) does not itself carry a slug. */
  slug: string | null
  context: BpoSendContext | null
}) {
  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={`Send price opinion${context?.recipientName ? ` to ${context.recipientName}` : ''}`}
    >
      {context && slug ? (
        // Keyed by slug: React remounts fresh local edit state whenever the
        // dialog is handed a new opinion, instead of syncing props into
        // state via an effect.
        <BpoSendDialogBody
          key={slug}
          slug={slug}
          context={context}
          onClose={onClose}
          sendAction={sendAction}
          sendTestAction={sendTestAction}
        />
      ) : null}
    </Dialog>
  )
}

function BpoSendDialogBody({
  slug,
  context,
  onClose,
  sendAction,
  sendTestAction,
}: SendDialogActions & { slug: string; context: BpoSendContext; onClose: () => void }) {
  const [subject, setSubject] = useState(context.subject)
  const [bodyText, setBodyText] = useState(context.bodyText)
  const [error, setError] = useState<string | null>(null)
  const [sendPending, startSend] = useTransition()
  const [testPending, startTest] = useTransition()

  function handleSendTest() {
    if (testPending || sendPending) return
    setError(null)
    startTest(async () => {
      const res = await sendTestAction({ channel: 'email', subject, body: bodyText })
      if (res.ok) {
        toast.success('Test email sent to your own inbox.')
      } else {
        setError(res.error ?? 'Test send failed.')
      }
    })
  }

  function handleSend() {
    if (sendPending || testPending || context.personId == null) return
    setError(null)
    const edited = subject.trim() !== context.subject.trim() || bodyText.trim() !== context.bodyText.trim()
    startSend(async () => {
      const res = await sendAction(context.personId!, slug, false, edited ? { subject, bodyText } : undefined)
      if (res.ok) {
        toast.success(`Price opinion sent to ${context.recipientName ?? 'the contact'}.`)
        onClose()
      } else {
        setError(res.error)
      }
    })
  }

  const sendDisabled = sendPending || testPending || context.personId == null || !context.recipientEmail

  return (
    <>
      {/* Pre-populated recipient */}
      <div style={{ borderRadius: 'var(--a-r-md)', background: 'var(--a-inset)', padding: '8px 12px' }}>
        <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
          {context.recipientName ?? 'Recipient unknown'}
        </p>
        <p className="a-num" style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          {context.recipientEmail ?? 'No email on file for this contact.'}
        </p>
      </div>

      <EmailBodyEditor
        subject={subject}
        onSubjectChange={setSubject}
        body={bodyText}
        onBodyChange={setBodyText}
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
        Open the opinion
      </a>

      {error ? <p style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}>{error}</p> : null}

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          borderTop: '1px solid var(--a-border)',
          paddingTop: 12,
        }}
      >
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
          <Button className="flex-1" touch disabled={sendDisabled} onClick={handleSend}>
            {sendPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
              </span>
            ) : (
              'Send price opinion'
            )}
          </Button>
        </div>
        <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
          Sends to the contact linked on this opinion only. The internal offer strategy stays out of this send. Every
          send re-checks suppression before it leaves.
        </p>
      </div>
    </>
  )
}
