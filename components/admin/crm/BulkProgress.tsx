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
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

const POLL_MS = 2500

const STATUS_LABEL: Record<CrmBulkJobView['status'], string> = {
  queued: 'Queued. The worker runs every couple of minutes',
  running: 'Running',
  done: 'Done',
  failed: 'Failed',
  canceled: 'Canceled',
}

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
      <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground" role="status">
        Could not load the job status. The run is still queued.
      </div>
    )
  }

  if (!view) {
    return (
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Starting the bulk run
      </div>
    )
  }

  const pct = view.progress === null ? null : Math.round(view.progress * 100)
  const isError = view.status === 'failed'

  return (
    <div className="mt-3 rounded-md border border-border bg-muted/40 px-3 py-2.5" role="status" aria-live="polite">
      <div className="flex items-center gap-2 text-xs font-medium text-foreground">
        {view.isTerminal && !isError ? (
          <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
        ) : isError ? (
          <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        )}
        <span>Job #{view.id}</span>
        <span className="text-muted-foreground">{STATUS_LABEL[view.status]}</span>
        {pct !== null ? (
          <span className="ml-auto tabular-nums text-muted-foreground">{pct}%</span>
        ) : null}
      </div>

      {pct !== null ? <Progress value={pct} className="mt-2 h-1.5" /> : null}

      <p className={cn('mt-2 text-xs tabular-nums', isError ? 'text-destructive' : 'text-muted-foreground')}>
        {isError && view.error ? view.error : summarizeBreakdown(view)}
        {view.total !== null ? ` (of ${view.total})` : ''}
      </p>
    </div>
  )
}
