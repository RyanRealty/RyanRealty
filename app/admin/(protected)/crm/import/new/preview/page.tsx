// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * Step 3 — Preview first 10 rows + dup warnings, then kick off the import.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md).
 * Presentation only.
 *
 * THE RUN CALL IS THE PAYLOAD, carried over character for character:
 * handleRun still calls `startImportAction(jobId)` first, then
 * `fetch('/api/admin/crm-import', { method: 'POST', headers: { 'Content-Type':
 * 'application/json' }, body: JSON.stringify({ jobId }) })` — the route reads
 * `body.jobId`, so that key may not be renamed — then pushes to
 * /admin/crm/import/<jobId>. Both failure branches (non-ok response body.error
 * / `Server error <status>`, and the network catch) keep their exact strings and
 * their setRunning(false).
 *
 * Also carried over verbatim: `?job=` and `Number(params.get('job') ?? 0)`, the
 * 'Invalid job id' guard, the effect's [jobId] dependency, getImportPreviewAction
 * and the three pieces of state it fills, the dup test
 * `dupWarnings.some((w) => w.rowIndex === i + 1)`, the tags `slice(0, 3)` + "+N"
 * overflow, every `.toLocaleString()` call, and all three hrefs (the Back link's
 * /admin/crm/import/new/map?job=<jobId>, Cancel's /admin/crm/import, and the
 * status push target).
 *
 * Shape changed, data did not: the <h1> chrome is gone (the nav names the
 * page), the dup banner folded into the verdict line, the shadcn table became
 * the admin's one grid, the tag Badges became text, the four step pills became
 * one line of plain text, and a duplicate row is now named in words next to its
 * email rather than shaded a colour (WCAG 1.4.1 — the wash alone carried the
 * meaning before).
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Button,
  ReportGrid,
  SectionHead,
  StateWord,
  VerdictLine,
  type ReportColumn,
  type ReportGridRow,
} from '@/components/admin/v2'
import { getImportPreviewAction, startImportAction } from '@/app/actions/crm-import'
import type { ImportContact, DupWarning } from '@/lib/crm/import'

const COLUMNS: ReportColumn[] = [
  { key: 'n', label: '#', numeric: true },
  { key: 'name', label: 'Name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'stage', label: 'Stage' },
  { key: 'tags', label: 'Tags' },
]

export default function ImportPreviewPage() {
  const router = useRouter()
  const params = useSearchParams()
  const jobId = Number(params.get('job') ?? 0)

  const [preview, setPreview] = useState<ImportContact[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [dupWarnings, setDupWarnings] = useState<DupWarning[]>([])
  const [loading, setLoading] = useState(true)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) { setError('Invalid job id'); setLoading(false); return }
    getImportPreviewAction(jobId).then((result) => {
      if (!result.ok) { setError(result.error); setLoading(false); return }
      setPreview(result.data.preview)
      setTotalRows(result.data.totalRows)
      setDupWarnings(result.data.dupWarnings)
      setLoading(false)
    })
  }, [jobId])

  async function handleRun() {
    if (!jobId) return
    setRunning(true)
    setError(null)

    // Mark job as running
    const startResult = await startImportAction(jobId)
    if (!startResult.ok) { setError(startResult.error); setRunning(false); return }

    // Call the upsert API route (streamed chunked upsert)
    try {
      const res = await fetch('/api/admin/crm-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error ?? `Server error ${res.status}`)
        setRunning(false)
        return
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
      setRunning(false)
      return
    }

    // Navigate to status page
    router.push(`/admin/crm/import/${jobId}`)
  }

  if (loading) {
    return (
      <div className="av2-scope" style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
        <p role="status" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Loading preview…
        </p>
      </div>
    )
  }

  const rows: ReportGridRow[] = preview.map((c, i) => {
    const isDup = dupWarnings.some((w) => w.rowIndex === i + 1)
    return {
      key: String(i),
      cells: [
        <span key="n" style={{ color: isDup ? 'var(--a-warn)' : 'var(--a-text-2)' }}>{i + 1}</span>,
        c.name || <span key="name" style={{ color: 'var(--a-text-2)' }}>—</span>,
        <span key="email">
          {c.email ?? '—'}
          {isDup ? (
            <>
              {' '}
              <StateWord state="slow">repeat email</StateWord>
            </>
          ) : null}
        </span>,
        c.phone ?? '—',
        c.stage ?? '—',
        c.tags.slice(0, 3).join(' · ') + (c.tags.length > 3 ? ` +${c.tags.length - 3}` : ''),
      ],
    }
  })

  const linkOff = running
    ? { textDecoration: 'none', opacity: 0.5, pointerEvents: 'none' as const }
    : { textDecoration: 'none' }

  return (
    <div className="av2-scope" style={{ maxWidth: 880, margin: '0 auto', padding: 16 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <Link href="/admin/crm/import" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Import contacts
        </Link>
      </nav>

      <p style={{ margin: '0 0 14px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        1 Upload{' · '}2 Map fields{' · '}
        <span style={{ color: 'var(--a-text)', fontWeight: 600 }}>3 Preview</span>
        {' · '}4 Run
      </p>

      <div style={{ margin: '0 0 20px' }}>
        <VerdictLine tone={dupWarnings.length > 0 ? 'attention' : 'ok'}>
          <b>{totalRows.toLocaleString()} rows ready to import.</b>{' '}
          {dupWarnings.length > 0 ? (
            <>
              {dupWarnings.length} duplicate email{dupWarnings.length > 1 ? 's' : ''} inside this
              file — only the first occurrence is imported, later rows update the same contact.
            </>
          ) : (
            <>No email repeats inside this file.</>
          )}
        </VerdictLine>
      </div>

      {error && (
        <p
          role="alert"
          style={{ margin: '0 0 16px', fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}
        >
          {error}
        </p>
      )}

      {preview.length > 0 && (
        <>
          <SectionHead>
            The first {preview.length} {preview.length === 1 ? 'row' : 'rows'}
          </SectionHead>
          <ReportGrid
            label="First rows of the import"
            columns={COLUMNS}
            template="minmax(44px, 0.35fr) minmax(130px, 1.2fr) minmax(160px, 1.5fr) minmax(110px, 1fr) minmax(84px, 0.8fr) minmax(120px, 1.1fr)"
            minWidth={720}
            rows={rows}
            empty={<>No row survived the mapping. Go back and map at least one column.</>}
          />
        </>
      )}

      <div className="av2-wordrow" style={{ marginTop: 20 }}>
        <Button onClick={handleRun} disabled={running} style={{ minWidth: 160 }}>
          {running ? 'Starting import…' : `Run import (${totalRows.toLocaleString()} rows)`}
        </Button>
        <Link
          href={`/admin/crm/import/new/map?job=${jobId}`}
          className="av2-btn av2-btn--quiet"
          style={linkOff}
          aria-disabled={running || undefined}
          tabIndex={running ? -1 : undefined}
        >
          Back
        </Link>
        <Link
          href="/admin/crm/import"
          className="av2-btn av2-btn--quiet"
          style={linkOff}
          aria-disabled={running || undefined}
          tabIndex={running ? -1 : undefined}
        >
          Cancel
        </Link>
      </div>

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 20 }}>
        Contacts are matched by email: an existing contact is updated field by field and its tags
        merged, a new one is created. A row carrying neither a name nor an email is skipped.
      </p>
    </div>
  )
}
