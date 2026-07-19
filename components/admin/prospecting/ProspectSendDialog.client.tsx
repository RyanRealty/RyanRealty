'use client'

/**
 * ProspectSendDialog — the compliance-gated cold-intro compose dialog (spec 07
 * §5, Matt's #1 ask for this surface). Recipient (owner name + masked
 * phone/email) is pre-populated at top; SMS/Email live as Tabs; the default
 * template body is editable with a live preview + merge-token warning; an
 * inline already-sent + engagement block shows when this owner was already
 * texted. NO native confirm() anywhere in this flow.
 *
 * `sendIntroAction`'s `bodyOverride` IS honored: editing the SMS body below
 * sends your edited text, verbatim, through the same server-side compliance
 * pipeline (unresolved-token fail-closed + short-link tracking) — see the
 * caption under the buttons, "Your edits above are what sends."
 *
 * SMS tab reuses the same primitives SmsComposer is built from
 * (MergeFieldInserter, findUnresolvedMergeTokens) rather than the whole
 * SmsComposer component: SmsComposer's round send-arrow is baked in as THE
 * submit action for its own form, and this dialog needs two DIFFERENT
 * buttons (test vs. guarded production send) — reusing it whole would give
 * one arrow two conflicting meanings. Email tab reuses EmailBodyEditor bare
 * (controlled) — its own header comment documents exactly this use case:
 * "bulk surfaces with their own audience + dispatch flow... embed it
 * directly as a controlled component."
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import { MergeFieldInserter, insertAtCursor } from '@/components/admin/crm/MergeFieldInserter'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import type { ProspectEngagement, ProspectKind, SendIntroResult } from '@/lib/data/prospecting/types'
import { formatDate, maskEmail, maskPhone } from './format'

/** The compose context for one prospect's cold-intro dialog. Owned by the
 *  parent (prepared alongside the guarded send action so the preview always
 *  matches what the server would actually compose).
 *  keep in sync with app/actions/prospecting.ts ProspectSendContext */
export interface ProspectSendContext {
  kind: ProspectKind
  id: string
  ownerName: string | null
  toPhone: string | null
  toEmail: string | null
  defaultSmsBody: string
  defaultEmailSubject: string
  defaultEmailBody: string
  docSlug: string | null
  clientReady?: boolean
  alreadySent: { at: string; sid: string | null } | null
  engagement: ProspectEngagement
}

type Channel = 'sms' | 'email'

type SendDialogActions = {
  sendIntroAction: (kind: ProspectKind, id: string, args: { idempotencyKey: string; bodyOverride?: string | null }) => Promise<SendIntroResult>
  sendTestAction: (args: { channel: 'sms' | 'email'; subject?: string; body: string }) => Promise<{ ok: boolean; error?: string }>
  sendEmailIntroAction?: (args: { idempotencyKey: string }) => Promise<{ ok: boolean; error?: string }>
}

