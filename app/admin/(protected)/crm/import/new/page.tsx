// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * Step 1 — Upload CSV.
 *
 * Reads the file client-side (no server form submission needed), calls
 * createImportJobAction, and navigates to /admin/crm/import/new/map?job=<id>.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
 * pattern 6 (config form: single column, label above).
 *
 * Carried over verbatim: handleFileChange's `e.target.files?.[0]` read and its
 * setError(null), handleSubmit's preventDefault → `await file.text()` →
 * `createImportJobAction(text)` → `router.push('/admin/crm/import/new/map?job='
 * + result.data.jobId)`, the "Choose a CSV file first." guard, the
 * `disabled={loading || !fileName}` submit condition, the "Parsing…" label, the
 * error-to-string catch, the `accept=".csv,text/csv"` filter, and the Cancel
 * href (/admin/crm/import). The action still receives one argument: the text of
 * the file the broker picked.
 *
 * Shape changed, data did not: the <h1> chrome is gone (the nav names the
 * page), the hand-rolled drop zone with its `sr-only` <input> became the v2
 * TextField primitive, and the four step pills became one line of plain text.
 * ONE mechanism moved with the markup: the File handle now lives in state
 * (captured from the same change event that already set fileName) instead of a
 * ref into the removed input — `await file.text()` runs on the same File, so
 * the string handed to createImportJobAction is unchanged.
 */

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button, TextField, VerdictLine } from '@/components/admin/v2'
import { createImportJobAction } from '@/app/actions/crm-import'

export default function ImportUploadPage() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setFile(file ?? null)
    setFileName(file?.name ?? null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file) { setError('Choose a CSV file first.'); return }

    setLoading(true)
    setError(null)
    try {
      const text = await file.text()
      const result = await createImportJobAction(text)
      if (!result.ok) { setError(result.error); setLoading(false); return }
      router.push(`/admin/crm/import/new/map?job=${result.data.jobId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      setLoading(false)
    }
  }

  return (
    <div className="av2-scope" style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
      <nav
        aria-label="Breadcrumb"
        style={{ margin: '0 0 10px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}
      >
        <Link href="/admin/crm/import" style={{ color: 'var(--a-accent)', textDecoration: 'none' }}>
          Import contacts
        </Link>
      </nav>

      <p style={{ margin: '0 0 14px', fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)' }}>
        <span style={{ color: 'var(--a-text)', fontWeight: 600 }}>1 Upload</span>
        {' · '}2 Map fields{' · '}3 Preview{' · '}4 Run
      </p>

      <div style={{ margin: '0 0 20px' }}>
        <VerdictLine tone="ok">
          <b>Pick the CSV to import.</b> It needs a header row and has to be under 10 MB.
        </VerdictLine>
      </div>

      <form onSubmit={handleSubmit}>
        <TextField
          label="CSV file"
          hint="The first row is read as the column headers. The next step maps them to CRM fields."
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
        />

        {error && (
          <p
            role="alert"
            style={{ margin: '12px 0 0', fontSize: 'var(--a-text-sm)', color: 'var(--a-danger)' }}
          >
            {error}
          </p>
        )}

        <div className="av2-wordrow" style={{ marginTop: 20 }}>
          <Button type="submit" disabled={loading || !fileName} style={{ minWidth: 120 }}>
            {loading ? 'Parsing…' : 'Continue'}
          </Button>
          <Link
            href="/admin/crm/import"
            className="av2-btn av2-btn--quiet"
            style={{ textDecoration: 'none' }}
          >
            Cancel
          </Link>
        </div>
      </form>

      <p style={{ fontSize: 'var(--a-text-xs)', color: 'var(--a-text-2)', marginTop: 20 }}>
        Contacts are matched by email: an existing contact is updated field by field and its tags
        merged, a new one is created. A row carrying neither a name nor an email is skipped.
      </p>
    </div>
  )
}
