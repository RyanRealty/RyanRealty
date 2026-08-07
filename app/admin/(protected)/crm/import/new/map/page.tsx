// @no-parity — internal admin surface, no public mockup contract
'use client'

/**
 * Step 2 — Map CSV columns to CRM fields.
 *
 * Reads from the crm_imports row (via getImportPreviewAction which re-parses
 * the stored CSV) and shows a select per header. Saves the mapping with
 * updateImportMappingAction then navigates to the preview step.
 *
 * 11C: migrated to the LOCKED admin v2 language (design_system/admin/ADMIN_UI.md),
 * pattern 6 (config form: single column, label above).
 *
 * THE MAPPING IS THE PAYLOAD, so it is carried over character for character:
 * `headers` is still `Object.keys(result.data.mapping)`, each control is still
 * keyed by the raw CSV header string, its value is still
 * `mapping[header] ?? '__skip__'`, its options are still IMPORTABLE_FIELDS with
 * `value={f.key}` / `{f.label}`, and setMapping still writes
 * `{ ...prev, [header]: value as ImportableFieldKey }`. updateImportMappingAction
 * stores that object as crm_imports.field_mapping and mapRowToContact reads it
 * as header → field key, so neither side of a pair may drift.
 *
 * Also carried over verbatim: `?job=` and `Number(params.get('job') ?? 0)`, the
 * 'Invalid job id' guard, the effect's [jobId] dependency, the saving flow and
 * its 'Saving…' label, the push to /admin/crm/import/new/preview?job=<jobId>,
 * the Cancel href, and totalRows' `.toLocaleString()`.
 *
 * Shape changed, data did not: the <h1> chrome is gone (the nav names the
 * page), the shadcn Select + Label pair became the v2 SelectField (which owns
 * the label), the rows became a responsive grid instead of a fixed 160px label
 * column, and the four step pills became one line of plain text.
 */

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Button, SelectField, VerdictLine } from '@/components/admin/v2'
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
      <div className="av2-scope" style={{ maxWidth: 640, margin: '0 auto', padding: 16 }}>
        <p role="status" style={{ fontSize: 'var(--a-text-sm)', color: 'var(--a-text-2)' }}>
          Loading…
        </p>
      </div>
    )
  }

  const mapped = headers.filter((h) => (mapping[h] ?? '__skip__') !== '__skip__').length
  const skipped = headers.length - mapped

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
        1 Upload{' · '}
        <span style={{ color: 'var(--a-text)', fontWeight: 600 }}>2 Map fields</span>
        {' · '}3 Preview{' · '}4 Run
      </p>

      <div style={{ margin: '0 0 20px' }}>
        <VerdictLine tone={mapped > 0 ? 'ok' : 'attention'}>
          <b>
            {mapped} of {headers.length} {headers.length === 1 ? 'column' : 'columns'} mapped,{' '}
            {skipped} skipped.
          </b>{' '}
          {totalRows.toLocaleString()} data rows.
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

      <form onSubmit={handleSubmit}>
        <div className="av2-editgrid">
          {headers.map((header) => (
            <SelectField
              key={header}
              label={header}
              value={mapping[header] ?? '__skip__'}
              onChange={(e) =>
                setMapping((prev) => ({ ...prev, [header]: e.target.value as ImportableFieldKey }))
              }
            >
              {IMPORTABLE_FIELDS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </SelectField>
          ))}
        </div>

        <div className="av2-wordrow" style={{ marginTop: 20 }}>
          <Button type="submit" disabled={saving} style={{ minWidth: 140 }}>
            {saving ? 'Saving…' : 'Preview import'}
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
        A column left on “— skip this column —” is not read. First name and last name are joined
        into the contact&apos;s name; tags split on commas.
      </p>
    </div>
  )
}
