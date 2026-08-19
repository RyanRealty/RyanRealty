'use client'

/**
 * CRM email composer with a live "exactly what sends" preview.
 *
 * The editing surface (subject, Preview⇄Edit tabs, Text/HTML toggle, merge
 * fields, preview iframe) is the shared EmailBodyEditor — the ONE canonical
 * email editing interface. This component wraps it with the send form:
 * To/Cc/Bcc recipients, attachments, the signature footnote, and the
 * Send / Save draft / Send-and-Close buttons.
 *
 * Attachments upload client-direct to the crm-files bucket as they're picked
 * (see ComposerAttachments) — multiple files, 10MB each / 18MB total.
 *
 * tplKey: when a template was loaded via TemplatePicker, the parent passes the
 * template key here so the send action can stamp emailKey='tpl:<key>' on the
 * email_events row. This is what enables per-template open/click reporting.
 *
 * Contact-scoped composes (personId set) additionally get:
 *   - the AI draft pill strip (aiEmailDraftAction — Reply / Introduction /
 *     Follow Up / Still Buying / Custom; fills the editable fields, never sends)
 *   - suggested-reply deep-link preload (?reply=…&replyChannel=email — see
 *     composer-preload.ts)
 * Every compose gets "Save as template" (createTemplateAction, explicit save
 * only) and the "Cc me" switch (adds the broker's own sending mailbox to Cc).
 *
 * ── Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY. This is the G50 email chokepoint ci:composer-discipline
 * requires of every email-send surface, so the props, the submit guard, the
 * idempotency-key rotation, the Cc-me derivation and every posted field name
 * are byte-for-byte what they were.
 *
 * Three notes on HOW the swap was done, because each one is a trap:
 *  - The AI draft pills were raw button elements that filled with the accent
 *    while their draft was in flight. They are FilterChips now, so the state is
 *    ANNOUNCED (aria-pressed) instead of implied by fill, and the hover the
 *    unfilled pills carried is a utility rather than an inline value — an
 *    inline value would outrank any stylesheet hover rule.
 *  - The Send ▾ split button became the v2 Menu. The two halves no longer share
 *    a border radius, because `.av2-btn` sets radius unlayered and a Tailwind
 *    `rounded-r-none` on it is silently dead. What the menu gains is the
 *    keyboard behaviour the shadcn trigger had and a hand-rolled one loses:
 *    arrow keys, Home/End, Escape-returns-focus, and a lit trigger while its
 *    panel is up.
 *  - The hidden compound-submit button is hidden by an INLINE display, not by
 *    `className="hidden"`. `.av2-btn` declares `display:inline-flex` unlayered,
 *    so the utility loses and the button would have been VISIBLE. It still
 *    responds to .click() — display:none does not block programmatic clicks.
 */
import { useEffect, useRef, useState, useTransition } from 'react'
import { useFormStatus } from 'react-dom'
import { ChevronDown, Loader2, Plus, Sparkles } from 'lucide-react'
import { newIdempotencyKey } from '@/lib/admin/mutation-result'
import { aiEmailDraftAction, getCcSelfAddressAction } from '@/app/actions/crm-inbox'
import { type AiEmailDraftKind } from '@/components/admin/crm/ai-email-draft'
import { consumeSuggestedReply } from '@/components/admin/crm/composer-preload'
import { createSubmitGuard } from '@/components/admin/crm/composer-submit-guard'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import type { CustomFieldToken } from '@/components/admin/crm/MergeFieldInserter'
import { RecipientField, type RecipientOption } from '@/components/admin/crm/RecipientField'
import { SaveAsTemplateButton } from '@/components/admin/crm/SaveAsTemplateDialog'
import {
  AttachmentChips,
  AttachmentControl,
  useComposerAttachments,
} from '@/components/admin/crm/ComposerAttachments'
import type { CrmAttachmentRef } from '@/lib/crm/attachment-limits'
import { Button, FilterChip, Menu, SearchField, Switch } from '@/components/admin/v2'
import { cn } from '@/lib/utils'

/**
 * Pending-aware Send button (admin rebuild §4.2, RC2 fix). useFormStatus disables
 * it + shows a spinner while the multi-second send runs, so the broker sees the
 * send happening and can't fire it twice. Rotates the idempotency key on settle.
 */
function EmailSendButton(props: {
  disabled: boolean
  uploading: boolean
  label: string
  className?: string
  onSettled: () => void
}) {
  const { pending } = useFormStatus()
  const wasPending = useRef(false)
  useEffect(() => {
    if (wasPending.current && !pending) props.onSettled()
    wasPending.current = pending
  }, [pending, props])
  return (
    <Button type="submit" disabled={props.disabled || pending} aria-busy={pending} className={props.className}>
      {pending ? (
        <span className="flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> Sending…</span>
      ) : props.uploading ? (
        'Uploading…'
      ) : (
        props.label
      )}
    </Button>
  )
}

