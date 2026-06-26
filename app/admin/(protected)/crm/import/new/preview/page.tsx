// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * Step 3 — Preview first 10 rows + dup warnings, then kick off the import.
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { getImportPreviewAction, startImportAction } from '@/app/actions/crm-import'
import type { ImportContact, DupWarning } from '@/lib/crm/import'

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
      <main className="mx-auto max-w-3xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading preview…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <nav className="mb-2 text-xs text-muted-foreground">
        <Link href="/admin/crm/import" className="hover:text-foreground">Import contacts</Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Preview</span>
      </nav>

      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5">1</span>
        <span>Upload</span>
        <span className="text-border">›</span>
        <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5">2</span>
        <span>Map fields</span>
        <span className="text-border">›</span>
        <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 font-semibold">3</span>
        <span className="font-medium text-foreground">Preview</span>
        <span className="text-border">›</span>
        <span>Run</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-1">Preview</h1>
      <p className="text-sm text-muted-foreground mb-6">
        First 10 of {totalRows.toLocaleString()} rows. Review then run the import.
        Contacts matched by email will be updated; others created.
      </p>

      {dupWarnings.length > 0 && (
        <div className="mb-4 rounded-lg bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning">
          <strong>{dupWarnings.length} duplicate email{dupWarnings.length > 1 ? 's' : ''}</strong> found
          within this file. Only the first occurrence will be imported; later rows will update the same contact.
        </div>
      )}

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {/* Preview table */}
      {preview.length > 0 && (
        <div className="mb-6 rounded-xl border border-border bg-card overflow-x-auto no-scrollbar">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Stage</TableHead>
                <TableHead>Tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {preview.map((c, i) => {
                const isDup = dupWarnings.some((w) => w.rowIndex === i + 1)
                return (
                  <TableRow key={i} className={isDup ? 'bg-warning/5' : undefined}>
                    <TableCell className="text-xs text-muted-foreground">{i + 1}</TableCell>
                    <TableCell className="text-sm font-medium text-foreground">
                      {c.name || <span className="text-muted-foreground">—</span>}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.email ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.phone ?? '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.stage ?? '—'}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {c.tags.slice(0, 3).map((t) => (
                          <Badge key={t} variant="outline" className="text-xs">{t}</Badge>
                        ))}
                        {c.tags.length > 3 && (
                          <Badge variant="outline" className="text-xs text-muted-foreground">+{c.tags.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button onClick={handleRun} disabled={running} className="min-w-[160px]">
          {running ? 'Starting import…' : `Run import (${totalRows.toLocaleString()} rows)`}
        </Button>
        <Link href={`/admin/crm/import/new/map?job=${jobId}`}>
          <Button variant="outline" disabled={running}>Back</Button>
        </Link>
        <Link href="/admin/crm/import">
          <Button variant="ghost" disabled={running}>Cancel</Button>
        </Link>
      </div>
    </main>
  )
}
