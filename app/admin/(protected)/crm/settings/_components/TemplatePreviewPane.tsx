'use client'

/**
 * TemplatePreviewPane — renders a template body in a sandboxed iframe after
 * resolving merge tokens against a placeholder contact.
 *
 * Used in the §13 template modals as a "Preview" tab alongside the body
 * editor. The iframe is sandbox="" (no scripts) so the HTML is
 * fully safe to render even if a template body contains arbitrary HTML.
 *
 * The placeholder contact deliberately uses obvious stand-in values so a
 * broker reviewing the template knows immediately where the real values will
 * appear. For email templates the preview wraps the body the same way the
 * live send path does (composeOutboundHtml) so the rendered output matches
 * what the recipient sees.
 *
 * P11 admin-v2: the shadcn semantic color classes resolve to the PUBLIC brand
 * palette, so every one of them moved onto the locked admin tokens
 * (var(--a-*)). The SMS bubble is now the v2 ThreadBubble — the same
 * outbound bubble the real thread renders, so the preview and the thread stop
 * being two different pictures of one message. Layout classes are untouched;
 * no data, merge, or render path changed.
 */
import { useMemo, type CSSProperties } from 'react'
import { ThreadBubble } from '@/components/admin/v2'
import { renderCrmMerge, type MergeContext } from '@/lib/crm/merge'
import { buildEmailPreviewDoc } from '@/lib/crm/email-body'
import { cn } from '@/lib/utils'

/** Placeholder person used for preview rendering — obvious stand-in values. */
const PLACEHOLDER_PERSON = {
  first_name: 'Alex',
  last_name: 'Preview',
  name: 'Alex Preview',
  stage: 'Lead',
  source: 'Ryan-Realty.com',
  emails: [{ value: 'alex.preview@example.com', isPrimary: 1 }],
  phones: [{ value: '541-555-0100', isPrimary: 1 }],
  addresses: [{ street: '123 Preview Lane', city: 'Bend', state: 'OR', code: '97701' }],
  custom: {
    customSellerPropertyAddress: '123 Preview Lane, Bend OR 97701',
    customPropertyAddress: '123 Preview Lane, Bend OR 97701',
    cmaLink: 'https://ryan-realty.com/cma/preview',
  },
}

/** The pane's small uppercase caption — v2 meta type, one definition. */
const CAPTION_STYLE = {
  fontSize: 'var(--a-text-xs)',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--a-text-2)',
} as const satisfies CSSProperties

export function TemplatePreviewPane({
  channel,
  subject,
  body,
  signatureHtml,
  mergeContext,
  className,
}: {
  channel: 'email' | 'sms'
  subject: string
  body: string
  signatureHtml?: string | null
  /** Real agent/sender/company context (server-built) so %agent_*% etc. preview
   *  with the same values the send path resolves. Optional — tokens without
   *  context stay literal, which is itself informative in a preview. */
  mergeContext?: MergeContext
  className?: string
}) {
  const mergedSubject = useMemo(
    () => renderCrmMerge(subject, PLACEHOLDER_PERSON, mergeContext),
    [subject, mergeContext],
  )
  const mergedBody = useMemo(
    () => renderCrmMerge(body, PLACEHOLDER_PERSON, mergeContext),
    [body, mergeContext],
  )

  const previewDoc = useMemo(() => {
    if (channel === 'email') {
      return buildEmailPreviewDoc(mergedBody, signatureHtml ?? null)
    }
    // SMS — plain bubble preview (no iframe needed, but keep consistent structure)
    return null
  }, [channel, mergedBody, signatureHtml])

  if (!body.trim()) {
    return (
      <div
        className={cn('flex items-center justify-center py-12', className)}
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-inset)',
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-text-2)',
        }}
      >
        Write a template body to see the preview.
      </div>
    )
  }

  if (channel === 'sms') {
    return (
      <div
        className={cn('p-5 space-y-2', className)}
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-inset)',
        }}
      >
        <div style={CAPTION_STYLE}>SMS preview · placeholder values shown</div>
        <div className="flex justify-end">
          <ThreadBubble direction="out">
            <span style={{ whiteSpace: 'pre-wrap' }}>{mergedBody}</span>
          </ThreadBubble>
        </div>
        <div
          className="text-right"
          style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
        >
          {mergedBody.length} characters
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {mergedSubject ? (
        <div
          className="px-3 py-2"
          style={{
            border: '1px solid var(--a-border)',
            borderRadius: 'var(--a-r-md)',
            background: 'var(--a-inset)',
          }}
        >
          <span style={CAPTION_STYLE}>Subject: </span>
          <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>
            {mergedSubject}
          </span>
        </div>
      ) : null}
      <iframe
        title="Email template preview"
        sandbox=""
        srcDoc={previewDoc ?? ''}
        className="h-80 w-full"
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-bg)',
        }}
      />
      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        Preview uses placeholder values. Merge fields resolve to real contact data when sent.
      </p>
    </div>
  )
}