/**
 * AI email draft pill strip (the email twin of the mobile inbox's SMS
 * MobileAiPills — closes the "AI drafts exist only for SMS" gap). A pill asks
 * aiEmailDraftAction for a Claude draft and fills the editable subject/body.
 * The broker ALWAYS reviews and edits before sending — this never sends
 * (spec §27 S3 step 6: auto-send of AI content is prohibited).
 */
const EMAIL_AI_PILLS: Array<{ kind: AiEmailDraftKind; label: string }> = [
  { kind: 'reply', label: 'Reply' },
  { kind: 'introduction', label: 'Introduction' },
  { kind: 'follow_up', label: 'Follow Up' },
  { kind: 'still_buying', label: 'Still Buying' },
]

function EmailAiDrafts(props: {
  personId: number
  onDraft: (draft: { subject: string; body: string }) => void
}) {
  const [active, setActive] = useState<AiEmailDraftKind | null>(null)
  const [customOpen, setCustomOpen] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  function run(kind: AiEmailDraftKind, prompt?: string) {
    setActive(kind)
    setError(null)
    startTransition(async () => {
      const res = await aiEmailDraftAction(props.personId, kind, prompt)
      if (res.ok) props.onDraft({ subject: res.subject, body: res.body })
      else setError(res.error)
      setActive(null)
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto py-0.5">
        {EMAIL_AI_PILLS.map((p) => {
          const isActive = pending && active === p.kind
          return (
            <FilterChip
              key={p.kind}
              pressed={isActive}
              disabled={pending}
              onClick={() => run(p.kind)}
              // No dimming under the pointer while a draft is in flight — the
              // pills are disabled then, and a hover on a dead control lies.
              className={cn('inline-flex shrink-0 items-center gap-1', !pending && 'hover:opacity-80')}
            >
              {isActive ? (
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              ) : (
                <Sparkles className="h-3 w-3" aria-hidden />
              )}
              {p.label}
            </FilterChip>
          )
        })}
        {/* The Custom pill DISCLOSES the prompt row, so its pressed state is the
            row's open state — aria-pressed now says what the row already shows. */}
        <FilterChip
          pressed={customOpen}
          disabled={pending}
          onClick={() => setCustomOpen((v) => !v)}
          className={cn('inline-flex shrink-0 items-center gap-1', !pending && 'hover:opacity-80')}
        >
          <Plus className="h-3 w-3" aria-hidden />
          Custom
        </FilterChip>
      </div>
      {customOpen ? (
        <div className="flex items-center gap-1.5">
          <SearchField
            type="text"
            aria-label="Custom draft instructions"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="What should the email say?"
            onKeyDown={(e) => {
              // Enter drafts — never submit (and never SEND) the outer form.
              if (e.key === 'Enter') {
                e.preventDefault()
                if (customPrompt.trim()) run('custom', customPrompt.trim())
              }
            }}
            style={{ width: '100%', maxWidth: 'none', fontSize: 'var(--a-text-md)' }}
          />
          <Button
            type="button"
            variant="quiet"
            disabled={pending || !customPrompt.trim()}
            onClick={() => run('custom', customPrompt.trim())}
          >
            Draft
          </Button>
        </div>
      ) : null}
      {error ? <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>{error}</p> : null}
    </div>
  )
}

export function EmailComposer(props: {
  initialSubject: string
  initialBody: string
  signatureHtml: string | null
  sendAction: (formData: FormData) => Promise<void>
  /** Optional: persist the current subject + body as an unsent Inbox draft (formAction override). */
  saveDraftAction?: (formData: FormData) => Promise<void>
  /** Optional: Send ▾ → "Send and Close" compound action (inbox AC-16). */
  sendAndCloseAction?: (formData: FormData) => Promise<void>
  /** Template key that was loaded — stamped on email_events for per-template reporting. */
  tplKey?: string | null
  /** Recipient shown in the CRM-style "To" row (the lead's name + email). */
  toLabel?: string | null
  /** Contact this compose targets — required for attachments (upload scoping). */
  personId?: number
  /** Known addresses for the To/Cc/Bcc pickers (contact's emails + linked people). */
  recipientOptions?: RecipientOption[]
  /** Prefill for the To row (the contact's primary email). */
  initialTo?: string[]
  /** Staged CRM-file refs (CMA PDF) — already uploaded, never a mailto/Gmail draft. */
  initialAttachments?: CrmAttachmentRef[]
  /** Live crm_field_definitions → Custom Fields group in the merge-field dropdown. */
  customFields?: CustomFieldToken[]
  /* ── Variant props — every email-send surface renders THIS component; these
        let hosts with a fixed/externally-picked audience or their own send
        semantics reuse the one canonical interface (Matt directive 2026-07-15:
        "anytime a text or email is sent it uses the same interface"). ── */
  /** Hide To/Cc/Bcc rows (recipient is fixed or picked by the host surface). */
  hideRecipients?: boolean
  /** Hide the attachment control (host path attaches its own files, or no contact scope). */
  hideAttachments?: boolean
  /** Hide the CRM merge-field dropdown (host path resolves its own tokens). */
  hideMergeFields?: boolean
  /** Replaces the default signature footnote; null hides the line entirely. */
  footnote?: string | null
  /** Externally gate the send button (e.g. a review-ack checkbox in the host). */
  sendDisabled?: boolean
  /** Hide the AI draft pill strip (shown by default on contact-scoped composes). */
  hideAiDrafts?: boolean
  submitLabel?: string
}) {
  const [subject, setSubject] = useState(props.initialSubject)
  const [body, setBody] = useState(props.initialBody)
  const sendCloseRef = useRef<HTMLButtonElement>(null)
  // Per-attempt idempotency key (server backstop for the sub-frame double-tap).
  const [idempotencyKey, setIdempotencyKey] = useState('')
  useEffect(() => setIdempotencyKey(newIdempotencyKey()), [])

  // Same-tick double-submit guard — mechanism note + unit tests in
  // ./composer-submit-guard.ts (two same-tick submissions abort EACH OTHER'S
  // action POST: no duplicate send, but the composer hung on "sending" forever).
  const [submitGuard] = useState(createSubmitGuard)

  // Attachments (multiple, uploaded client-direct — see ComposerAttachments).
  const attachments = useComposerAttachments({ personId: props.personId, channel: 'email' })
  useEffect(() => {
    for (const ref of props.initialAttachments ?? []) attachments.addReady(ref)
    // Seed once when this compose instance mounts (key includes the CMA slug).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Recipients — To/Cc/Bcc rows post JSON arrays; an empty To sends to the
  // contact's primary email (the send action's fallback).
  const [to, setTo] = useState<string[]>(props.initialTo ?? [])
  const [cc, setCc] = useState<string[]>([])
  const [bcc, setBcc] = useState<string[]>([])
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  // "Cc me" — one switch that adds the acting broker's own sending mailbox to
  // Cc (resolved server-side the same way the send action picks its
  // from-mailbox). Checked state derives from the cc list, so removing the
  // chip by hand un-checks the switch too.
  const [selfAddr, setSelfAddr] = useState<string | null>(null)
  const [ccSelfPending, startCcSelf] = useTransition()
  const ccMeOn = selfAddr !== null && cc.includes(selfAddr)
  function toggleCcMe(next: boolean) {
    if (!next) {
      if (selfAddr) setCc((prev) => prev.filter((a) => a !== selfAddr))
      return
    }
    if (selfAddr) {
      setCc((prev) => (prev.includes(selfAddr) ? prev : [...prev, selfAddr]))
      setShowCc(true)
      return
    }
    startCcSelf(async () => {
      const res = await getCcSelfAddressAction()
      if (!res.ok) return
      setSelfAddr(res.email)
      setCc((prev) => (prev.includes(res.email) ? prev : [...prev, res.email]))
      setShowCc(true)
    })
  }

  // Suggested-reply deep link (?reply=…&replyChannel=email) — preload an EMPTY
  // compose only, on contact-scoped surfaces. See composer-preload.ts.
  useEffect(() => {
    if (!props.personId) return
    const pre = consumeSuggestedReply('email')
    if (!pre) return
    setBody((b) => (b.trim() ? b : pre.body))
    if (pre.subject) setSubject((s) => (s.trim() ? s : pre.subject!))
  }, [props.personId])

  return (
    <form
      action={props.sendAction}
      onSubmit={(e) => submitGuard.onSubmit(e, window.location.search)}
      className="space-y-2"
    >
      {/* Hidden field carries the template key for email_events stamping. */}
      {props.tplKey ? <input type="hidden" name="tplKey" value={props.tplKey} /> : null}
      {/* Per-attempt idempotency key — the server backstop against a double-send. */}
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      {/* Recipients — Gmail-style rows; Cc/Bcc reveal on demand. Empty To
          falls back to the contact's primary email server-side. */}
      <div className={cn('space-y-1', props.hideRecipients && 'hidden')}>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <RecipientField
              name="to"
              label="To"
              values={to}
              onChange={setTo}
              options={props.recipientOptions}
              placeholder={props.toLabel ?? 'Recipient email'}
            />
          </div>
          <div className="mt-1.5 flex shrink-0 items-center gap-2">
            {!showCc ? (
              <Button type="button" variant="quiet" className="av2-textlink" onClick={() => setShowCc(true)}>Cc</Button>
            ) : null}
            {!showBcc ? (
              <Button type="button" variant="quiet" className="av2-textlink" onClick={() => setShowBcc(true)}>Bcc</Button>
            ) : null}
            {/* Cc me — copies the send to the broker's own mailbox. The primitive
                owns the wrapping label element, so the visible caption and the
                accessible name both survive the swap. */}
            <Switch
              label="Cc me on this email"
              stateText="Cc me"
              labelHidden
              checked={ccMeOn}
              onChange={(e) => toggleCcMe(e.target.checked)}
              disabled={ccSelfPending}
            />
          </div>
        </div>
        {showCc ? (
          <RecipientField name="cc" label="Cc" values={cc} onChange={setCc} options={props.recipientOptions} />
        ) : (
          <input type="hidden" name="cc" value={cc.length ? JSON.stringify(cc) : ''} />
        )}
        {showBcc ? (
          <RecipientField name="bcc" label="Bcc" values={bcc} onChange={setBcc} options={props.recipientOptions} />
        ) : (
          <input type="hidden" name="bcc" value={bcc.length ? JSON.stringify(bcc) : ''} />
        )}
      </div>

      {/* AI drafts — contact-scoped composes only. Fills the editable
          subject/body; the broker reviews + edits; sending stays gated. */}
      {props.personId && !props.hideAiDrafts ? (
        <EmailAiDrafts
          personId={props.personId}
          onDraft={(draft) => {
            setBody(draft.body)
            if (draft.subject) setSubject((s) => (s.trim() ? s : draft.subject))
          }}
        />
      ) : null}

      {/* The canonical editing surface (subject + preview/edit + format + merge). */}
      <EmailBodyEditor
        subject={subject}
        onSubjectChange={setSubject}
        body={body}
        onBodyChange={setBody}
        signatureHtml={props.signatureHtml}
        hideMergeFields={props.hideMergeFields}
        customFields={props.customFields}
        toolbarExtra={
          !props.hideAttachments ? (
            <AttachmentControl attachments={attachments} ariaLabel="Attach files" />
          ) : null
        }
      />
      <AttachmentChips items={attachments.items} onRemove={attachments.remove} />

      <div className="flex items-center justify-between gap-4">
        {props.footnote !== null ? (
          <span className="text-xs" style={{ color: 'var(--a-text-2)' }}>
            {props.footnote ?? 'Your signature and the Oregon agency disclosure link are added to every send.'}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {/* Low-prominence: keep a broker-tweaked reply without leaving the flow. */}
          {body.trim() ? (
            <SaveAsTemplateButton channel="email" subject={subject} body={body} />
          ) : null}
          {props.saveDraftAction ? (
            <Button type="submit" formAction={props.saveDraftAction} data-composer-draft="" variant="quiet" disabled={!subject.trim() && !body.trim()}>
              Save draft
            </Button>
          ) : null}
          <div className="flex items-center gap-1">
            <EmailSendButton
              disabled={Boolean(attachments.uploading || props.sendDisabled)}
              uploading={attachments.uploading}
              label={props.submitLabel ?? 'Send email'}
              onSettled={() => {
                submitGuard.settle()
                setIdempotencyKey(newIdempotencyKey())
                // A successful SEND clears the compose state (a lingering sent
                // email LOOKED unsent); a failed send changes the URL
                // (?error=) and a draft-save keeps the text — both keep it.
                try {
                  if (!submitGuard.lastWasDraft && submitGuard.sendSucceeded(window.location.search)) {
                    setSubject('')
                    setBody('')
                  }
                } catch {
                  /* non-fatal */
                }
              }}
            />
            {props.sendAndCloseAction ? (
              <>
                {/* Hidden submit carries the compound formAction; the menu clicks it. */}
                <Button
                  type="submit"
                  formAction={props.sendAndCloseAction}
                  ref={sendCloseRef}
                  variant="quiet"
                  aria-hidden
                  tabIndex={-1}
                  style={{ display: 'none' }}
                />
                <Menu
                  label="More send options"
                  trigger={<ChevronDown className="h-3.5 w-3.5" aria-hidden />}
                  items={[{ label: 'Send and Close', onSelect: () => sendCloseRef.current?.click() }]}
                />
              </>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  )
}
