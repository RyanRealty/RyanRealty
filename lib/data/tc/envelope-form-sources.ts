import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { formNumberFromClassification } from '@/lib/tc/form-identity'
import { extractPdfPagesText } from '@/lib/tc/pdf-page-text'
import { readRequiredSigners, type FormSignerSource } from '@/lib/tc/required-signers'

type DbRow = Record<string, unknown>

/**
 * Read every document on the envelope and return who must sign.
 * Field maps, stored form numbers, filenames, then PDF page text.
 * Does not ask the broker to name signers.
 */
export async function getFormSourcesForEnvelope(envelopeId: string): Promise<FormSignerSource[]> {
  const supabase = createServiceClient()
  const { data: envRow } = await supabase
    .from('tc_envelopes')
    .select('cycle_id')
    .eq('id', envelopeId)
    .maybeSingle()

  let cycleKind: string | null = null
  if (envRow?.cycle_id) {
    const { data: cycle } = await supabase
      .from('tc_cycles')
      .select('kind')
      .eq('id', envRow.cycle_id)
      .maybeSingle()
    cycleKind = cycle?.kind == null ? null : String(cycle.kind)
  }

  const { data: envDocs } = await supabase
    .from('tc_envelope_documents')
    .select('form_version_id, document_id')
    .eq('envelope_id', envelopeId)
  const rows = (envDocs ?? []) as DbRow[]
  if (!rows.length) return []

  const versionIds = [...new Set(rows.map((d) => d.form_version_id).filter(Boolean).map(String))]
  const documentIds = [...new Set(rows.map((d) => d.document_id).filter(Boolean).map(String))]

  const formById = new Map<string, DbRow>()
  if (versionIds.length) {
    const { data: forms } = await supabase
      .from('tc_form_versions')
      .select('id, form_number, signer_profile, field_map')
      .in('id', versionIds)
    for (const f of (forms ?? []) as DbRow[]) formById.set(String(f.id), f)
  }

  const docById = new Map<string, DbRow>()
  if (documentIds.length) {
    const { data: docs } = await supabase
      .from('tc_documents')
      .select('id, name, classification, storage_path')
      .in('id', documentIds)
    for (const d of (docs ?? []) as DbRow[]) docById.set(String(d.id), d)
  }

  const sources: FormSignerSource[] = []
  for (const row of rows) {
    const form = row.form_version_id ? formById.get(String(row.form_version_id)) : undefined
    const doc = row.document_id ? docById.get(String(row.document_id)) : undefined
    const source: FormSignerSource = {
      formNumber:
        (form?.form_number == null ? null : String(form.form_number)) ??
        formNumberFromClassification(doc?.classification),
      signerProfile: form?.signer_profile == null ? null : String(form.signer_profile),
      fieldMap: (form?.field_map ?? []) as FormSignerSource['fieldMap'],
      documentName: doc?.name == null ? null : String(doc.name),
      cycleKind,
    }
    if (!readRequiredSigners(source).identified && doc?.storage_path) {
      try {
        const { data: blob } = await supabase.storage.from('tc-documents').download(String(doc.storage_path))
        if (blob) source.pageText = await extractPdfPagesText(await blob.arrayBuffer())
      } catch (err) {
        console.warn('[tc] form identify pdf read failed:', err instanceof Error ? err.message : err)
      }
    }
    sources.push(source)
  }
  return sources
}

export type EnvelopeFormFreshness = {
  formVersionId: string
  name: string
  versionLabel: string | null
  updateAvailable: boolean
  pendingVersionLabel: string | null
}

export async function listEnvelopeFormFreshness(envelopeId: string): Promise<EnvelopeFormFreshness[]> {
  const supabase = createServiceClient()
  const { data: envDocs } = await supabase
    .from('tc_envelope_documents')
    .select('form_version_id')
    .eq('envelope_id', envelopeId)
  const versionIds = [
    ...new Set(((envDocs ?? []) as DbRow[]).map((d) => d.form_version_id).filter(Boolean).map(String)),
  ]
  if (!versionIds.length) return []
  const { data: forms } = await supabase
    .from('tc_form_versions')
    .select('id, name, version_label, update_available, pending_version_label')
    .in('id', versionIds)
  return ((forms ?? []) as DbRow[]).map((f) => ({
    formVersionId: String(f.id),
    name: String(f.name ?? ''),
    versionLabel: f.version_label == null ? null : String(f.version_label),
    updateAvailable: f.update_available === true,
    pendingVersionLabel: f.pending_version_label == null ? null : String(f.pending_version_label),
  }))
}
