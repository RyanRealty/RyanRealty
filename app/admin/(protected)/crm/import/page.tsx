// @no-parity — internal admin surface, no public mockup contract
//
// Import contacts — 11C: migrated to the LOCKED admin v2 language
// (design_system/admin/ADMIN_UI.md). Presentation only.
//
// Carried over verbatim: the getCrmAccess guard AND the second superuser-only
// redirect, the metadata + `force-dynamic` exports, listImportJobsAction() with
// its `result.ok ? result.data : []` fallback, the per-job figures exactly as
// the action returns them, and both hrefs — /admin/crm/import/new for the
// primary action, /admin/crm/import/<job.id> for the row.
//
// Shape changed, data did not:
//   - the <h1>/<h2> title chrome is gone; the nav names the page (§3 rule 1)
//     and the verdict line answers it in one sentence,
//   - the shadcn table became the admin's one grid,
//   - the status Badge became a StateWord that LINKS to the job it names
//     (§3 rule 4), which absorbed the row's trailing "Details" button — same
//     href, one control fewer,
//   - dates format through lib/format/date, so they now print in the brand
//     timezone instead of the viewer's,
//   - the count cells carry en-US thousands grouping (grouping only),
//   - a FAILED read says so instead of rendering as "no imports yet".
//
// TWO CORRECTIONS THE LIVE DATA FORCED (§3 rule 6 — a wall of identical states
// is a STOP until the distribution is proved real; probed 2026-08-07):
//   1. crm_imports is a SHARED job ledger, and listImportJobsAction filters it
//      by nothing. 21,466 rows, of which `source='csv_wizard'` = 0 and rows
//      carrying a `counts->>'imported'` key = 0 — every listed job today comes
//      from gmail:matt/rebecca/paul, portal-lead-intake, or the fub-* runs,
//      each writing its own `counts` keys and a null row_count. So the count
//      columns read through a null-safe accessor and print an em dash when the
//      row never wrote them; the legacy `{job.counts.imported}` rendered
//      `undefined` as a blank cell, and calling .toLocaleString() on it would
//      have thrown. `source` — already returned by the action, never rendered —
//      is now a column, because a table of mailbox syncs under the heading
//      "Past imports" is otherwise unreadable.
//   2. The live status vocabulary is done · failed · running; the CSV route
//      writes 'error'. statusVariant() only knew 'error', so a FAILED job drew
//      the neutral outline Badge. statusState() maps 'failed' with 'error'.
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCrmAccess } from '@/app/actions/crm'
import { listImportJobsAction, type ImportJobStatus } from '@/app/actions/crm-import'
import { formatDate } from '@/lib/format/date'
import {
  SectionHead,
  StateWord,
  VerdictLine,
  ReportGrid,
  ReportError,
  type AdminState,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'

export const metadata = { title: 'Import contacts | CRM' }
export const dynamic = 'force-dynamic'

/** Job status → the v2 state vocabulary (was statusVariant → shadcn Badge). */
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

/** The same fields the inline formatter printed, now in the brand timezone. */
function fmtDate(iso: string | null) {
  return formatDate(iso, {
    year: undefined,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

const COLUMNS: ReportColumn[] = [
  { key: 'id', label: '#' },
  { key: 'source', label: 'Source' },
  { key: 'started', label: 'Started' },
  { key: 'status', label: 'Status' },
  { key: 'rows', label: 'Rows', numeric: true },
  { key: 'imported', label: 'Imported', numeric: true },
  { key: 'skipped', label: 'Skipped', numeric: true },
  { key: 'errors', label: 'Errors', numeric: true },
  { key: 'finished', label: 'Finished' },
]

export default async function ImportListPage() {
  const access = await getCrmAccess()
  if (!access) redirect('/admin/access-denied')
  if (access.role !== 'superuser') redirect('/admin/access-denied')

  const result = await listImportJobsAction()
  const jobs = result.ok ? result.data : []

  const failed = jobs.filter((j) => j.status === 'error' || j.status === 'failed').length
  const running = jobs.filter((j) => j.status === 'running').length

  const gridRows: ReportGridRow[] = jobs.map((job) => {
    const href = `/admin/crm/import/${job.id}`
    const errors = count(job.counts, 'errors')
    const imported = count(job.counts, 'imported')
    return {
      key: String(job.id),
      cells: [
        <Link
          key="id"
          href={href}
          style={{ color: 'var(--a-accent)', fontFamily: 'var(--a-font-mono)' }}
        >
          {job.id}
        </Link>,
        <span key="source" style={{ fontFamily: 'var(--a-font-mono)' }}>
          {job.source}
        </span>,
        fmtDate(job.startedAt),
        <Link key="status" href={href} style={{ textDecoration: 'none' }}>
          <StateWord state={statusState(job.status)}>{job.status}</StateWord>
        </Link>,
        job.rowCount != null ? job.rowCount.toLocaleString('en-US') : '—',
        <span
          key="imported"
          style={{ color: imported && imported > 0 ? 'var(--a-ok)' : 'var(--a-text-2)' }}
        >
          {fig(imported)}
        </span>,
        <span key="skipped" style={{ color: 'var(--a-text-2)' }}>
          {fig(count(job.counts, 'skipped'))}
        </span>,
        <span
          key="errors"
          style={{ color: errors && errors > 0 ? 'var(--a-danger)' : 'var(--a-text-2)' }}
        >
          {fig(errors)}
        </span>,
        fmtDate(job.finishedAt),
      ],
    }
  })

  return (
    <div className="av2-scope" style={{ maxWidth: 1024, margin: '0 auto', padding: 16 }}>
      <div style={{ margin: '0 0 14px' }}>
        <VerdictLine tone={!result.ok || failed > 0 ? 'attention' : 'ok'}>
          {!result.ok ? (
            <>
              <b>The import ledger could not be read.</b> Nothing below is a record of what ran.
            </>
          ) : jobs.length === 0 ? (
            <>
              <b>No import job has run.</b> Start one to add or update contacts from a CSV.
            </>
          ) : (
            <>
              <b>
                {jobs.length} import {jobs.length === 1 ? 'job' : 'jobs'} listed
                {failed > 0 ? `, ${failed} failed` : ''}
                {running > 0 ? `, ${running} still running` : ''}.
              </b>
            </>
          )}
        </VerdictLine>
      </div>

      {result.ok ? null : <ReportError what="The import ledger" href="/admin/crm/import" />}

      <div className="av2-wordrow" style={{ margin: '0 0 20px' }}>
        <Link href="/admin/crm/import/new" className="av2-btn" style={{ textDecoration: 'none' }}>
          Start import
        </Link>
      </div>

      <SectionHead>Past imports</SectionHead>
      <ReportGrid
        label="Past import jobs"
        columns={COLUMNS}
        template="minmax(52px, 0.45fr) minmax(110px, 1fr) minmax(108px, 1fr) minmax(80px, 0.75fr) repeat(4, minmax(62px, 0.55fr)) minmax(108px, 1fr)"
        minWidth={900}
        rows={gridRows}
        empty={<>No import job has run yet. Upload a CSV to add or update contacts.</>}
      />

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 16 }}>
        Every job in the CRM import ledger is listed, newest first, capped at 50 — a CSV import
        started here, a mailbox sync, a lead-intake run. Rows, imported, skipped and errors are
        written by the CSV importer; a job from another source leaves them empty. A CSV import
        matches contacts by email: an existing contact is updated field by field and its tags
        merged, a new one is created, and a row carrying neither a name nor an email is skipped.
      </p>
    </div>
  )
}
