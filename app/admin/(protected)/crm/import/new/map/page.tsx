// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * Step 2 — Map CSV columns to CRM fields.
 *
 * Reads from the crm_imports row (via getImportPreviewAction which re-parses
 * the stored CSV) and shows a select per header. Saves the mapping with
 * updateImportMappingAction then navigates to the preview step.
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { IMPORTABLE_FIELDS, type FieldMapping, type ImportableFieldKey } from '@/lib/crm/import'
import { getImportPreviewAction, updateImportMappingAction } from '@/app/actions/crm-import'

export default function ImportMapPage() {
  const router = useRouter()
  const params = useSearchParams()
  const jobId = Number(params.get('job') ?? 0)

  const [headers, setHeaders] = useState<string[]>([])
  const [mapping, setMapping] = useState<FieldMapping>({})
  const [totalRows, setTotalRows] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!jobId) { setError('Invalid job id'); setLoading(false); return }
    getImportPreviewAction(jobId).then((result) => {
      if (!result.ok) { setError(result.error); setLoading(false); return }
      setHeaders(Object.keys(result.data.mapping))
      setMapping(result.data.mapping)
      setTotalRows(result.data.totalRows)
      setLoading(false)
    })
  }, [jobId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!jobId) return
    setSaving(true)
    setError(null)
    const result = await updateImportMappingAction(jobId, mapping)
    if (!result.ok) { setError(result.error); setSaving(false); return }
    router.push(`/admin/crm/import/new/preview?job=${jobId}`)
  }

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <p className="text-sm text-muted-foreground">Loading…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <nav className="mb-2 text-xs text-muted-foreground">
        <Link href="/admin/crm/import" className="hover:text-foreground">Import contacts</Link>
        <span className="px-1.5">/</span>
        <span className="text-foreground">Map fields</span>
      </nav>

      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-muted text-muted-foreground px-2 py-0.5">1</span>
        <span>Upload</span>
        <span className="text-border">›</span>
        <span className="rounded-full bg-primary text-primary-foreground px-2 py-0.5 font-semibold">2</span>
        <span className="font-medium text-foreground">Map fields</span>
        <span className="text-border">›</span>
        <span>Preview</span>
        <span className="text-border">›</span>
        <span>Run</span>
      </div>

      <h1 className="text-2xl font-bold text-foreground mb-1">Map CSV columns</h1>
      <p className="text-sm text-muted-foreground mb-8">
        {totalRows.toLocaleString()} data rows detected. Match each column to a CRM field, or skip it.
        Columns mapped to "skip" are ignored.
      </p>

      {error && (
        <p className="mb-4 rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {headers.map((header) => (
            <div key={header} className="flex items-center gap-4 px-4 py-3">
              <Label className="w-40 shrink-0 text-sm font-medium text-foreground truncate" title={header}>
                {header}
              </Label>
              <Select
                value={mapping[header] ?? '__skip__'}
                onValueChange={(val) =>
                  setMapping((prev) => ({ ...prev, [header]: val as ImportableFieldKey }))
                }
              >
                <SelectTrigger className="flex-1 h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {IMPORTABLE_FIELDS.map((f) => (
                    <SelectItem key={f.key} value={f.key}>
                      {f.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 pt-2">
          <Button type="submit" disabled={saving} className="min-w-[140px]">
            {saving ? 'Saving…' : 'Preview import'}
          </Button>
          <Link href="/admin/crm/import">
            <Button type="button" variant="outline">Cancel</Button>
          </Link>
        </div>
      </form>
    </main>
  )
}
