'use server'

/**
 * §8.8 Import wizard — server actions for the multi-step CSV import flow.
 *
 * Step flow: upload CSV → parse headers → user maps fields → preview →
 *   POST /api/admin/crm-import (chunked upsert) → status polling.
 *
 * State is kept in a crm_imports row. The row is created here at parse time
 * (status='pending'), advanced to 'running' by the API route, and to
 * 'done'/'error' when the upsert completes.
 */

import { revalidatePath } from 'next/cache'
import { createServiceClient } from '@/lib/supabase/service'
import { getCrmAccess } from '@/app/actions/crm'
import { parseCsv, autoDetectMapping, mapRowToContact, findCsvDuplicates } from '@/lib/crm/import'
import type { FieldMapping, CsvRow, DupWarning, ImportContact } from '@/lib/crm/import'

export type ImportActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// ─── createImportJobAction ─────────────────────────────────────────────────

/**
 * Step 1: Parse the uploaded CSV and create a crm_imports row.
 * Returns the job id, parsed headers, auto-detected mapping, and the first
 * 10 rows as a preview.
 */
export async function createImportJobAction(
  csvText: string,
): Promise<ImportActionResult<{
  jobId: number
  headers: string[]
  mapping: FieldMapping
  previewRows: CsvRow[]
  totalRows: number
}>> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }
  if (access.role !== 'superuser') return { ok: false, error: 'Superuser only' }

  const text = String(csvText ?? '').trim()
  if (!text) return { ok: false, error: 'Empty file' }
  if (text.length > 10 * 1024 * 1024) return { ok: false, error: 'File exceeds 10 MB limit' }

  const { headers, rows } = parseCsv(text)
  if (headers.length === 0) return { ok: false, error: 'Could not parse CSV headers' }
  if (rows.length === 0) return { ok: false, error: 'CSV contains no data rows' }

  const mapping = autoDetectMapping(headers)

  const sb = createServiceClient()
  const { data: job, error } = await sb
    .from('crm_imports')
    .insert({
      source: 'csv_wizard',
      status: 'pending',
      counts: { total: rows.length, imported: 0, skipped: 0, errors: 0 },
      cursor: { csv_text: text },   // store raw text for the upsert route
      field_mapping: mapping,
      row_count: rows.length,
    })
    .select('id')
    .single()

  if (error || !job) return { ok: false, error: error?.message ?? 'Failed to create import job' }

  return {
    ok: true,
    data: {
      jobId: Number(job.id),
      headers,
      mapping,
      previewRows: rows.slice(0, 10),
      totalRows: rows.length,
    },
  }
}

// ─── updateImportMappingAction ─────────────────────────────────────────────

/** Step 2: Save the user's field mapping back to the crm_imports row. */
export async function updateImportMappingAction(
  jobId: number,
  mapping: FieldMapping,
): Promise<ImportActionResult<void>> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }
  if (access.role !== 'superuser') return { ok: false, error: 'Superuser only' }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_imports')
    .update({ field_mapping: mapping })
    .eq('id', jobId)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: undefined }
}

// ─── getImportPreviewAction ────────────────────────────────────────────────

/**
 * Step 3: Return the first 10 contacts (post-mapping) + intra-CSV dup warnings.
 * Reads back from the stored crm_imports row so the route is stateless.
 */
export async function getImportPreviewAction(jobId: number): Promise<
  ImportActionResult<{
    preview: ImportContact[]
    totalRows: number
    dupWarnings: DupWarning[]
    mapping: FieldMapping
  }>
> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }
  if (access.role !== 'superuser') return { ok: false, error: 'Superuser only' }

  const sb = createServiceClient()
  const { data: job, error } = await sb
    .from('crm_imports')
    .select('field_mapping,row_count,cursor')
    .eq('id', jobId)
    .single()

  if (error || !job) return { ok: false, error: 'Import job not found' }

  const mapping = (job.field_mapping ?? {}) as FieldMapping
  const rawText = (job.cursor as { csv_text?: string })?.csv_text ?? ''
  const { rows } = parseCsv(rawText)
  const contacts = rows.map((r) => mapRowToContact(r, mapping))
  const dupWarnings = findCsvDuplicates(contacts)

  return {
    ok: true,
    data: {
      preview: contacts.slice(0, 10),
      totalRows: job.row_count ?? rows.length,
      dupWarnings,
      mapping,
    },
  }
}

// ─── startImportAction ────────────────────────────────────────────────────

/**
 * Step 4: Kick off the actual upsert by marking the job 'running'.
 * The API route /api/admin/crm-import is called client-side via fetch after this.
 */
export async function startImportAction(
  jobId: number,
): Promise<ImportActionResult<void>> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }
  if (access.role !== 'superuser') return { ok: false, error: 'Superuser only' }

  const sb = createServiceClient()
  const { error } = await sb
    .from('crm_imports')
    .update({ status: 'running', started_at: new Date().toISOString() })
    .eq('id', jobId)
    .eq('status', 'pending')
  if (error) return { ok: false, error: error.message }

  revalidatePath('/admin/crm/import')
  return { ok: true, data: undefined }
}

// ─── getImportStatusAction ─────────────────────────────────────────────────

export type ImportJobStatus = {
  id: number
  status: string
  source: string
  rowCount: number | null
  counts: { total: number; imported: number; skipped: number; errors: number }
  errorRows: Array<{ rowIndex: number; row: Record<string, string>; error: string }>
  startedAt: string
  finishedAt: string | null
  notes: string | null
}

export async function getImportStatusAction(
  jobId: number,
): Promise<ImportActionResult<ImportJobStatus>> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }
  if (access.role !== 'superuser') return { ok: false, error: 'Superuser only' }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_imports')
    .select('id,status,source,row_count,counts,error_rows,started_at,finished_at,notes')
    .eq('id', jobId)
    .single()

  if (error || !data) return { ok: false, error: 'Job not found' }

  return {
    ok: true,
    data: {
      id: Number(data.id),
      status: data.status ?? 'unknown',
      source: data.source ?? 'csv_wizard',
      rowCount: data.row_count ?? null,
      counts: (data.counts as ImportJobStatus['counts']) ?? { total: 0, imported: 0, skipped: 0, errors: 0 },
      errorRows: (data.error_rows as ImportJobStatus['errorRows']) ?? [],
      startedAt: data.started_at ?? '',
      finishedAt: data.finished_at ?? null,
      notes: data.notes ?? null,
    },
  }
}

// ─── listImportJobsAction ──────────────────────────────────────────────────

export async function listImportJobsAction(): Promise<ImportActionResult<ImportJobStatus[]>> {
  const access = await getCrmAccess()
  if (!access) return { ok: false, error: 'Not authenticated' }
  if (access.role !== 'superuser') return { ok: false, error: 'Superuser only' }

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('crm_imports')
    .select('id,status,source,row_count,counts,error_rows,started_at,finished_at,notes')
    .order('started_at', { ascending: false })
    .limit(50)

  if (error) return { ok: false, error: error.message }

  return {
    ok: true,
    data: (data ?? []).map((d) => ({
      id: Number(d.id),
      status: d.status ?? 'unknown',
      source: d.source ?? 'csv_wizard',
      rowCount: d.row_count ?? null,
      counts: (d.counts as ImportJobStatus['counts']) ?? { total: 0, imported: 0, skipped: 0, errors: 0 },
      errorRows: (d.error_rows as ImportJobStatus['errorRows']) ?? [],
      startedAt: d.started_at ?? '',
      finishedAt: d.finished_at ?? null,
      notes: d.notes ?? null,
    })),
  }
}
