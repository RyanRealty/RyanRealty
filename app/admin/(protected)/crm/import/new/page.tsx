// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * Step 1 — Upload CSV.
 *
 * Reads the file client-side (no server form submission needed), calls
 * createImportJobAction, and navigates to /admin/crm/import/new/map?job=<id>.
 */

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { createImportJobAction } from '@/app/actions/crm-import'

export default function ImportUploadPage() {
  const router = useRouter()
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    setFileName(file?.name ?? null)
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
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
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      {/* Breadcrumb */}
      <nav className="mb-2 text-xs text-muted-foreground">
        <Link href="/admin/crm/import" className="hover:text-foreground">Import contacts</Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Upload CSV</span>
      </nav>

      {/* Step indicator */}
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 font-semibold">1</span>
        <span className="font-medium text-foreground">Upload</span>
        <span className="text-border">›</span>
        <span>Map fields</span>
        <span className="text-border">›</span>
        <span>Preview</span>
        <span className="text-border">›</span>
        <span>Run</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-1">Upload a CSV</h1>
      <p className="text-sm text-muted-foreground mb-8">
        Your file must have a header row. Maximum 10 MB. Contacts are matched
        by email — existing contacts are updated, new ones are created.
      </p>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Drop zone */}
        <label
          htmlFor="csvFile"
          className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border bg-card px-6 py-12 text-center cursor-pointer hover:border-primary transition-colors"
        >
          <svg className="h-10 w-10 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
          </svg>
          <div>
            <span className="text-sm font-medium text-foreground">
              {fileName ? fileName : 'Click to choose a CSV file'}
            </span>
            <p className="mt-0.5 text-xs text-muted-foreground">CSV · max 10 MB</p>
          </div>
          <input
            id="csvFile"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={handleFileChange}
          />
        </label>

        {error && (
          <p className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={loading || !fileName} className="min-w-[120px]">
            {loading ? 'Parsing…' : 'Continue'}
          </Button>
          <Link href="/admin/crm/import">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </main>
  )
}
