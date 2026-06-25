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
 * Design-system components only.
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

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
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading audiences and templates
      </div>
    )
  }

  if (optionsError) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{optionsError}</AlertDescription>
      </Alert>
    )
  }

  const selectedView = views.find((v) => String(v.id) === viewId) ?? null

  return (
    <Card>
      <CardContent className="space-y-6 p-6">
        {/* Audience */}
        <section className="space-y-3">
          <Label className="text-sm font-medium text-foreground">Audience</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={audienceKind === 'view' ? 'default' : 'outline'}
              onClick={() => {
                setAudienceKind('view')
                resetPreview()
              }}
            >
              Smart list
            </Button>
            <Button
              type="button"
              size="sm"
              variant={audienceKind === 'stage' ? 'default' : 'outline'}
              onClick={() => {
                setAudienceKind('stage')
                resetPreview()
              }}
            >
              Pipeline stage
            </Button>
          </div>

          {audienceKind === 'view' ? (
            <Select
              value={viewId}
              onValueChange={(v) => {
                setViewId(v)
                resetPreview()
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a smart list" />
              </SelectTrigger>
              <SelectContent>
                {views.map((v) => (
                  <SelectItem key={v.id} value={String(v.id)}>
                    {v.name}
                    {v.count !== null ? ` (${v.count.toLocaleString('en-US')})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Select
              value={stage}
              onValueChange={(v) => {
                setStage(v)
                resetPreview()
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a stage" />
              </SelectTrigger>
              <SelectContent>
                {stages.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {selectedView?.description ? (
            <p className="text-xs text-muted-foreground">{selectedView.description}</p>
          ) : null}
        </section>

        <Separator />

        {/* Content */}
        <section className="space-y-3">
          <Label className="text-sm font-medium text-foreground">Message</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={contentMode === 'template' ? 'default' : 'outline'}
              onClick={() => setContentMode('template')}
            >
              Use a template
            </Button>
            <Button
              type="button"
              size="sm"
              variant={contentMode === 'inline' ? 'default' : 'outline'}
              onClick={() => setContentMode('inline')}
            >
              Write it
            </Button>
          </div>

          {contentMode === 'template' ? (
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Pick a template" />
              </SelectTrigger>
              <SelectContent>
                {templates.map((t) => (
                  <SelectItem key={t.id} value={String(t.id)}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="space-y-3">
              <div>
                <Label htmlFor="cohort-subject" className="text-xs text-muted-foreground">
                  Subject
                </Label>
                <Input
                  id="cohort-subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="mt-1"
                  placeholder="Subject line"
                />
              </div>
              <div>
                <Label htmlFor="cohort-body" className="text-xs text-muted-foreground">
                  Body
                </Label>
                <Textarea
                  id="cohort-body"
                  rows={8}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  className="mt-1"
                  placeholder="Write the email. Merge fields like {{first_name}} are supported."
                />
              </div>
            </div>
          )}
        </section>

        <Separator />

        {/* Preview */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium text-foreground">Preview the audience</Label>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={handlePreview}
              disabled={previewing}
            >
              {previewing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Users className="mr-2 h-4 w-4" aria-hidden />
              )}
              Preview recipients
            </Button>
          </div>
          {preview ? (
            <Alert>
              <AlertDescription>
                <span className="tabular-nums">{preview.summary}</span>
              </AlertDescription>
            </Alert>
          ) : (
            <p className="text-xs text-muted-foreground">
              Preview shows the live recipient count and how many will be skipped before you send.
            </p>
          )}
        </section>

        <Separator />

        {/* Schedule + send */}
        <section className="space-y-3">
          <Label className="text-sm font-medium text-foreground">Send</Label>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={sendMode === 'now' ? 'default' : 'outline'}
              onClick={() => setSendMode('now')}
            >
              Send now
            </Button>
            <Button
              type="button"
              size="sm"
              variant={sendMode === 'later' ? 'default' : 'outline'}
              onClick={() => setSendMode('later')}
            >
              Schedule
            </Button>
          </div>

          {sendMode === 'later' ? (
            <div>
              <Label htmlFor="cohort-when" className="text-xs text-muted-foreground">
                Send at
              </Label>
              <Input
                id="cohort-when"
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-1"
              />
            </div>
          ) : null}

          {status ? (
            <p className={status.type === 'error' ? 'text-sm text-destructive' : 'text-sm text-success'}>
              {status.text}
            </p>
          ) : null}

          <Button type="button" onClick={handleSend} disabled={pending}>
            {pending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
            ) : sendMode === 'later' ? (
              <CalendarClock className="mr-2 h-4 w-4" aria-hidden />
            ) : (
              <Send className="mr-2 h-4 w-4" aria-hidden />
            )}
            {sendMode === 'later' ? 'Schedule send' : 'Send to cohort'}
          </Button>

          {jobId !== null ? <BulkProgress jobId={jobId} /> : null}
        </section>
      </CardContent>
    </Card>
  )
}
