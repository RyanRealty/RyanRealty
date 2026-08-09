'use client'

/**
 * ProspectSendDialog — the compliance-gated cold-intro compose dialog (spec 07
 * §5, Matt's #1 ask for this surface). Recipient (owner name + masked
 * phone/email) is pre-populated at top; SMS/Email live as a two-way channel
 * switch; the default template body is editable with a live preview + merge-token
 * warning; an inline already-sent + engagement block shows when this owner was
 * already texted. NO native confirm() anywhere in this flow.
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
 *
 * 11F: outer chrome on the LOCKED admin v2 language. This is a SEND surface —
 * every handler, idempotency key, guard, disabled rule and string is
 * byte-for-byte what it was; only the paint and the primitives moved. Four
 * notes, because each was a trap:
 *  - The EmailBodyEditor / MergeFieldInserter imports STAY pointed at
 *    components/admin/crm: those are the G50 compose chokepoints
 *    ci:composer-discipline requires, and forking them to satisfy a colour gate
 *    would defeat the gate that matters more. Same sanctioned call recorded for
 *    BpoSendDialog, CmaSendDialog, DscrEmailDialog and crm/inbox.
 *  - The shadcn Tabs became two FilterChips, so the selected channel is
 *    ANNOUNCED (aria-pressed) rather than implied by fill — the call already
 *    recorded in EmailBodyEditor. .av2-chip carries no :hover, so the chips
 *    carry one as a utility class (an inline style would outrank a stylesheet
 *    hover and kill it).
 *  - The SMS box is a raw control + `av2-input` + aria-label, this folder's
 *    pattern for an unlabelled field: TextAreaField forwards no ref (this file
 *    needs one for insertAtCursor) and prints a visible heading of its own.
 *    Dropping the visible label never drops the accessible one.
 *  - Dialog owns its own width, so `max-w-xl` is gone; `size="work"` is the
 *    detail-surface width, this being a compose surface rather than a question.
 *    The native <dialog> scrolls its own overflow, which is what
 *    max-h-[90dvh]/overflow-y-auto were doing by hand.
 *  - .av2-dialog__body carries an UNLAYERED `p { margin:0 }`, and an unlayered
 *    rule outranks the whole Tailwind utilities layer whatever its specificity
 *    (the same fact admin-v2.css records above its own @layer base block). So
 *    every mt-* / space-y-* gap on a <p> inside this dialog would have silently
 *    become zero. Those paragraphs carry their gap as an inline marginTop, the
 *    one thing that outranks it. Only <p> is affected; div children keep their
 *    space-y.
 */

import { useEffect, useMemo, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import type { CSSProperties } from 'react'
import { Button, Dialog, FilterChip } from '@/components/admin/v2'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import { MergeFieldInserter, insertAtCursor } from '@/components/admin/crm/MergeFieldInserter'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { sendProspectingEmailIntro } from '@/app/actions/prospecting'
import type { ProspectEngagement, ProspectKind, SendEmailIntroResult, SendIntroResult } from '@/lib/data/prospecting/types'
import { formatDate, maskEmail, maskPhone } from './format'

const badgeStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  color: 'var(--a-text-2)',
  border: '1px solid var(--a-border)',
  borderRadius: 'var(--a-r-sm)',
  padding: '1px 6px',
}
const quietTextStyle: CSSProperties = { fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }
const warnTextStyle: CSSProperties = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 500,
  color: 'var(--a-warn)',
}

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
  /** Either-channel first touch (drives the approve gate + the banner). */
  alreadySent: { at: string; sid: string | null } | null
  /** Per-channel sent stamps — each tab disables independently. */
  sentSms?: { at: string; sid: string | null } | null
  sentEmail?: { at: string } | null
  engagement: ProspectEngagement
}

type Channel = 'sms' | 'email'

