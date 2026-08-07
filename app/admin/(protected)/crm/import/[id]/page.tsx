// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * Step 4 — Job status + counts. Polls every 2s while status = 'running'.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only.
 *
 * Carried over verbatim: the `params: { id: string }` signature and
 * load(), getImportStatusAction, the 2s setInterval
 * and the stop-on-done/error clear, the effect's [jobId] dependency, the pct
 * formula character for character, the `job.rowCount != null` condition on the
 * progress readout, the error-row fields (rowIndex, error, first three values
 * of the row), the done-only "View contacts" action, and both hrefs
 * (/admin/crm and /admin/crm/import).
 *
 * Shape changed, data did not: the <h1>/<h2> chrome is gone (the nav names the
 * page), the counts card became the verdict line + the numbers strip, the
 * Badge became a StateWord, the shadcn Progress became the v2 GoalMeter off the
 * same pct, the error rows became the admin's one grid inside the same scroll
 * cap, the timestamps format through lib/format/date (brand timezone) instead
 * of the viewer's locale, and the counts carry en-US thousands grouping.
 *
 * TWO CORRECTIONS THE LIVE DATA FORCED (probed 2026-08-07): crm_imports is a
 * SHARED job ledger — 21,466 rows, 0 with `source='csv_wizard'`, 0 carrying a
 * `counts->>'imported'` key. So (1) every count reads through a null-safe
 * accessor and prints an em dash when the row never wrote it, and the verdict
 * omits the counts clause entirely rather than claiming four zeros — the legacy
 * `{job.counts.imported}` rendered `undefined` as blank, and .toLocaleString()
 * on it would have thrown; `source` (returned by the action, never rendered) is
 * now shown so the page says WHICH job this is. And (2) the live status
 * vocabulary is done · failed · running while the CSV route writes 'error', so
 * 'failed' is read alongside 'error' instead of falling through to neutral.
 */

