'use client'

/**
 * CRM email composer with a live "exactly what sends" preview.
 *
 * The textarea holds the editable source (template HTML or plain text, merge
 * tokens already resolved server-side). The preview pane renders the same
 * composition the send path builds — buildEmailPreviewDoc wraps
 * composeOutboundHtml(body, signature) — inside a sandboxed iframe, so brokers
 * review the rendered email, never raw HTML.
 *
 * tplKey: when a template was loaded via TemplatePicker, the parent passes the
 * template key here so the send action can stamp emailKey='tpl:<key>' on the
 * email_events row. This is what enables per-template open/click reporting.
 */
import { useMemo, useRef, useState } from 'react'
import { buildEmailPreviewDoc } from '@/lib/crm/email-body'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { MergeFieldPicker, insertAtCursor } from '@/components/admin/crm/MergeFieldPicker'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

export function EmailComposer(props: {
  initialSubject: string
  initialBody: string
  signatureHtml: string | null
  sendAction: (formData: FormData) => Promise<void>
  /** Optional: persist the current subject + body as an unsent Inbox draft (formAction override). */
  saveDraftAction?: (formData: FormData) => Promise<void>
  /** Template key that was loaded — stamped on email_events for per-template reporting. */
  tplKey?: string | null
  /** Recipient shown in the FUB-style "To" row (the lead's name + email). */
  toLabel?: string | null
}) {
  const [subject, setSubject] = useState(props.initialSubject)
  const [body, setBody] = useState(props.initialBody)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<'preview' | 'edit'>(props.initialBody ? 'preview' : 'edit')

  const previewDoc = useMemo(
    () => buildEmailPreviewDoc(body, props.signatureHtml),
    [body, props.signatureHtml],
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
      {props.toLabel ? (
        <div className="flex items-center gap-2 border-b border-border pb-2 text-sm">
          <span className="text-muted-foreground">To</span>
          <span className="truncate font-medium text-foreground">{props.toLabel}</span>
        </div>
      ) : null}
      <Input name="subject" placeholder="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} />
      <div className="flex items-center gap-2">
        <Button type="button" size="sm" variant={tab === 'preview' ? 'default' : 'ghost'} onClick={() => setTab('preview')}>
          Preview, what sends
        </Button>
        <Button type="button" size="sm" variant={tab === 'edit' ? 'default' : 'ghost'} onClick={() => setTab('edit')}>
          Edit
        </Button>
      </div>
      {tab === 'edit' ? (
        <MergeFieldPicker channel="email" onInsert={handleInsertToken} className="pb-1" />
      ) : null}
      {/* The textarea stays mounted (hidden) so the form always posts `body`. */}
      <Textarea
        ref={bodyRef}
        name="body"
        rows={10}
        placeholder="Message. Sends from the signed-in broker's own mailbox."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        className={tab === 'edit' ? '' : 'hidden'}
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
          <Button type="submit" size="sm">Send email</Button>
        </div>
      </div>
    </form>
  )
}