type SendDialogActions = {
  sendIntroAction: (kind: ProspectKind, id: string, args: { idempotencyKey: string; bodyOverride?: string | null }) => Promise<SendIntroResult>
  sendTestAction: (args: { channel: 'sms' | 'email'; subject?: string; body: string }) => Promise<{ ok: boolean; error?: string }>
  sendEmailIntroAction?: (
    kind: ProspectKind,
    id: string,
    args: { idempotencyKey: string; subjectOverride?: string | null; bodyOverride?: string | null },
  ) => Promise<SendEmailIntroResult>
}

export function ProspectSendDialog({
  open,
  onClose,
  context,
  sendIntroAction,
  sendTestAction,
  sendEmailIntroAction,
  onApprove,
}: {
  open: boolean
  onClose: () => void
  context: ProspectSendContext | null
  /** The reconciled, guarded cold-intro send (spec §5.3) — the SMS channel.
   *  `bodyOverride` carries the broker's edited message (Matt's editable-template
   *  directive); the server still runs the full compliance pipeline on it
   *  (unresolved-token fail-closed + short-link tracking). When omitted, the
   *  server composes the live template with _pid/UTM tracking. The email
   *  channel sends through sendProspectingEmailIntro (same guard chain, email
   *  suppression + at-most-once email claim). */
  sendIntroAction: (kind: ProspectKind, id: string, args: { idempotencyKey: string; bodyOverride?: string | null }) => Promise<SendIntroResult>
  sendTestAction: (args: { channel: 'sms' | 'email'; subject?: string; body: string }) => Promise<{ ok: boolean; error?: string }>
  /**
   * The Email tab's production send — the guarded cold email intro
   * (sendProspectingEmailIntro: same fail-closed guard chain as the SMS
   * intro on the email channel + the at-most-once email claim). Optional
   * override for tests; when omitted the dialog uses the real server action
   * directly (the parent board does not need to thread it through).
   */
  sendEmailIntroAction?: (
    kind: ProspectKind,
    id: string,
    args: { idempotencyKey: string; subjectOverride?: string | null; bodyOverride?: string | null },
  ) => Promise<SendEmailIntroResult>
  /**
   * Approve a still-draft audit in place (Matt's "approve on this page"
   * requirement). Resolves true on success. When omitted, the draft banner still
   * shows but without the one-click button (the "Open the document" link is the
   * fallback). Returns a boolean so the body can clear its pending state.
   */
  onApprove?: (kind: ProspectKind, id: string, slug: string) => Promise<boolean>
}) {
  // Tracks the child's in-flight send state so the Dialog can refuse to close
  // (Escape, overlay click, the built-in Close button) mid-send — a ref, not
  // state, because only the close callback below needs the latest value; it
  // doesn't need to trigger a re-render of this wrapper.
  const sendPendingRef = useRef(false)

  return (
    <Dialog
      open={open}
      onClose={() => {
        if (sendPendingRef.current) return
        onClose()
      }}
      title={`Send to ${context?.ownerName ?? 'owner'}`}
      size="work"
    >
      {context ? (
        // Keyed by prospect id: React remounts fresh local edit state (body
        // text, channel, error) whenever the dialog is handed a new
        // prospect, instead of syncing props into state via an effect.
        <ProspectSendDialogBody
          // Re-key on clientReady too: when an in-dialog approve flips a draft
          // to client-ready, the body remounts and re-initializes its editable
          // body from the fresh context (now carrying the live document link).
          key={`${context.id}:${context.clientReady ? 'ready' : 'draft'}`}
          context={context}
          onClose={onClose}
          sendIntroAction={sendIntroAction}
          sendTestAction={sendTestAction}
          sendEmailIntroAction={sendEmailIntroAction}
          onApprove={onApprove}
          onSendPendingChange={(pending) => {
            sendPendingRef.current = pending
          }}
        />
      ) : null}
    </Dialog>
  )
}

