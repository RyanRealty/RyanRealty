'use client'

/**
 * BulkProgress — a light inline poller for one enqueued CRM bulk job.
 *
 * The bulk bar enqueues a job, gets a jobId, and mounts this. It polls
 * fetchBulkJobStatus every few seconds and renders a progress bar plus a short
 * breakdown ("374 done, 38 skipped"). The chunked worker cron runs on its own
 * cadence, so a freshly queued job sits at "queued" until the worker picks it up
 * — that is expected and the copy says so.
 *
 * Polling stops once the job is terminal (done / failed / canceled).
 */

import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, Loader2, AlertTriangle } from 'lucide-react'
import { fetchBulkJobStatus } from '@/app/actions/crm-bulk-status'
import type { CrmBulkJobView } from '@/lib/data/crm/getCrmBulkJob'
import '@/components/admin/v2/admin-v2.css'

const POLL_MS = 2500

const STATUS_LABEL: Record<CrmBulkJobView['status'], string> = {
  queued: 'Queued. The worker runs every couple of minutes',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  canceled: 'Canceled',
}

/**
 * The poller draws a WELL inside whatever surface mounts it — the bulk bar sits
 * on --a-surface, so the card is --a-inset and the meter's empty track is
 * --a-border. Painting --a-surface here would put the card on its own parent's
 * value and make it invisible.
 */
const CARD_STYLE = { background: 'var(--a-inset)', borderColor: 'var(--a-border)' }
const QUIET = { color: 'var(--a-text-2)' }

/** A readable one-line summary of the per-kind breakdown counters. PURE. */
export function summarizeBreakdown(view: CrmBulkJobView): string {
  const entries = Object.entries(view.breakdown).filter(([, n]) => Number(n) > 0)
  if (entries.length === 0) {
    return `${view.processed} processed, ${view.skipped} skipped`
  }
  return entries
    .map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`)
    .join(', ')
}

export default function BulkProgress({ jobId }: { jobId: number }) {
  const [view, setView] = useState<CrmBulkJobView | null>(null)
  const [gone, setGone] = useState(false)
  const stopped = useRef(false)

  useEffect(() => {
    stopped.current = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const tick = async () => {
      const next = await fetchBulkJobStatus(jobId)
      if (stopped.current) return
      if (!next) {
        setGone(true)
        return
      }
      setView(next)
      if (next.isTerminal) return
      timer = setTimeout(tick, POLL_MS)
    }

    tick()
    return () => {
      stopped.current = true
      if (timer) clearTimeout(timer)
    }
  }, [jobId])

  if (gone) {
    return (
      <div className="mt-3 rounded-md border px-3 py-2 text-xs" style={{ ...CARD_STYLE, ...QUIET }} role="status">
        Could not load the job status. The run is still queued.
      </div>
    )
  }

  if (!view) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs" style={QUIET} role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Starting the bulk run
      </div>
    )
  }

  const pct = view.progress === null ? null : Math.round(view.progress * 100)
  const isError = view.status === 'failed'

  return (
    <div className="mt-3 rounded-md border px-3 py-2.5" style={CARD_STYLE} role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs font-medium" style={{ color: 'var(--a-text)' }}>
        {view.isTerminal && !isError ? (
          <CheckCircle2 className="h-4 w-4" style={{ color: 'var(--a-ok)' }} aria-hidden />
        ) : isError ? (
          <AlertTriangle className="h-4 w-4" style={{ color: 'var(--a-danger)' }} aria-hidden />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin" style={QUIET} aria-hidden />
        )}
        <span>Job #{view.id}</span>
        <span style={QUIET}>{STATUS_LABEL[view.status]}</span>
        {pct !== null ? (
          <span className="ml-auto tabular-nums" style={QUIET}>{pct}%</span>
        ) : null}
      </div>

      {pct !== null ? (
        // The shadcn <Progress> was a radix root + indicator; drawn here from the
        // tokens instead, keeping the same progressbar role and value semantics.
        <div
          className="mt-2 h-1.5 w-full overflow-hidden rounded-full"
          style={{ background: 'var(--a-border)' }}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={pct}
        >
          <div className="h-full transition-all" style={{ width: `${pct}%`, background: 'var(--a-accent)' }} />
        </div>
      ) : null}

      <p className="mt-2 text-xs tabular-nums" style={{ color: isError ? 'var(--a-danger)' : 'var(--a-text-2)' }}>
        {isError && view.error ? view.error : summarizeBreakdown(view)}
        {view.total !== null ? ` (of ${view.total})` : ''}
      </p>
    </div>
  )
}