export function ProspectSendDialog({
  open,
  onClose,
  context,
  sendIntroAction,
  sendTestAction,
  sendEmailIntroAction,
}: {
  open: boolean
  onClose: () => void
  context: ProspectSendContext | null
  /** The reconciled, guarded cold-intro send (spec §5.3) — SMS only per spec 07 §5.1.
   *  `bodyOverride` carries the broker's edited message (Matt's editable-template
   *  directive); the server still runs the full compliance pipeline on it
   *  (unresolved-token fail-closed + short-link tracking). When omitted, the
   *  server composes the live template with _pid/UTM tracking. */
  sendIntroAction: (kind: ProspectKind, id: string, args: { idempotencyKey: string; bodyOverride?: string | null }) => Promise<SendIntroResult>
  sendTestAction: (args: { channel: 'sms' | 'email'; subject?: string; body: string }) => Promise<{ ok: boolean; error?: string }>
  /**
   * The Email tab's production send. Optional for v1 — spec 07 §5.1 scopes
   * the guarded cold intro to SMS only, so the parent may leave this
   * undefined (or pass a no-op stub) until an email intro path ships. When
   * absent, the Email tab's Send button disables with an inline note.
   */
  sendEmailIntroAction?: (args: { idempotencyKey: string }) => Promise<{ ok: boolean; error?: string }>
}) {
  // Tracks the child's in-flight send state so the Dialog can refuse to close
  // (Escape, overlay click, the built-in X button) mid-send — a ref, not
  // state, because only the onOpenChange closure below needs the latest
  // value; it doesn't need to trigger a re-render of this wrapper.
  const sendPendingRef = useRef(false)

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) {
          if (sendPendingRef.current) return
          onClose()
        }
      }}
    >
      <DialogContent className="max-h-[90dvh] max-w-xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send to {context?.ownerName ?? 'owner'}</DialogTitle>
        </DialogHeader>

        {context ? (
          // Keyed by prospect id: React remounts fresh local edit state (body
          // text, channel, error) whenever the dialog is handed a new
          // prospect, instead of syncing props into state via an effect.
          <ProspectSendDialogBody
            key={context.id}
            context={context}
            onClose={onClose}
            sendIntroAction={sendIntroAction}
            sendTestAction={sendTestAction}
            sendEmailIntroAction={sendEmailIntroAction}
            onSendPendingChange={(pending) => {
              sendPendingRef.current = pending
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function ProspectSendDialogBody({
  context,
  onClose,
  sendIntroAction,
  sendTestAction,
  sendEmailIntroAction,
  onSendPendingChange,
}: SendDialogActions & {
  context: ProspectSendContext
  onClose: () => void
  onSendPendingChange: (pending: boolean) => void
}) {
  const [channel, setChannel] = useState<Channel>(context.toPhone ? 'sms' : 'email')
  const [smsBody, setSmsBody] = useState(context.defaultSmsBody)
  const [emailSubject, setEmailSubject] = useState(context.defaultEmailSubject)
  const [emailBody, setEmailBody] = useState(context.defaultEmailBody)
  const [error, setError] = useState<string | null>(null)
  const smsRef = useRef<HTMLTextAreaElement>(null)
  const [sendPending, startSend] = useTransition()
  const [testPending, startTest] = useTransition()

  // Let the parent Dialog know whether a production send is in flight, so it
  // can refuse to close (Escape/overlay/X) until it settles.
  useEffect(() => {
    onSendPendingChange(sendPending)
  }, [sendPending, onSendPendingChange])

  const smsUnresolved = useMemo(() => findUnresolvedMergeTokens(smsBody), [smsBody])
  const emailUnresolved = useMemo(
    () => findUnresolvedMergeTokens(`${emailSubject} ${emailBody}`),
    [emailSubject, emailBody],
  )

  function insertSmsToken(token: string) {
    const el = smsRef.current
    if (!el) {
      setSmsBody((b) => b + token)
      return
    }
    const next = insertAtCursor(el, token)
    setSmsBody(next)
    const pos = (el.selectionStart ?? 0) + token.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  function handleSendTest() {
    if (testPending || sendPending) return
    setError(null)
    startTest(async () => {
      const res = await sendTestAction({
        channel,
        subject: channel === 'email' ? emailSubject : undefined,
        body: channel === 'sms' ? smsBody : emailBody,
      })
      if (res.ok) {
        toast.success(channel === 'sms' ? 'Test text sent to your own number.' : 'Test email sent to your own inbox.')
      } else {
        const message = res.error ?? 'Test send failed.'
        // Also toast: the dialog may be closed (test sends aren't guarded by
        // the close-block above) by the time this resolves, and setError
        // alone would be silently dropped on an unmounted component.
        setError(message)
        toast.error(message)
      }
    })
  }

  function handleSendIntro() {
    if (sendPending || testPending) return
    setError(null)
    // Stable, namespaced per spec §10.27 (`intro:{kind}:{id}`) — never a
    // fresh key per attempt. A duplicate submit reuses the SAME key so the
    // server dedupes into the original result instead of sending twice.
    const idempotencyKey = `intro:${context.kind}:${context.id}`
    // Only override the server-composed body when the broker actually edited it —
    // the unedited path keeps full _pid/UTM tracking that the server injects.
    const edited = smsBody.trim() !== context.defaultSmsBody.trim()
    startSend(async () => {
      if (channel === 'sms') {
        const res = await sendIntroAction(context.kind, context.id, {
          idempotencyKey,
          bodyOverride: edited ? smsBody : undefined,
        })
        if (res.ok) {
          toast.success(`Intro sent to ${context.ownerName ?? 'owner'}.`)
          onClose()
        } else {
          // Also toast: setError alone is silently dropped if this component
          // unmounted (e.g. the broker navigated away) before the send resolved.
          setError(res.error)
          toast.error(res.error)
        }
        return
      }
      if (!sendEmailIntroAction) {
        const message = 'Email intro sending is not available yet. Use Send test to preview the wording.'
        setError(message)
        toast.error(message)
        return
      }
      const res = await sendEmailIntroAction({ idempotencyKey })
      if (res.ok) {
        toast.success(`Intro emailed to ${context.ownerName ?? 'owner'}.`)
        onClose()
      } else {
        const message = res.error ?? 'Send failed.'
        setError(message)
        toast.error(message)
      }
    })
  }

  const recipientLine = channel === 'sms' ? maskPhone(context.toPhone) : maskEmail(context.toEmail)
  const channelMissing = channel === 'sms' ? !context.toPhone : !context.toEmail
  const sendDisabled =
    sendPending || testPending || channelMissing || Boolean(context.alreadySent) || (channel === 'email' && !sendEmailIntroAction)

  return (
    <div className="space-y-3">
      {/* Pre-populated recipient */}
      <div className="rounded-lg bg-muted/50 px-3 py-2">
        <p className="text-sm font-medium text-foreground">{context.ownerName ?? 'Owner unknown'}</p>
        <p className="text-xs tabular-nums text-muted-foreground">{recipientLine}</p>
      </div>

      {/* Already-sent + engagement */}
      {context.alreadySent ? (
        <div className="rounded-lg border border-border bg-muted/30 px-3 py-2">
          <p className="text-sm font-medium text-foreground">Intro already sent {formatDate(context.alreadySent.at)}</p>
          <p className="mt-1 text-xs tabular-nums text-muted-foreground">
            {context.engagement.reportViews} views · {context.engagement.linkTaps} taps ·{' '}
            {context.engagement.emailOpens} opens · {context.engagement.emailClicks} clicks
            {context.engagement.lastActivityAt ? ` · last ${formatDate(context.engagement.lastActivityAt)}` : ''}
          </p>
        </div>
      ) : null}

      <Tabs value={channel} onValueChange={(v) => setChannel(v as Channel)}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="sms" disabled={!context.toPhone}>
            Text{context.toPhone ? '' : ' (no phone)'}
          </TabsTrigger>
          <TabsTrigger value="email" disabled={!context.toEmail}>
            Email{context.toEmail ? '' : ' (no address)'}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {channel === 'sms' ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Message</Label>
            <MergeFieldInserter channel="sms" onInsert={insertSmsToken} iconOnly />
          </div>
          <Textarea
            ref={smsRef}
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
            rows={5}
            className="text-sm"
            placeholder="Message · SMS"
          />
          {smsUnresolved.length > 0 ? (
            <p className="text-xs font-medium text-warning">
              Unfilled merge fields: {smsUnresolved.join(', ')}. This is a preview warning. The live send resolves
              these tokens for real.
            </p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-1.5">
          <EmailBodyEditor
            subject={emailSubject}
            onSubjectChange={setEmailSubject}
            body={emailBody}
            onBodyChange={setEmailBody}
            signatureHtml={null}
          />
          {emailUnresolved.length > 0 ? (
            <p className="text-xs font-medium text-warning">Unfilled merge fields: {emailUnresolved.join(', ')}.</p>
          ) : null}
          {!sendEmailIntroAction ? (
            <p className="text-xs text-muted-foreground">
              Email intro sending isn&apos;t available yet. Use Send test to preview the wording.
            </p>
          ) : null}
        </div>
      )}

      {context.docSlug ? (
        <a
          href={`/admin/cmas/${context.docSlug}`}
          target="_blank"
          rel="noreferrer"
          className="inline-block text-xs text-muted-foreground underline underline-offset-2"
        >
          Open the document
        </a>
      ) : null}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-2 border-t border-border pt-3">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="h-11"
            disabled={testPending || sendPending || channelMissing}
            onClick={handleSendTest}
          >
            {testPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending test…
              </span>
            ) : (
              'Send test to myself'
            )}
          </Button>
          <Button className="h-11 flex-1" disabled={sendDisabled} onClick={handleSendIntro}>
            {sendPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
              </span>
            ) : context.alreadySent ? (
              'Already sent'
            ) : (
              'Send intro'
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Sends to {context.ownerName ?? 'this owner'}. Your edits above are what sends. Every send re-checks hard-stop,
          do-not-call, quiet hours, and suppression before it leaves.
        </p>
      </div>
    </div>
  )
}
