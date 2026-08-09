'use client'

/**
 * Approve & Schedule + Unschedule + Pause/Resume controls, with the pre-send
 * gate panel (R-1 voice · R-2 citations · R-3 links). Scheduling is BLOCKED
 * until the checks pass; failures render as a clear list. After approval the
 * send cron picks the issue up at scheduled_at and the engagement-tiered
 * tranche machinery delivers it gradually to protect sender reputation.
 *
 * Admin v2 (11F): shadcn Dialog/Input/Label/Button and the console StatusPill
 * were replaced by the locked admin language (StateWord, TextField, Dialog).
 * ci:admin-ui rule C counts primary v2 <Button>s statically across the WHOLE
 * file, including branches that never render together (draft / scheduled /
 * sending are mutually exclusive at runtime) — so only the dialog's terminal
 * "Approve and schedule" confirm keeps the primary variant; every other
 * Button in this file, including the trigger that opens the dialog, is
 * quiet. Presentation only: same gates, same confirm-before-send step, same
 * strings, same disabled logic.
 */

import { useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button, Dialog, StateWord, TextField } from '@/components/admin/v2'
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
            <StateWord state={r.ok ? 'ok' : 'down'}>{r.ok ? 'pass' : 'fail'}</StateWord>
            <span style={{ fontSize: 'var(--a-text-sm)', fontWeight: 500, color: 'var(--a-text)' }}>{r.label}</span>
            {r.label.includes('R-2') && result.report ? (
              <span className="a-num" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                {result.report.r2.checked} stat tokens checked
              </span>
            ) : null}
            {r.label.includes('R-3') && result.report ? (
              <span className="a-num" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                {result.report.r3.checked} links checked
              </span>
            ) : null}
          </div>
          {r.failures.length > 0 ? (
            <ul className="mt-1 list-disc space-y-0.5 pl-9" style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-danger)' }}>
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
            <Button type="button" variant="quiet" onClick={runGates} disabled={pending}>
              {pending ? 'Checking…' : 'Run pre-send checks'}
            </Button>
            <Button type="button" variant="quiet" onClick={onOpenSchedule} disabled={pending}>
              Approve &amp; Schedule
            </Button>
            <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
              Scheduling runs the checks again and blocks on any failure. Delivery paces out over days by engagement tier.
            </p>
          </div>
          {gates ? <GateChecklist result={gates} /> : null}
        </>
      ) : null}

      {status === 'scheduled' ? (
        <div className="flex flex-wrap items-center gap-3">
          <StateWord state="accent">{`Scheduled for ${scheduledLabel ?? '—'}`}</StateWord>
          <Button type="button" variant="quiet" onClick={onUnschedule} disabled={pending}>
            {pending ? 'Working…' : 'Unschedule (back to draft)'}
          </Button>
        </div>
      ) : null}

      {status === 'sending' ? (
        <div className="flex flex-wrap items-center gap-3">
          {sendPaused ? (
            <>
              <StateWord state="slow">Delivery paused</StateWord>
              <Button type="button" variant="quiet" onClick={() => onSetPause(false)} disabled={pending}>
                {pending ? 'Working…' : 'Resume delivery'}
              </Button>
              <p style={{ margin: 0, fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                Paused by you or by the deliverability circuit breaker (bounce or complaint spike). Resuming needs your ok.
              </p>
            </>
          ) : (
            <>
              <StateWord state="accent">Delivering in tranches</StateWord>
              <Button type="button" variant="quiet" onClick={() => onSetPause(true)} disabled={pending}>
                {pending ? 'Working…' : 'Pause delivery'}
              </Button>
            </>
          )}
        </div>
      ) : null}

      {message ? (
        <p role="alert" style={{ margin: 0, fontSize: 'var(--a-text-sm)', color: message.type === 'ok' ? 'var(--a-ok)' : 'var(--a-danger)' }}>
          {message.text}
        </p>
      ) : null}

      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title="Approve and schedule this issue?"
        description="Pre-send checks run first and block on any failure. From the start time, delivery goes out gradually over several days, most engaged readers first, to protect sender reputation."
        footer={
          <>
            <Button type="button" variant="quiet" onClick={() => setDialogOpen(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="button" onClick={onConfirmSchedule} disabled={pending || !when}>
              {pending ? 'Scheduling…' : 'Approve and schedule'}
            </Button>
          </>
        }
      >
        <TextField
          label="Delivery starts"
          hint="Defaults to the 3rd at 9:00 AM, after the prior month fully closes."
          type="datetime-local"
          value={when}
          onChange={(e) => setWhen(e.target.value)}
          style={{ maxWidth: 280 }}
        />
      </Dialog>
    </div>
  )
}
