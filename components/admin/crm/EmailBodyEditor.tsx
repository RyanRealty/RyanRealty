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
 *
 * ── Migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * PRESENTATION ONLY. This is the G50 compose chokepoint ci:composer-discipline
 * requires of every bulk send host, mounted by at least eight surfaces, so the
 * props, the tab/format state, the merge-token insertion, the preview build and
 * every posted field name are byte-for-byte what they were.
 *
 * Three notes on HOW the swap was done, because each one is a trap:
 *  - The two "pick one of N" rows (Preview/Edit, Text/HTML) were shadcn Buttons
 *    whose selected member carried the primary variant. They are FilterChips
 *    now, so the state is ANNOUNCED (aria-pressed) instead of implied by fill —
 *    the same call recorded in RoutingEditor. The unselected members carried a
 *    hover, so the chips carry one too; it is a Tailwind utility rather than an
 *    inline style, because an inline value would outrank any stylesheet hover.
 *  - The body box is a raw control + `av2-input` + aria-label, the folder's
 *    pattern for an unlabelled field (MobileEditSheet, MobileNotesTab):
 *    TextAreaField prints a visible heading this composer never had, and its
 *    wrapper would stay on screen while the box itself is hidden on the preview
 *    tab. Dropping the visible label never drops the accessible one.
 *  - `av2-input` sets font-family and font-size unlayered, so the old
 *    `font-mono text-xs` HTML-mode utilities would have been silently dead.
 *    They are inline styles now, and HTML bodies still read as code.
 */

import { useMemo, useRef, useState } from 'react'
import { buildEmailPreviewDoc, looksLikeHtml, type EmailBodyFormat } from '@/lib/crm/email-body'
import { findUnresolvedMergeTokens } from '@/lib/crm/merge'
import { MergeFieldInserter, insertAtCursor, type CustomFieldToken } from '@/components/admin/crm/MergeFieldInserter'
import { FilterChip, SearchField } from '@/components/admin/v2'
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
  /**
   * What the body IS.
   *
   * 'resolved' (default) — a single message to one contact, already merged. A
   * leftover %token% is a genuine hole and the composer says so.
   *
   * 'template' — one body that the send path merges per recipient. Every token
   * is unresolved here BY CONSTRUCTION, so the same warning told a broker to
   * delete the personalisation, which is exactly backwards. In this mode the
   * tokens are listed as what will be filled in, not as a defect.
   */
  mergeMode?: 'resolved' | 'template'
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
      {/* The subject row has no visible label and never had one, so it is the
          unlabelled SearchField rather than the labelled TextField. The toolbar
          variant it carries is capped at 200px and drops to the small type
          size; both are overridden inline, since a subject line is a full-width
          body-size field. Neither property has a hover state. */}
      <SearchField
        type="text"
        aria-label="Subject"
        name="subject"
        placeholder={props.subjectPlaceholder ?? 'Subject'}
        value={props.subject}
        onChange={(e) => props.onSubjectChange(e.target.value)}
        style={{ width: '100%', maxWidth: 'none', fontSize: 'var(--a-text-md)' }}
      />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FilterChip pressed={tab === 'preview'} onClick={() => setTab('preview')} className="hover:opacity-80">
            Preview, what sends
          </FilterChip>
          <FilterChip pressed={tab === 'edit'} onClick={() => setTab('edit')} className="hover:opacity-80">
            Edit
          </FilterChip>
        </div>
        <div className="flex items-center gap-1">
          {tab === 'edit' && !props.hideMergeFields ? (
            <MergeFieldInserter channel="email" customFields={props.customFields} onInsert={handleInsertToken} />
          ) : null}
          {/* Text | HTML body-mode toggle. */}
          <div className="flex items-center gap-1">
            <FilterChip
              pressed={format === 'text'}
              onClick={() => setFormat('text')}
              className="hover:opacity-80"
            >
              Text
            </FilterChip>
            <FilterChip
              pressed={format === 'html'}
              onClick={() => setFormat('html')}
              className="hover:opacity-80"
            >
              HTML
            </FilterChip>
          </div>
          {props.toolbarExtra}
        </div>
      </div>
      {/* The textarea stays mounted (hidden) so a host form always posts `body`. */}
      <textarea
        ref={bodyRef}
        name="body"
        aria-label="Message"
        rows={10}
        placeholder={
          props.bodyPlaceholder ??
          (format === 'html' ? 'Paste or write HTML. Preview shows the rendered email.' : "Message. Sends from the signed-in broker's own mailbox.")
        }
        value={props.body}
        onChange={(e) => props.onBodyChange(e.target.value)}
        className={cn('av2-input field-sizing-content w-full', tab === 'edit' ? '' : 'hidden')}
        style={format === 'html' ? { fontFamily: 'var(--a-font-mono)', fontSize: 'var(--a-text-sm)' } : undefined}
      />
      {tab === 'preview' ? (
        <iframe
          title="Email preview"
          sandbox=""
          srcDoc={previewDoc}
          className="h-96 w-full rounded-xl"
          style={{ border: '1px solid var(--a-border)', background: 'var(--a-surface)' }}
        />
      ) : null}
      {unresolved.length > 0 ? (
        props.mergeMode === 'template' ? (
          <p className="text-xs" style={{ color: 'var(--a-text-2)' }}>
            Filled in per recipient: {unresolved.join(', ')}.
          </p>
        ) : (
          <p className="text-xs font-medium" style={{ color: 'var(--a-warn)' }}>
            Unfilled merge fields, this contact has no value for: {unresolved.join(', ')}. Edit before sending.
          </p>
        )
      ) : null}
    </div>
  )
}
