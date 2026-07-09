'use client'

/**
 * CRM email composer with a live "exactly what sends" preview.
 *
 * The textarea holds the editable source (template HTML or plain text, merge
 * tokens already resolved server-side). The preview pane renders the same
 * composition the send path builds — buildEmailPreviewDoc wraps
 * composeOutboundHtml(body, signature, format) — inside a sandboxed iframe,
 * so brokers review the rendered email, never raw HTML.
 *
 * Text/HTML mode: the broker picks how the body is interpreted (defaults to
 * auto-detection of the initial body). The choice posts as `bodyFormat`, and
 * the preview + send path share the same format, keeping preview byte-equal
 * to what sends.
 *
 * Attachments upload client-direct to the crm-files bucket as they're picked
 * (see ComposerAttachments) — multiple files, 10MB each / 18MB total.
 *
 * tplKey: when a template was loaded via TemplatePicker, the parent passes the
 * template key here so the send action can stamp emailKey='tpl:<key>' on the
 * email_events row. This is what enables per-template open/click reporting.
 */
import { useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { buildEmailPreviewDoc, looksLikeHtml, type EmailBodyFormat } from '@/lib/crm/email-body'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { MergeFieldPicker, insertAtCursor } from '@/components/admin/crm/MergeFieldPicker'
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
}) {
  const [subject, setSubject] = useState(props.initialSubject)
  const [body, setBody] = useState(props.initialBody)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const sendCloseRef = useRef<HTMLButtonElement>(null)
  const [tab, setTab] = useState<'preview' | 'edit'>(props.initialBody ? 'preview' : 'edit')
  // Text vs HTML body interpretation — seeded from the initial body, broker
  // can override. Posts as bodyFormat; preview uses the same value.
  const [format, setFormat] = useState<Exclude<EmailBodyFormat, 'auto'>>(
    looksLikeHtml(props.initialBody) ? 'html' : 'text',
  )

  // Attachments (multiple, uploaded client-direct — see ComposerAttachments).
  const attachments = useComposerAttachments({ personId: props.personId, channel: 'email' })

  const previewDoc = useMemo(
    () => buildEmailPreviewDoc(body, props.signatureHtml, format),
    [body, props.signatureHtml, format],
  )
  const unresolved = useMemo(() => findUnresolvedMergeTokens(subject + ' ' + body), [subject, body])

  function handleInsertToken(token: string) {
    const el = bodyRef.current
    if (!el) {
      setBody((b) => b + token)
      return
    }
    const next = insertAtCursor(el, token)
    setBody(next)
    // Restore cursor after inserted token
    const pos = (el.selectionStart ?? 0) + token.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <form action={props.sendAction} className="space-y-2">
      {/* Hidden field carries the template key for email_events stamping. */}
      {props.tplKey ? <input type="hidden" name="tplKey" value={props.tplKey} /> : null}
      <input type="hidden" name="bodyFormat" value={format} />
      {props.toLabel ? (
        <div className="flex items-center gap-2 border-b border-border pb-2 text-sm">
          <span className="text-muted-foreground">To</span>
          <span className="truncate font-medium text-foreground">{props.toLabel}</span>
        </div>
      ) : null}
      <Input name="subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button type="button" size="sm" variant={tab === 'preview' ? 'default' : 'ghost'} onClick={() => setTab('preview')}>
            Preview, what sends
          </Button>
          <Button type="button" size="sm" variant={tab === 'edit' ? 'default' : 'ghost'} onClick={() => setTab('edit')}>
            Edit
          </Button>
        </div>
        <div className="flex items-center gap-1">
          {/* Text | HTML body-mode toggle. */}
          <div className="flex items-center overflow-hidden rounded-full border border-input text-xs">
            <button
              type="button"
              onClick={() => setFormat('text')}
              aria-pressed={format === 'text'}
              className={cn('px-2.5 py-1', format === 'text' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setFormat('html')}
              aria-pressed={format === 'html'}
              className={cn('px-2.5 py-1', format === 'html' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              HTML
            </button>
          </div>
          <AttachmentControl
            attachments={attachments}
            ariaLabel="Attach files"
            className="h-8 w-8 shrink-0 rounded-full"
          />
        </div>
      </div>
      <AttachmentChips items={attachments.items} onRemove={attachments.remove} />
      {tab === 'edit' ? (
        <MergeFieldPicker channel="email" onInsert={handleInsertToken} className="pb-1" />
      ) : null}
      {/* The textarea stays mounted (hidden) so the form always posts `body`. */}
      <Textarea
        ref={bodyRef}
        name="body"
        rows={10}
        placeholder={format === 'html' ? 'Paste or write HTML. Preview shows the rendered email.' : "Message. Sends from the signed-in broker's own mailbox."}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={cn(tab === 'edit' ? '' : 'hidden', format === 'html' && 'font-mono text-xs')}
      />
      {tab === 'preview' ? (
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={previewDoc}
          className="h-96 w-full rounded-xl border border-border bg-card"
        />
      ) : null}
      {unresolved.length > 0 ? (
        <p className="text-xs font-medium text-warning">
          Unfilled merge fields, this contact has no value for: {unresolved.join(', ')}. Edit before sending.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4">
        <span className="text-xs text-muted-foreground">Your signature and the Oregon agency disclosure link are added to every send.</span>
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
              disabled={attachments.uploading}
              className={props.sendAndCloseAction ? 'rounded-r-none' : undefined}
            >
              {attachments.uploading ? 'Uploading…' : 'Send email'}
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
