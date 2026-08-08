'use client'

/**
 * ComposeToCohort — the compose-to-cohort surface (Wave 5).
 *
 * A broker:
 *   1. picks an AUDIENCE — a saved smart list (with its live scoped count) OR a
 *      pipeline stage,
 *   2. picks a TEMPLATE (active email templates) OR writes a subject + body,
 *   3. clicks Preview to see the REAL recipient + skip estimate (live count via
 *      bulkPreflightCount through the audience bus), then
 *   4. sends now OR schedules for later.
 *
 * Every count is live (previewComposeCohortAction -> bulkPreflightCount), never a
 * placeholder. The send funnels into the Wave-3 bulkEmailCohortAction (the ONE
 * suppression-safe cohort path); a schedule freezes the selection + scope for the
 * crm-scheduled-sends cron, which re-enters the same worker path. Inline content is
 * validated through the brand-voice gate on send (server-side, mirrored client-side
 * for fast feedback).
 *
 * 11F: presentation migrated to the LOCKED admin v2 language (ADMIN_UI.md).
 * PRESENTATION ONLY — every state value, the preview/dispatch/schedule calls,
 * validateComposeContent, and the audience/content descriptors are
 * byte-for-byte unchanged. The audience-kind / content-mode / send-mode
 * toggles moved from shadcn Button pairs to FilterChip (the v2 toggle
 * primitive — see CommsSection.tsx's channel toggle for the same pattern),
 * so "Send to cohort" stays the file's one primary Button
 * (ci:admin-ui rule C).
 *
 * EmailBodyEditor and BulkProgress stay imported from components/admin/crm/*
 * UNCHANGED and MOUNTED AS-IS. EmailBodyEditor is the G50 compose chokepoint
 * (ci:composer-discipline — "every send uses the same interface"; it also
 * backs EmailComposer), and BulkProgress is the one bulk-job progress poller.
 * This is the same sanctioned exception already recorded for CommsSection.tsx
 * / SendSection.tsx in check-admin-v2-tokens.mjs — rebuilding either here
 * would fork a canonical surface.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Send, CalendarClock, Users } from 'lucide-react'
import {
  getComposeOptionsAction,
  previewComposeCohortAction,
  dispatchComposeCohortAction,
  scheduleComposeCohortAction,
  type ComposeOptionsResult,
} from '@/app/actions/crm-compose'
import type {
  ComposeTemplateOption,
  ComposeViewOption,
} from '@/lib/data/crm/getComposeAudienceOptions'
import { validateComposeContent, type ComposePreview } from '@/lib/crm/compose-audience'
import BulkProgress from '@/components/admin/crm/BulkProgress'
import { EmailBodyEditor } from '@/components/admin/crm/EmailBodyEditor'
import { Button, FilterChip, SectionHead, SelectField, TextField } from '@/components/admin/v2'

type AudienceKind = 'view' | 'stage'
type ContentMode = 'template' | 'inline'
type SendMode = 'now' | 'later'

type Status = { type: 'error' | 'success'; text: string } | null

export default function ComposeToCohort() {
  const router = useRouter()

  // Options loaded from the server (scoped saved views + active templates).
  const [views, setViews] = useState<ComposeViewOption[]>([])
  const [templates, setTemplates] = useState<ComposeTemplateOption[]>([])
  const [stages, setStages] = useState<readonly string[]>([])
  const [loadingOptions, setLoadingOptions] = useState(true)
  const [optionsError, setOptionsError] = useState<string | null>(null)

  // Audience.
  const [audienceKind, setAudienceKind] = useState<AudienceKind>('view')
  const [viewId, setViewId] = useState('')
  const [stage, setStage] = useState('')

  // Content.
  const [contentMode, setContentMode] = useState<ContentMode>('template')
  const [templateId, setTemplateId] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')

  // Scheduling.
  const [sendMode, setSendMode] = useState<SendMode>('now')
  const [scheduledAt, setScheduledAt] = useState('')

  // Preview + dispatch state.
  const [preview, setPreview] = useState<ComposePreview | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [status, setStatus] = useState<Status>(null)
  const [jobId, setJobId] = useState<number | null>(null)
  const [pending, startTransition] = useTransition()

  useEffect(() => {
    let active = true
    getComposeOptionsAction().then((res: ComposeOptionsResult) => {
      if (!active) return
      setLoadingOptions(false)
      if (!res.ok) {
        setOptionsError(res.error)
        return
      }
      setViews(res.savedViews)
      setTemplates(res.templates)
      setStages(res.stages)
    })
    return () => {
      active = false
    }
  }, [])

  // Any change to the audience invalidates a stale preview.
  function resetPreview() {
    setPreview(null)
  }

  function currentAudience(): { kind?: string; viewId?: number; stage?: string } {
    return audienceKind === 'view'
      ? { kind: 'view', viewId: Number(viewId) }
      : { kind: 'stage', stage }
  }

  async function handlePreview() {
    setStatus(null)
    setPreviewing(true)
    const res = await previewComposeCohortAction(currentAudience())
    setPreviewing(false)
    if (!res.ok) {
      setPreview(null)
      setStatus({ type: 'error', text: res.error })
      return
    }
    setPreview({ total: res.total, willSkip: res.willSkip, willSend: res.willSend, summary: res.summary })
  }

  /** Client-side content pre-check for fast feedback (server re-validates). */
  function contentError(): string | null {
    const v = validateComposeContent({
      templateId: contentMode === 'template' ? templateId : '',
      subject: contentMode === 'inline' ? subject : '',
      body: contentMode === 'inline' ? body : '',
    })
    return v.ok ? null : v.error
  }

  function buildContent() {
    return contentMode === 'template'
      ? { templateId }
      : { subject, body }
  }

  function handleSend() {
    setStatus(null)
    const cErr = contentError()
    if (cErr) {
      setStatus({ type: 'error', text: cErr })
      return
    }
    startTransition(async () => {
      if (sendMode === 'later') {
        const res = await scheduleComposeCohortAction({
          audience: currentAudience(),
          content: buildContent(),
          scheduledAt,
        })
        if (!res.ok) {
          setStatus({ type: 'error', text: res.error })
          return
        }
        setStatus({ type: 'success', text: 'Scheduled. It will send at the time you picked.' })
        router.refresh()
        return
      }
      const res = await dispatchComposeCohortAction({
        audience: currentAudience(),
        content: buildContent(),
      })
      if (!res.ok) {
        setStatus({ type: 'error', text: res.error })
        return
      }
      setJobId(res.jobId)
      setStatus({ type: 'success', text: 'Send started. Progress is below.' })
    })
  }

  if (loadingOptions) {
    return (
      <div className="flex items-center gap-2" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }} role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading audiences and templates
      </div>
    )
  }

  if (optionsError) {
    return (
      <div
        role="alert"
        style={{
          border: '1px solid var(--a-border)',
          borderRadius: 'var(--a-r-lg)',
          background: 'var(--a-danger-wash)',
          padding: 'var(--a-s3) var(--a-s4)',
          fontSize: 'var(--a-text-sm)',
          color: 'var(--a-danger)',
        }}
      >
        {optionsError}
      </div>
    )
  }

  const selectedView = views.find((v) => String(v.id) === viewId) ?? null

  return (
    <div className="av2-pane">
      {/* Audience */}
      <section aria-label="Audience">
        <SectionHead>Audience</SectionHead>
        <div className="av2-wordrow" style={{ marginBottom: 'var(--a-s2)' }}>
          <FilterChip
            pressed={audienceKind === 'view'}
            onClick={() => {
              setAudienceKind('view')
              resetPreview()
            }}
          >
            Smart list
          </FilterChip>
          <FilterChip
            pressed={audienceKind === 'stage'}
            onClick={() => {
              setAudienceKind('stage')
              resetPreview()
            }}
          >
            Pipeline stage
          </FilterChip>
        </div>

        {audienceKind === 'view' ? (
          <SelectField
            label="Smart list"
            value={viewId}
            onChange={(e) => {
              setViewId(e.target.value)
              resetPreview()
            }}
          >
            <option value="">Pick a smart list</option>
            {views.map((v) => (
              <option key={v.id} value={String(v.id)}>
                {v.name}
                {v.count !== null ? ` (${v.count.toLocaleString('en-US')})` : ''}
              </option>
            ))}
          </SelectField>
        ) : (
          <SelectField
            label="Stage"
            value={stage}
            onChange={(e) => {
              setStage(e.target.value)
              resetPreview()
            }}
          >
            <option value="">Pick a stage</option>
            {stages.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </SelectField>
        )}

        {selectedView?.description ? (
          <p style={{ margin: 'var(--a-s1) 0 0', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            {selectedView.description}
          </p>
        ) : null}
      </section>

      {/* Content */}
      <section aria-label="Message" style={{ borderTop: '1px solid var(--a-border)', paddingTop: 'var(--a-s4)' }}>
        <SectionHead>Message</SectionHead>
        <div className="av2-wordrow" style={{ marginBottom: 'var(--a-s2)' }}>
          <FilterChip pressed={contentMode === 'template'} onClick={() => setContentMode('template')}>
            Use a template
          </FilterChip>
          <FilterChip pressed={contentMode === 'inline'} onClick={() => setContentMode('inline')}>
            Write it
          </FilterChip>
        </div>

        {contentMode === 'template' ? (
          <SelectField label="Template" value={templateId} onChange={(e) => setTemplateId(e.target.value)}>
            <option value="">Pick a template</option>
            {templates.map((t) => (
              <option key={t.id} value={String(t.id)}>
                {t.name}
              </option>
            ))}
          </SelectField>
        ) : (
          // The canonical email editing surface (EmailBodyEditor — same
          // subject/preview/edit interface as every other email send). The
          // cohort pipeline resolves {{handlebars}} tokens itself, so the
          // CRM merge dropdown is hidden.
          <EmailBodyEditor
            subject={subject}
            onSubjectChange={setSubject}
            body={body}
            onBodyChange={setBody}
            signatureHtml={null}
            hideMergeFields
            subjectPlaceholder="Subject line"
            bodyPlaceholder="Write the email. Merge fields like {{first_name}} are supported."
          />
        )}
      </section>

      {/* Preview */}
      <section aria-label="Preview the audience" style={{ borderTop: '1px solid var(--a-border)', paddingTop: 'var(--a-s4)' }}>
        <div className="av2-wordrow" style={{ justifyContent: 'space-between', marginBottom: 'var(--a-s2)' }}>
          <SectionHead>Preview the audience</SectionHead>
          <Button variant="quiet" onClick={handlePreview} disabled={previewing}>
            {previewing ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              <Users className="h-4 w-4" aria-hidden />
            )}
            Preview recipients
          </Button>
        </div>
        {preview ? (
          <div
            role="status"
            style={{
              border: '1px solid var(--a-border)',
              borderRadius: 'var(--a-r-lg)',
              background: 'var(--a-inset)',
              padding: 'var(--a-s3) var(--a-s4)',
            }}
          >
            <span className="a-num" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text)' }}>
              {preview.summary}
            </span>
          </div>
        ) : (
          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
            Preview shows the live recipient count and how many will be skipped before you send.
          </p>
        )}
      </section>

      {/* Schedule + send */}
      <section aria-label="Send" style={{ borderTop: '1px solid var(--a-border)', paddingTop: 'var(--a-s4)' }}>
        <SectionHead>Send</SectionHead>
        <div className="av2-wordrow" style={{ marginBottom: 'var(--a-s2)' }}>
          <FilterChip pressed={sendMode === 'now'} onClick={() => setSendMode('now')}>
            Send now
          </FilterChip>
          <FilterChip pressed={sendMode === 'later'} onClick={() => setSendMode('later')}>
            Schedule
          </FilterChip>
        </div>

        {sendMode === 'later' ? (
          <TextField
            label="Send at"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        ) : null}

        {status ? (
          <p
            role="alert"
            style={{ fontSize: 'var(--a-text-sm)', color: status.type === 'error' ? 'var(--a-danger)' : 'var(--a-ok)' }}
          >
            {status.text}
          </p>
        ) : null}

        <Button type="button" onClick={handleSend} disabled={pending}>
          {pending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          ) : sendMode === 'later' ? (
            <CalendarClock className="h-4 w-4" aria-hidden />
          ) : (
            <Send className="h-4 w-4" aria-hidden />
          )}
          {sendMode === 'later' ? 'Schedule send' : 'Send to cohort'}
        </Button>

        {jobId !== null ? <BulkProgress jobId={jobId} /> : null}
      </section>
    </div>
  )
}
