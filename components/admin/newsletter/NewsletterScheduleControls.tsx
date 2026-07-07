'use client'

/**
 * Approve & Schedule + Unschedule + Pause/Resume controls, with the pre-send
 * gate panel (R-1 voice · R-2 citations · R-3 links). Scheduling is BLOCKED
 * until the checks pass; failures render as a clear list. After approval the
 * send cron picks the issue up at scheduled_at and the engagement-tiered
 * tranche machinery delivers it gradually to protect sender reputation.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { StatusPill } from '@/components/console/StatusPill'
import {
  adminRunPreSendGatesAction,
  adminScheduleNewsletterAction,
  adminSetNewsletterPauseAction,
  adminUnscheduleNewsletterAction,
  type GateRunResult,
} from '@/app/admin/(protected)/newsletters/actions'

function GateChecklist({ result }: { result: GateRunResult }) {
  const rows: Array<{ label: string; ok: boolean; failures: string[] }> = [
    { label: 'Brand voice (R-1)', ok: (result.voiceFailures ?? []).length === 0, failures: result.voiceFailures ?? [] },
    { label: 'Every stat cited (R-2)', ok: result.report?.r2.ok ?? false, failures: result.report?.r2.failures ?? [] },
    { label: 'Every internal link resolves (R-3)', ok: result.report?.r3.ok ?? false, failures: result.report?.r3.failures ?? [] },
  ]
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-center gap-2">
            <StatusPill tone={r.ok ? 'success' : 'danger'} label={r.ok ? 'pass' : 'fail'} />
            <span className="text-sm font-medium text-foreground">{r.label}</span>
            {r.label.includes('R-2') && result.report ? (
              <span className="text-xs text-muted-foreground tabular-nums">{result.report.r2.checked} stat tokens checked</span>
            ) : null}
            {r.label.includes('R-3') && result.report ? (
              <span className="text-xs text-muted-foreground tabular-nums">{result.report.r3.checked} links checked</span>
            ) : null}
          </div>
          {r.failures.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-9 text-xs text-destructive">
              {r.failures.slice(0, 12).map((f) => (
                <li key={f}>{f}</li>
              ))}
              {r.failures.length > 12 ? <li>and {r.failures.length - 12} more</li> : null}
            </ul>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

type Props = {
  id: string
  status: string
  scheduledAt: string | null
  sendPaused: boolean
}

export default function NewsletterScheduleControls({ id, status, scheduledAt, sendPaused }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [gates, setGates] = useState<GateRunResult | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [when, setWhen] = useState('')
  const [message, setMessage] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  // Client-clock default computed after mount (hydration-safe: no new Date() in
  // render). Default delivery start: the 3rd at 9:00 local (next month if past).
  useEffect(() => {
    const now = new Date()
    let candidate = new Date(now.getFullYear(), now.getMonth(), 3, 9, 0, 0)
    if (candidate.getTime() <= now.getTime()) {
      candidate = new Date(now.getFullYear(), now.getMonth() + 1, 3, 9, 0, 0)
    }
    const pad = (n: number) => String(n).padStart(2, '0')
    const value = `${candidate.getFullYear()}-${pad(candidate.getMonth() + 1)}-${pad(candidate.getDate())}T${pad(candidate.getHours())}:${pad(candidate.getMinutes())}`
    setWhen((prev) => (prev === '' ? value : prev))
  }, [])

  function runGates() {
    setMessage(null)
    startTransition(async () => {
      const r = await adminRunPreSendGatesAction(id)
      if (r.error && !r.report) {
        setMessage({ type: 'err', text: r.error === 'empty_body' ? 'Add an HTML body before running checks.' : 'Could not run the checks.' })
      } else {
        setGates(r)
      }
    })
  }

  function onOpenSchedule() {
    setMessage(null)
    setDialogOpen(true)
  }

  function onConfirmSchedule() {
    setMessage(null)
    startTransition(async () => {
      const iso = new Date(when).toISOString()
      const r = await adminScheduleNewsletterAction(id, iso)
      if (r.ok) {
        setDialogOpen(false)
        setMessage({ type: 'ok', text: 'Approved and scheduled. Delivery starts at the scheduled time and paces out over the following days.' })
        router.refresh()
      } else if (r.error === 'gates_failed') {
        setGates({ ok: false, report: r.report, voiceFailures: r.voiceFailures })
        setDialogOpen(false)
        setMessage({ type: 'err', text: 'Pre-send checks failed. Fix the items below, then schedule again.' })
      } else {
        const map: Record<string, string> = {
          invalid_date: 'Pick a valid date and time.',
          date_in_past: 'The scheduled time is in the past.',
          not_a_draft: 'Only a draft can be scheduled.',
          empty_body: 'Add a body before scheduling.',
          unauthorized: 'You do not have access to schedule.',
        }
        setMessage({ type: 'err', text: map[r.error ?? ''] ?? r.error ?? 'Could not schedule.' })
      }
    })
  }

  function onUnschedule() {
    setMessage(null)
    startTransition(async () => {
      const r = await adminUnscheduleNewsletterAction(id)
      if (r.ok) {
        setMessage({ type: 'ok', text: 'Back to draft. It will not send until you approve it again.' })
        router.refresh()
      } else {
        setMessage({ type: 'err', text: r.error === 'not_scheduled' ? 'This issue is not scheduled anymore.' : 'Could not unschedule.' })
      }
    })
  }

  function onSetPause(paused: boolean) {
    setMessage(null)
    startTransition(async () => {
      const r = await adminSetNewsletterPauseAction(id, paused)
      if (r.ok) {
        setMessage({ type: 'ok', text: paused ? 'Delivery paused. Queued recipients hold until you resume.' : 'Delivery resumed. The next cron tick continues the send.' })
        router.refresh()
      } else {
        setMessage({ type: 'err', text: 'Could not update the pause state.' })
      }
    })
  }

  const scheduledLabel = scheduledAt
    ? new Date(scheduledAt).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
    : null

  return (
    <div className="space-y-4">
      {status === 'draft' ? (
        <>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="button" variant="outline" onClick={runGates} disabled={pending}>
              {pending ? 'Checking…' : 'Run pre-send checks'}
            </Button>
            <Button type="button" onClick={onOpenSchedule} disabled={pending}>
              Approve &amp; Schedule
            </Button>
            <p className="text-xs text-muted-foreground">
              Scheduling runs the checks again and blocks on any failure. Delivery paces out over days by engagement tier.
            </p>
          </div>
          {gates ? <GateChecklist result={gates} /> : null}
        </>
      ) : null}

      {status === 'scheduled' ? (
        <div className="flex flex-wrap items-center gap-3">
          <StatusPill tone="info" label={`Scheduled for ${scheduledLabel ?? '—'}`} />
          <Button type="button" variant="outline" onClick={onUnschedule} disabled={pending}>
            {pending ? 'Working…' : 'Unschedule (back to draft)'}
          </Button>
        </div>
      ) : null}

      {status === 'sending' ? (
        <div className="flex flex-wrap items-center gap-3">
          {sendPaused ? (
            <>
              <StatusPill tone="warning" label="Delivery paused" />
              <Button type="button" onClick={() => onSetPause(false)} disabled={pending}>
                {pending ? 'Working…' : 'Resume delivery'}
              </Button>
              <p className="text-xs text-muted-foreground">
                Paused by you or by the deliverability circuit breaker (bounce or complaint spike). Resuming needs your ok.
              </p>
            </>
          ) : (
            <>
              <StatusPill tone="info" label="Delivering in tranches" pulse />
              <Button type="button" variant="outline" onClick={() => onSetPause(true)} disabled={pending}>
                {pending ? 'Working…' : 'Pause delivery'}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {message ? (
        <p className={message.type === 'ok' ? 'text-sm text-success' : 'text-sm text-destructive'} role="alert">
          {message.text}
        </p>
      ) : null}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Approve and schedule this issue?</DialogTitle>
            <DialogDescription>
              Pre-send checks run first and block on any failure. From the start time, delivery goes out gradually over
              several days, most engaged readers first, to protect sender reputation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <Label htmlFor="nl-schedule-at">Delivery starts</Label>
            <Input
              id="nl-schedule-at"
              type="datetime-local"
              value={when}
              onChange={(e) => setWhen(e.target.value)}
              className="w-full sm:w-64"
            />
            <p className="text-xs text-muted-foreground">Defaults to the 3rd at 9:00 AM, after the prior month fully closes.</p>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirmSchedule} disabled={pending || !when}>
              {pending ? 'Scheduling…' : 'Approve and schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
