// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * Step 4 — Job status + counts. Polls every 2s while status = 'running'.
 */

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { getImportStatusAction, type ImportJobStatus } from '@/app/actions/crm-import'

function statusVariant(s: string): 'default' | 'outline' | 'secondary' | 'destructive' {
  if (s === 'done') return 'default'
  if (s === 'running') return 'secondary'
  if (s === 'error') return 'destructive'
  return 'outline'
}

export default function ImportStatusPage({ params }: { params: { id: string } }) {
  const jobId = Number(params.id ?? 0)
  const [job, setJob] = useState<ImportJobStatus | null>(null)
  const [error, setError] = useState<string | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function load() {
    if (!jobId) return
    const result = await getImportStatusAction(jobId)
    if (!result.ok) { setError(result.error); return }
    setJob(result.data)
    // Stop polling once done / error
    if (result.data.status === 'done' || result.data.status === 'error') {
      if (pollRef.current) clearInterval(pollRef.current)
    }
  }

  useEffect(() => {
    load()
    pollRef.current = setInterval(load, 2000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [jobId])

  const pct = job && job.counts.total > 0
    ? Math.round(((job.counts.imported + job.counts.skipped + job.counts.errors) / job.counts.total) * 100)
    : 0

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <nav className="mb-2 text-xs text-muted-foreground">
        <Link href="/admin/crm/import" className="hover:text-foreground">Import contacts</Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Job #{params.id}</span>
      </nav>

      <h1 className="text-2xl font-bold text-foreground mb-6">Import status</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {!job && !error && (
        <p className="text-sm text-muted-foreground">Loading…</p>
      )}

      {job && (
        <div className="space-y-6">
          {/* Status + progress */}
          <div className="rounded-xl border border-border bg-card px-6 py-5 space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant={statusVariant(job.status)} className="capitalize text-sm px-3 py-1">
                {job.status === 'running' ? 'Running…' : job.status}
              </Badge>
              {job.rowCount != null && (
                <span className="text-xs text-muted-foreground">{pct}% complete</span>
              )}
            </div>

            {job.status === 'running' && job.rowCount != null && (
              <Progress value={pct} className="h-2" />
            )}

            {/* Counts */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Total rows" value={job.rowCount ?? '—'} />
              <Stat label="Imported" value={job.counts.imported} className="text-success" />
              <Stat label="Skipped" value={job.counts.skipped} className="text-muted-foreground" />
              <Stat label="Errors" value={job.counts.errors} className={job.counts.errors > 0 ? 'text-destructive' : 'text-muted-foreground'} />
            </div>

            <div className="text-xs text-muted-foreground space-y-0.5">
              <p>Started: {job.startedAt ? new Date(job.startedAt).toLocaleString() : '—'}</p>
              {job.finishedAt && <p>Finished: {new Date(job.finishedAt).toLocaleString()}</p>}
            </div>
          </div>

          {/* Error rows */}
          {job.errorRows.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-2">
                Error rows ({job.errorRows.length}{job.errorRows.length >= 500 ? '+' : ''})
              </h2>
              <div className="rounded-xl border border-border bg-card divide-y divide-border max-h-80 overflow-y-auto">
                {job.errorRows.map((e, i) => (
                  <div key={i} className="px-4 py-3 text-xs">
                    <span className="text-muted-foreground font-mono mr-2">Row {e.rowIndex}</span>
                    <span className="text-destructive">{e.error}</span>
                    <div className="mt-1 text-muted-foreground truncate">
                      {Object.values(e.row ?? {}).slice(0, 3).join(' · ')}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            {job.status === 'done' && (
              <Link href="/admin/crm">
                <Button>View contacts</Button>
              </Link>
            )}
            <Link href="/admin/crm/import">
              <Button variant="outline">All imports</Button>
            </Link>
          </div>
        </div>
      )}
    </main>
  )
}

function Stat({
  label,
  value,
  className = 'text-foreground',
}: {
  label: string
  value: number | string
  className?: string
}) {
  return (
    <div className="text-center">
      <div className={`text-2xl font-bold tabular-nums ${className}`}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  )
}
