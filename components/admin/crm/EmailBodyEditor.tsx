'use client'

/**
 * EmailBodyEditor — the canonical email EDITING surface: subject row,
 * "Preview, what sends" ⇄ Edit tabs, Text/HTML body-format toggle, merge-field
 * dropdown, sandboxed preview iframe, unresolved-merge warning.
 *
 * EmailComposer renders this inside its send form (recipients + attachments +
 * send buttons wrap around it); bulk surfaces with their own audience +
 * dispatch flow (ComposeToCohort, the people-list Batch Email dialog) embed it
 * directly as a controlled component. One editing interface everywhere a
 * message body is written (Matt directive 2026-07-15).
 *
 * The subject/body inputs carry name="subject"/name="body" (+ hidden
 * bodyFormat) so a host <form> posts them unchanged — controlled and
 * form-postable at once.
 */

import { useMemo, useRef, useState } from 'react'
import { buildEmailPreviewDoc, looksLikeHtml, type EmailBodyFormat } from '@/lib/crm/email-body'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { MergeFieldInserter, insertAtCursor, type CustomFieldToken } from '@/components/admin/crm/MergeFieldInserter'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'

export function EmailBodyEditor(props: {
  subject: string
  onSubjectChange: (subject: string) => void
  body: string
  onBodyChange: (body: string) => void
  /** Signature rendered into the preview (null → preview body only). */
  signatureHtml?: string | null
  /** Hide the CRM merge-field dropdown (host resolves its own token syntax). */
  hideMergeFields?: boolean
  /** Live crm_field_definitions → Custom Fields group in the merge dropdown. */
  customFields?: CustomFieldToken[]
  /** Extra toolbar control (EmailComposer injects its attachment button). */
  toolbarExtra?: React.ReactNode
  subjectPlaceholder?: string
  bodyPlaceholder?: string
}) {
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const [tab, setTab] = useState<'preview' | 'edit'>(props.body ? 'preview' : 'edit')
  // Text vs HTML body interpretation — seeded from the initial body, broker
  // can override. Posts as bodyFormat; preview uses the same value.
  const [format, setFormat] = useState<Exclude<EmailBodyFormat, 'auto'>>(
    looksLikeHtml(props.body) ? 'html' : 'text',
  )

  const previewDoc = useMemo(
    () => buildEmailPreviewDoc(props.body, props.signatureHtml ?? null, format),
    [props.body, props.signatureHtml, format],
  )
  const unresolved = useMemo(
    () => findUnresolvedMergeTokens(props.subject + ' ' + props.body),
    [props.subject, props.body],
  )

  function handleInsertToken(token: string) {
    const el = bodyRef.current
    if (!el) {
      props.onBodyChange(props.body + token)
      return
    }
    const next = insertAtCursor(el, token)
    props.onBodyChange(next)
    const pos = (el.selectionStart ?? 0) + token.length
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="space-y-2">
      <input type="hidden" name="bodyFormat" value={format} />
      <Input
        name="subject"
        placeholder={props.subjectPlaceholder ?? 'Subject'}
        value={props.subject}
        onChange={(e) => props.onSubjectChange(e.target.value)}
      />
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
          {tab === 'edit' && !props.hideMergeFields ? (
            <MergeFieldInserter channel="email" customFields={props.customFields} onInsert={handleInsertToken} />
          ) : null}
          {/* Text | HTML body-mode toggle. */}
          <div className="flex items-center overflow-hidden rounded-full border border-input text-xs">
            <Button
              type="button"
              size="sm"
              variant={format === 'text' ? 'default' : 'ghost'}
              onClick={() => setFormat('text')}
              aria-pressed={format === 'text'}
              className={cn('h-auto rounded-none px-2.5 py-1 text-xs', format === 'text' ? '' : 'text-muted-foreground hover:text-foreground')}
            >
              Text
            </Button>
            <Button
              type="button"
              size="sm"
              variant={format === 'html' ? 'default' : 'ghost'}
              onClick={() => setFormat('html')}
              aria-pressed={format === 'html'}
              className={cn('h-auto rounded-none px-2.5 py-1 text-xs', format === 'html' ? '' : 'text-muted-foreground hover:text-foreground')}
            >
              HTML
            </Button>
          </div>
          {props.toolbarExtra}
        </div>
      </div>
      {/* The textarea stays mounted (hidden) so a host form always posts `body`. */}
      <Textarea
        ref={bodyRef}
        name="body"
        rows={10}
        placeholder={
          props.bodyPlaceholder ??
          (format === 'html' ? 'Paste or write HTML. Preview shows the rendered email.' : "Message. Sends from the signed-in broker's own mailbox.")
        }
        value={props.body}
        onChange={(e) => props.onBodyChange(e.target.value)}
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
    </div>
  )
}
