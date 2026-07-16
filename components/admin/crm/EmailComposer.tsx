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
 */
import { useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import type { CustomFieldToken } from '@/components/admin/crm/MergeFieldInserter'
import { RecipientField, type RecipientOption } from '@/components/admin/crm/RecipientField'
import {
  AttachmentChips,
  AttachmentControl,
  useComposerAttachments,
} from '@/components/admin/crm/ComposerAttachments'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

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
  /** Recipient shown in the FUB-style "To" row (the lead's name + email). */
  toLabel?: string | null
  /** Contact this compose targets — required for attachments (upload scoping). */
  personId?: number
  /** Known addresses for the To/Cc/Bcc pickers (contact's emails + linked people). */
  recipientOptions?: RecipientOption[]
  /** Prefill for the To row (the contact's primary email). */
  initialTo?: string[]
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
  submitLabel?: string
}) {
  const [subject, setSubject] = useState(props.initialSubject)
  const [body, setBody] = useState(props.initialBody)
  const sendCloseRef = useRef<HTMLButtonElement>(null)

  // Attachments (multiple, uploaded client-direct — see ComposerAttachments).
  const attachments = useComposerAttachments({ personId: props.personId, channel: 'email' })

  // Recipients — To/Cc/Bcc rows post JSON arrays; an empty To sends to the
  // contact's primary email (the send action's fallback).
  const [to, setTo] = useState<string[]>(props.initialTo ?? [])
  const [cc, setCc] = useState<string[]>([])
  const [bcc, setBcc] = useState<string[]>([])
  const [showCc, setShowCc] = useState(false)
  const [showBcc, setShowBcc] = useState(false)

  return (
    <form action={props.sendAction} className="space-y-2">
      {/* Hidden field carries the template key for email_events stamping. */}
      {props.tplKey ? <input type="hidden" name="tplKey" value={props.tplKey} /> : null}
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
          {!showCc || !showBcc ? (
            <div className="mt-1.5 flex shrink-0 items-center gap-2 text-xs text-muted-foreground">
              {!showCc ? (
                <button type="button" onClick={() => setShowCc(true)} className="hover:text-foreground">Cc</button>
              ) : null}
              {!showBcc ? (
                <button type="button" onClick={() => setShowBcc(true)} className="hover:text-foreground">Bcc</button>
              ) : null}
            </div>
          ) : null}
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
            <AttachmentControl
              attachments={attachments}
              ariaLabel="Attach files"
              className="h-8 w-8 shrink-0 rounded-full"
            />
          ) : null
        }
      />
      <AttachmentChips items={attachments.items} onRemove={attachments.remove} />

      <div className="flex items-center justify-between gap-4">
        {props.footnote !== null ? (
          <span className="text-xs text-muted-foreground">
            {props.footnote ?? 'Your signature and the Oregon agency disclosure link are added to every send.'}
          </span>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          {props.saveDraftAction ? (
            <Button type="submit" formAction={props.saveDraftAction} variant="ghost" size="sm" disabled={!subject.trim() && !body.trim()}>
              Save draft
            </Button>
          ) : null}
          <div className="flex items-center">
            <Button
              type="submit"
              size="sm"
              disabled={attachments.uploading || props.sendDisabled}
              className={props.sendAndCloseAction ? 'rounded-r-none' : undefined}
            >
              {attachments.uploading ? 'Uploading…' : props.submitLabel ?? 'Send email'}
            </Button>
            {props.sendAndCloseAction ? (
              <>
                {/* Hidden submit carries the compound formAction; the menu clicks it. */}
                <button type="submit" formAction={props.sendAndCloseAction} ref={sendCloseRef} className="hidden" aria-hidden tabIndex={-1} />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button type="button" size="sm" className="rounded-l-none border-l border-primary-foreground/20 px-1.5" aria-label="More send options">
                      <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => sendCloseRef.current?.click()}>
                      Send and Close
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </form>
  )
}