import { useState, useEffect, useRef, use } from 'react'
import Link from 'next/link'
import { formatDateTime } from '@/lib/format/date'
import {
  GoalMeter,
  ReportGrid,
  ReportNumbers,
  SectionHead,
  StateWord,
  VerdictLine,
  type AdminState,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { getImportStatusAction, type ImportJobStatus } from '@/app/actions/crm-import'

function statusState(s: string): AdminState {
  if (s === 'done') return 'ok'
  if (s === 'running') return 'accent'
  if (s === 'error' || s === 'failed') return 'down'
  return 'waiting'
}

/**
 * crm_imports.counts is shared jsonb: the CSV importer writes
 * {total,imported,skipped,errors}; every other producer writes its own keys.
 * Read a key as possibly-absent rather than asserting a zero the row never
 * claimed.
 */
function count(counts: ImportJobStatus['counts'], key: keyof ImportJobStatus['counts']): number | null {
  const v = (counts as unknown as Record<string, unknown>)[key]
  return typeof v === 'number' ? v : null
}

function fig(n: number | null): string {
  return n == null ? '—' : n.toLocaleString('en-US')
}

const ERROR_COLUMNS: ReportColumn[] = [
  { key: 'row', label: 'Row', numeric: true },
  { key: 'error', label: 'Error' },
  { key: 'data', label: 'Data' },
]

export default function ImportStatusPage({ params }: { params: Promise<{ id: string }> }) {
  // Next 15 made `params` a Promise. This page still destructured it as a plain
  // object, so `params.id` was undefined, `jobId` was 0, load() returned at its
  // `if (!jobId)` guard, and the page sat on "Loading…" under a heading that
  // read "Job #" with no number — for every job, always. Verified broken at
  // HEAD before this change, so it is not migration fallout; verified fixed in
  // the browser after.
  const { id } = use(params)
  const jobId = Number(id ?? 0)
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

  const imported = job ? count(job.counts, 'imported') : null
  const skipped = job ? count(job.counts, 'skipped') : null
  const errors = job ? count(job.counts, 'errors') : null
  const hasCounts = imported != null || skipped != null || errors != null

  const ended = job?.status === 'error' || job?.status === 'failed'

  const headline = !job
    ? ''
    : job.status === 'done'
      ? 'Import finished.'
      : job.status === 'running'
        ? job.rowCount != null
          ? `Running — ${pct}% of ${fig(count(job.counts, 'total'))} rows.`
          : 'Running.'
        : ended
          ? 'Import ended in error.'
          : 'Import has not started.'

  const errorRows: ReportGridRow[] = (job?.errorRows ?? []).map((e, i) => ({
    key: `${e.rowIndex}-${i}`,
    cells: [
      <span key="row" style={{ fontFamily: 'var(--a-font-mono)' }}>{e.rowIndex}</span>,
      <span key="error" style={{ color: 'var(--a-danger)' }}>{e.error}</span>,
      Object.values(e.row ?? {}).slice(0, 3).join(' · '),
    ],
  }))

  return (
    <div className="av2-scope" style={{ maxWidth: 720, margin: '0 auto', padding: 16 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ margin: '0 0 14px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <Link href="/admin/crm/import" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Import contacts
        </Link>
        <span style={{ padding: '0 6px' }}>/</span>
        <span style={{ color: 'var(--a-text)' }}>Job #{id}</span>
      </nav>

      {error && (
        <p
          role="alert"
          style={{ margin: '0 0 16px', fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}
        >
          {error}
        </p>
      )}

      {!job && !error && (
        <p role="status" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Loading…
        </p>
      )}

      {job && (
        <>
          <div style={{ margin: '0 0 14px' }}>
            <VerdictLine tone={(errors ?? 0) > 0 || ended ? 'attention' : 'ok'}>
              <b>{headline}</b>
              {hasCounts ? (
                <>
                  {' '}
                  {fig(imported)} imported · {fig(skipped)} skipped · {fig(errors)} errored.
                </>
              ) : null}
            </VerdictLine>
          </div>

          <div className="av2-wordrow" style={{ margin: '0 0 16px' }}>
            <StateWord state={statusState(job.status)}>{job.status}</StateWord>
            <span style={{ fontSize: 'var(--a-text-xs)', fontFamily: 'var(--a-font-mono)', color: 'var(--a-text-2)' }}>
              {job.source}
            </span>
            {job.rowCount != null && (
              <span style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
                {pct}% complete
              </span>
            )}
          </div>

          {job.status === 'running' && job.rowCount != null && (
            <div style={{ margin: '0 0 16px' }}>
              <GoalMeter pct={pct} />
            </div>
          )}

          <ReportNumbers
            items={[
              { key: 'total', label: 'Total rows', value: job.rowCount != null ? job.rowCount.toLocaleString('en-US') : '—' },
              { key: 'imported', label: 'Imported', value: fig(imported) },
              { key: 'skipped', label: 'Skipped', value: fig(skipped) },
              { key: 'errors', label: 'Errors', value: fig(errors) },
            ]}
          />

          <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', margin: '0 0 20px' }}>
            Started {formatDateTime(job.startedAt)}
            {job.finishedAt ? <> · finished {formatDateTime(job.finishedAt)}</> : null}
            {hasCounts ? null : <> · no per-row counts recorded</>}
          </p>

          {job.errorRows.length > 0 && (
            <>
              <SectionHead>
                Error rows ({job.errorRows.length}
                {job.errorRows.length >= 500 ? '+' : ''})
              </SectionHead>
              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                <ReportGrid
                  label="Rows that failed to import"
                  columns={ERROR_COLUMNS}
                  template="minmax(56px, 0.4fr) minmax(180px, 1.4fr) minmax(180px, 1.4fr)"
                  minWidth={520}
                  rows={errorRows}
                  empty={<>No row failed.</>}
                />
              </div>
            </>
          )}

          <div className="av2-wordrow" style={{ marginTop: 20 }}>
            {job.status === 'done' && (
              <Link href="/admin/crm" className="av2-btn" style={{ textDecoration: 'none' }}>
                View contacts
              </Link>
            )}
            <Link
              href="/admin/crm/import"
              className="av2-btn av2-btn--quiet"
              style={{ textDecoration: 'none' }}
            >
              All imports
            </Link>
          </div>
        </>
      )}
    </div>
  )
}
