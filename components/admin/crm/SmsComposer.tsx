'use client'

/**
 * CRM SMS composer with a phone-style preview of exactly what will be sent.
 * Merge tokens are resolved server-side before the initial body lands here,
 * so the bubble shows the final text with real values.
 *
 * MergeFieldPicker added: click a chip to insert the token at cursor position
 * in the body textarea.
 */
import { useMemo, useRef, useState } from 'react'
import { ArrowUp } from 'lucide-react'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { MergeFieldPicker, insertAtCursor } from '@/components/admin/crm/MergeFieldPicker'
import {
  AttachmentChips,
  AttachmentControl,
  useComposerAttachments,
} from '@/components/admin/crm/ComposerAttachments'
import { MMS_ACCEPT_ATTR } from '@/lib/crm/attachment-limits'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'

function segmentInfo(text: string): { chars: number; segments: number } {
  const gsm = /^[A-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#%&'()*+,\-./:;<=>?¡ÄÖÑܧ¿äöñüà\n\r^{}\\[~\]|€]*$/.test(text)
  const chars = text.length
  if (chars === 0) return { chars: 0, segments: 0 }
  const single = gsm ? 160 : 70
  const multi = gsm ? 153 : 67
  return { chars, segments: chars <= single ? 1 : Math.ceil(chars / multi) }
}

/** A group-text recipient. personId 0 = a raw thread number with no contact
 *  record (still included so a group reply drops nobody). defaultOn pre-selects
 *  it (group-thread participants come pre-checked; relationships start off). */
export type SmsRecipient = { personId: number; name: string; phone: string; relation: string; defaultOn?: boolean }

/** Stable per-recipient key: contact id when we have one, else the phone. */
function recipKey(r: SmsRecipient): string {
  return r.personId > 0 ? `p${r.personId}` : `ph${r.phone}`
}

export function SmsComposer(props: {
  initialBody: string
  sendAction: (formData: FormData) => Promise<void>
  /** Optional: persist the current body as an unsent Inbox draft (formAction override). */
  saveDraftAction?: (formData: FormData) => Promise<void>
  /** Optional: "Send & Close" compound action (inbox AC-16). */
  sendAndCloseAction?: (formData: FormData) => Promise<void>
  /** The lead + linked people (spouse, …) the broker can add to a group text. */
  recipients?: SmsRecipient[]
  primaryPersonId?: number
  /** Contact this compose targets — required for attachments (upload scoping).
   *  Falls back to primaryPersonId when unset. */
  personId?: number
}) {
  const [body, setBody] = useState(props.initialBody)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const { chars, segments } = segmentInfo(body)
  const unresolved = useMemo(() => findUnresolvedMergeTokens(body), [body])

  // MMS attachments (images/PDF, up to 10, 5MB total — uploaded client-direct;
  // see ComposerAttachments). Applied to every recipient in a group text.
  const attachments = useComposerAttachments({
    personId: props.personId ?? props.primaryPersonId,
    channel: 'mms',
  })

  const recipients = props.recipients ?? []
  // The lead is always a recipient. Group-thread participants (defaultOn) start
  // CHECKED so a reply auto-includes everyone; relationships start off (tap to add).
  // Keyed by recipKey so raw numbers (personId 0) don't all collide on 0.
  const [selectedExtra, setSelectedExtra] = useState<Set<string>>(
    () => new Set(recipients.filter((r) => r.defaultOn && r.personId !== props.primaryPersonId).map(recipKey)),
  )
  function toggleExtra(key: string) {
    setSelectedExtra((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }
  // Selected split into contact ids vs raw phone numbers for the send action.
  const selectedRecips = recipients.filter((r) => r.personId !== props.primaryPersonId && selectedExtra.has(recipKey(r)))
  const extraIds = selectedRecips.filter((r) => r.personId > 0).map((r) => r.personId).join(',')
  const extraPhones = selectedRecips.filter((r) => r.personId === 0).map((r) => r.phone).join(',')

  function handleInsertToken(token: string) {
    const el = bodyRef.current
    if (!el) {
      setBody((b) => b + token)
      return
    }
    const next = insertAtCursor(el, token)
    setBody(next)
    const pos = (el.selectionStart ?? 0) + token.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <form action={props.sendAction} className="space-y-2">
      {/* Recipients — the lead is always on; tap a linked person (spouse, …) to
          add them to the same text. No typing needed. */}
      {recipients.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-0.5 text-xs font-medium text-muted-foreground">To</span>
          {recipients.map((r) => {
            const isPrimary = r.personId === props.primaryPersonId
            const key = recipKey(r)
            const on = isPrimary || selectedExtra.has(key)
            return (
              <Button
                key={key}
                type="button"
                size="sm"
                variant={on ? 'default' : 'outline'}
                disabled={isPrimary}
                onClick={() => toggleExtra(key)}
                className="h-7 rounded-full px-3 text-xs disabled:opacity-100"
                title={r.phone}
              >
                {on && !isPrimary ? '✓ ' : ''}{r.name}{r.relation !== 'Primary' ? ` · ${r.relation}` : ''}
              </Button>
            )
          })}
          <input type="hidden" name="recipientIds" value={extraIds} />
          <input type="hidden" name="recipientPhones" value={extraPhones} />
          {selectedRecips.length > 0 ? (
            <span className="basis-full text-[11px] text-muted-foreground">Replies to {selectedRecips.length + 1} people</span>
          ) : null}
        </div>
      ) : null}
      {unresolved.length > 0 ? (
        <p className="px-1 text-xs font-medium text-warning">
          Unfilled merge fields, this contact has no value for: {unresolved.join(', ')}. Edit before sending.
        </p>
      ) : null}

      <AttachmentChips items={attachments.items} onRemove={attachments.remove} />

      {/* FUB chat input bar: insert-field · paperclip · message · round send arrow. */}
      <div className="flex items-end gap-1.5 rounded-3xl border border-input bg-background py-1.5 pl-1.5 pr-1.5">
        {/* Merge fields — dropdown behind the braces icon so the bar stays clean. */}
        <MergeFieldPicker channel="sms" onInsert={handleInsertToken} iconOnly />
        <AttachmentControl
          attachments={attachments}
          accept={MMS_ACCEPT_ATTR}
          ariaLabel="Attach images or PDFs"
          className="h-9 w-9 shrink-0 rounded-full"
          iconClassName="h-5 w-5"
        />
        <Textarea
          ref={bodyRef}
          name="body"
          rows={1}
          placeholder="Text message · SMS"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="max-h-32 min-h-9 flex-1 resize-none self-center border-0 bg-transparent px-1 py-1.5 text-sm shadow-none focus-visible:ring-0"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!body.trim() || attachments.uploading}
          aria-label={attachments.uploading ? 'Uploading attachment' : 'Send text'}
          className="h-9 w-9 shrink-0 rounded-full"
        >
          <ArrowUp className="h-5 w-5" aria-hidden />
        </Button>
      </div>

      {/* Quiet-hours override + live segment count, quiet under the bar. */}
      <div className="flex items-center justify-between gap-3 px-1">
        <label className="flex items-center gap-1.5 text-xs font-normal text-muted-foreground">
          <Checkbox id="overrideQuietHours" name="overrideQuietHours" value="1" />
          Send anyway (quiet hours)
        </label>
        <div className="flex shrink-0 items-center gap-3">
          {props.saveDraftAction ? (
            <Button
              type="submit"
              formAction={props.saveDraftAction}
              variant="ghost"
              size="sm"
              disabled={!body.trim()}
              className="h-7 px-2 text-xs"
            >
              Save draft
            </Button>
          ) : null}
          {props.sendAndCloseAction ? (
            <Button
              type="submit"
              formAction={props.sendAndCloseAction}
              variant="ghost"
              size="sm"
              disabled={!body.trim()}
              className="h-7 px-2 text-xs"
            >
              Send &amp; Close
            </Button>
          ) : null}
          {body.trim() ? (
            <span className="text-xs tabular-nums text-muted-foreground">
              {chars} · {segments} {segments === 1 ? 'segment' : 'segments'}
            </span>
          ) : null}
        </div>
      </div>
    </form>
  )
}
