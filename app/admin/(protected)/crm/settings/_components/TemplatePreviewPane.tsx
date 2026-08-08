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
 */
import { useMemo } from 'react'
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
      <div className={cn('flex items-center justify-center rounded-xl border border-border bg-muted/40 py-12 text-sm text-muted-foreground', className)}>
        Write a template body to see the preview.
      </div>
    )
  }

  if (channel === 'sms') {
    return (
      <div className={cn('rounded-xl border border-border bg-muted/40 p-5 space-y-2', className)}>
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          SMS preview · placeholder values shown
        </div>
        <div className="flex justify-end">
          <div className="max-w-xs whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-4 py-2 text-sm leading-snug text-primary-foreground">
            {mergedBody}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          {mergedBody.length} characters
        </div>
      </div>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      {mergedSubject ? (
        <div className="rounded-lg border border-border bg-muted/40 px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Subject: </span>
          <span className="text-sm font-medium text-foreground">{mergedSubject}</span>
        </div>
      ) : null}
      <iframe
        title="Email template preview"
        sandbox=""
        srcDoc={previewDoc ?? ''}
        className="h-80 w-full rounded-xl border border-border bg-card"
      />
      <p className="text-[11px] text-muted-foreground">
        Preview uses placeholder values. Merge fields resolve to real contact data when sent.
      </p>
    </div>
  )
}