function ProspectSendDialogBody({
  context,
  onClose,
  sendIntroAction,
  sendTestAction,
  sendEmailIntroAction,
  onApprove,
  onSendPendingChange,
}: SendDialogActions & {
  context: ProspectSendContext
  onClose: () => void
  onApprove?: (kind: ProspectKind, id: string, slug: string) => Promise<boolean>
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
  const [approvePending, startApprove] = useTransition()

  // The audit exists but hasn't been approved yet, so its public link would 404
  // as a draft. The server send refuses this too — surface it up front and offer
  // a one-click approve instead of letting the broker hit a guaranteed-fail send.
  const needsApproval = context.clientReady === false && !context.alreadySent

  function handleApprove() {
    if (approvePending || sendPending || testPending) return
    if (!onApprove || !context.docSlug) return
    setError(null)
    startApprove(async () => {
      await onApprove(context.kind, context.id, context.docSlug as string)
      // The parent re-prepares and re-keys this body on success; nothing else to
      // do here (a failure toasts from the parent).
    })
  }

  // Let the parent Dialog know whether a production send is in flight, so it
  // can refuse to close (Escape/overlay/Close) until it settles.
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
    startSend(async () => {
      if (channel === 'sms') {
        // Stable, namespaced per spec §10.27 (`intro:{kind}:{id}`) — never a
        // fresh key per attempt. A duplicate submit reuses the SAME key so the
        // server dedupes into the original result instead of sending twice.
        const idempotencyKey = `intro:${context.kind}:${context.id}`
        // Only override the server-composed body when the broker actually edited it —
        // the unedited path keeps full _pid/UTM tracking that the server injects.
        const edited = smsBody.trim() !== context.defaultSmsBody.trim()
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
      // Email channel — its OWN idempotency namespace (the two channels claim
      // independently server-side; a shared key would make the email claim
      // read an SMS replay as its own).
      const idempotencyKey = `intro-email:${context.kind}:${context.id}`
      // Only override what the broker actually edited — the untouched default
      // lets the server rail compose its canonical subject/body.
      const subjectEdited = emailSubject.trim() !== context.defaultEmailSubject.trim()
      const bodyEdited = emailBody.trim() !== context.defaultEmailBody.trim()
      const emailAction = sendEmailIntroAction ?? sendProspectingEmailIntro
      const res = await emailAction(context.kind, context.id, {
        idempotencyKey,
        subjectOverride: subjectEdited ? emailSubject : undefined,
        bodyOverride: bodyEdited ? emailBody : undefined,
      })
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
  // Per-channel sent-state: an SMS intro does not block the email intro and
  // vice versa. Only when the per-channel field is ABSENT (a parent that has
  // not been re-prepared since these fields shipped) fall back to the
  // either-channel stamp — `??` would wrongly treat an explicit null (channel
  // unsent) as missing.
  const sentSms = context.sentSms !== undefined ? context.sentSms : context.alreadySent
  const sentEmail = context.sentEmail !== undefined ? context.sentEmail : null
  const channelSent = channel === 'sms' ? Boolean(sentSms) : Boolean(sentEmail)
  const sendDisabled =
    sendPending ||
    testPending ||
    approvePending ||
    needsApproval ||
    channelMissing ||
    channelSent

  return (
    <div className="space-y-3">
      {/* Pre-populated recipient */}
      <div style={{ borderRadius: 'var(--a-r-md)', background: 'var(--a-inset)', padding: '8px 12px' }}>
        <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
          {context.ownerName ?? 'Owner unknown'}
        </p>
        <p className="a-num" style={quietTextStyle}>
          {recipientLine}
        </p>
      </div>

      {/* Draft → approve gate (the only approve affordance in the hub) */}
      {needsApproval ? (
        <div
          style={{
            borderRadius: 'var(--a-r-md)',
            border: '1px solid var(--a-warn)',
            background: 'var(--a-warn-wash)',
            padding: '10px 12px',
          }}
        >
          <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
            This audit is still a draft.
          </p>
          <p style={{ ...quietTextStyle, marginTop: 2 }}>
            Approve it to make the link live, then send. The link would 404 until it is approved.
          </p>
          {onApprove && context.docSlug ? (
            <Button variant="quiet" className="mt-2" disabled={approvePending} onClick={handleApprove}>
              {approvePending ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Approving…
                </span>
              ) : (
                'Approve audit'
              )}
            </Button>
          ) : null}
        </div>
      ) : null}

      {/* Already-sent + engagement (per-channel chips — one channel sent does
          not block the other; the un-sent tab stays live) */}
      {context.alreadySent ? (
        <div
          style={{
            borderRadius: 'var(--a-r-md)',
            border: '1px solid var(--a-border)',
            background: 'var(--a-inset)',
            padding: '8px 12px',
          }}
        >
          <div className="flex flex-wrap items-center gap-1.5">
            <p style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
              Intro already sent
            </p>
            {sentSms ? <span style={badgeStyle}>Text · {formatDate(sentSms.at)}</span> : null}
            {sentEmail ? <span style={badgeStyle}>Email · {formatDate(sentEmail.at)}</span> : null}
          </div>
          <p className="a-num" style={{ ...quietTextStyle, marginTop: 4 }}>
            {context.engagement.reportViews} views · {context.engagement.linkTaps} taps ·{' '}
            {context.engagement.emailOpens} opens · {context.engagement.emailClicks} clicks
            {context.engagement.lastActivityAt ? ` · last ${formatDate(context.engagement.lastActivityAt)}` : ''}
          </p>
        </div>
      ) : null}

      <div className="grid w-full grid-cols-2 gap-2" role="group" aria-label="Channel">
        <FilterChip
          pressed={channel === 'sms'}
          disabled={!context.toPhone}
          onClick={() => setChannel('sms')}
          className="hover:opacity-80"
        >
          Text{context.toPhone ? '' : ' (no phone)'}
        </FilterChip>
        <FilterChip
          pressed={channel === 'email'}
          disabled={!context.toEmail}
          onClick={() => setChannel('email')}
          className="hover:opacity-80"
        >
          Email{context.toEmail ? '' : ' (no address)'}
        </FilterChip>
      </div>

      {channel === 'sms' ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>Message</label>
            <MergeFieldInserter channel="sms" onInsert={insertSmsToken} iconOnly />
          </div>
          <textarea
            ref={smsRef}
            aria-label="Message"
            value={smsBody}
            onChange={(e) => setSmsBody(e.target.value)}
            rows={5}
            className="av2-input w-full"
            placeholder="Message · SMS"
          />
          {smsUnresolved.length > 0 ? (
            <p style={{ ...warnTextStyle, marginTop: 6 }}>
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
            <p style={{ ...warnTextStyle, marginTop: 6 }}>Unfilled merge fields: {emailUnresolved.join(', ')}.</p>
          ) : null}
          <p style={{ ...quietTextStyle, marginTop: 6 }}>
            Sends from the broker mailbox with the audit PDF attached and a tracked link to the live report.
          </p>
        </div>
      )}

      {context.docSlug ? (
        <a
          href={`/admin/cmas/${context.docSlug}`}
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
      ) : null}

      {error ? (
        <p style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)', marginTop: 12 }}>{error}</p>
      ) : null}

      <div
        className="flex flex-col gap-2 pt-3"
        style={{ borderTop: '1px solid var(--a-border)' }}
      >
        <div className="flex items-center gap-2">
          <Button
            variant="quiet"
            touch
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
          <Button className="flex-1" touch disabled={sendDisabled} onClick={handleSendIntro}>
            {sendPending ? (
              <span className="flex items-center gap-1.5">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> Sending…
              </span>
            ) : channelSent ? (
              channel === 'sms' ? 'Text already sent' : 'Email already sent'
            ) : needsApproval ? (
              'Approve first'
            ) : channel === 'sms' ? (
              'Send text intro'
            ) : (
              'Send email intro'
            )}
          </Button>
        </div>
        <p style={quietTextStyle}>
          Sends to {context.ownerName ?? 'this owner'}. Your edits above are what sends. Every send re-checks hard-stop,
          do-not-call, suppression, and for texts quiet hours before it leaves.
        </p>
      </div>
    </div>
  )
}
