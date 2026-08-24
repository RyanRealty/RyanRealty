import 'server-only'

import { createHash } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { parseFormNumber, parseVersionLabel } from '@/lib/tc/form-catalog-diff'
import { translateSkyslopeFields, type SkySlopeSourceField, type SkySlopeSourcePage } from '@/lib/tc/skyslope-field-map'
import { fieldMapFromAcroFormPdf } from '@/lib/tc/acroform-field-map'
import { fallbackSigningStack } from '@/lib/tc/fallback-signing-stack'

const BUCKET = process.env.TC_FORMS_BUCKET ?? 'tc-forms'

function slugify(s: string): string {
  return (s || 'form').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
}

export type IngestLicensedBlankInput = {
  libraryCode: string
  libraryName?: string
  region?: string
  formNumber?: string | null
  name: string
  sourceFormId?: string | null
  sourceVersionId: string
  versionLabel?: string | null
  pageCount?: number | null
  effectiveDate?: string | null
  pdf: Buffer
  sourceFields?: { fields?: SkySlopeSourceField[]; pages?: SkySlopeSourcePage[] }
}

export type IngestLicensedBlankResult =
  | { ok: true; formVersionId: string; sha256: string; fields: number }
  | { ok: false; error: string }

export async function ingestLicensedBlankPdf(
  input: IngestLicensedBlankInput,
): Promise<IngestLicensedBlankResult> {
  if (!input.libraryCode || !input.name || !input.sourceVersionId) {
    return { ok: false, error: 'missing libraryCode/name/sourceVersionId' }
  }
  if (input.pdf.byteLength < 100) return { ok: false, error: 'pdf decode too small' }

  const sb = createServiceClient()
  const sha256 = createHash('sha256').update(input.pdf).digest('hex')
  const path = `${slugify(input.libraryCode)}/${input.sourceVersionId}__${slugify(input.name)}.pdf`
  const up = await sb.storage.from(BUCKET).upload(path, input.pdf, { contentType: 'application/pdf', upsert: true })
  if (up.error) return { ok: false, error: `storage: ${up.error.message}` }

  let libraryId: string
  const { data: existingLib } = await sb.from('tc_form_libraries').select('id').eq('code', input.libraryCode).maybeSingle()
  if (existingLib?.id) {
    libraryId = String(existingLib.id)
  } else {
    const { data: newLib, error: libErr } = await sb
      .from('tc_form_libraries')
      .insert({
        code: input.libraryCode,
        name: input.libraryName ?? input.libraryCode,
        region: input.region ?? 'US-OR',
      })
      .select('id')
      .single()
    if (libErr || !newLib) return { ok: false, error: `library: ${libErr?.message ?? 'insert failed'}` }
    libraryId = String(newLib.id)
  }

  let fieldMap = translateSkyslopeFields(input.sourceFields?.fields, input.sourceFields?.pages)
  let fieldMapSource = fieldMap.length ? 'skyslope' : 'acroform'
  if (!fieldMap.length) {
    try {
      fieldMap = await fieldMapFromAcroFormPdf(new Uint8Array(input.pdf))
    } catch {
      fieldMap = []
    }
  }
  if (!fieldMap.length) {
    fieldMap = fallbackSigningStack({
      pageCount: input.pageCount ?? 1,
      formNumber: input.formNumber ?? parseFormNumber(input.name),
      signerProfile: null,
      documentName: input.name,
    })
    fieldMapSource = 'fallback_stack'
  }

  const payload = {
    library_id: libraryId,
    form_number: input.formNumber || parseFormNumber(input.name),
    name: input.name,
    effective_date: input.effectiveDate ?? null,
    blank_pdf_storage_path: path,
    sha256,
    page_count: input.pageCount ?? null,
    field_map: fieldMap,
    field_map_source: fieldMapSource,
    source_form_id: input.sourceFormId ?? null,
    source_version_id: input.sourceVersionId,
    version_label: input.versionLabel || parseVersionLabel(input.name),
    source_fields: input.sourceFields ?? null,
    source_checked_at: new Date().toISOString(),
    update_available: false,
    retired_at: null,
    updated_at: new Date().toISOString(),
  }

  const { data: existing } = await sb
    .from('tc_form_versions')
    .select('id')
    .eq('source_version_id', input.sourceVersionId)
    .maybeSingle()
  let row: { id: string } | null = existing ? { id: String(existing.id) } : null
  if (row) {
    const { error: updErr } = await sb.from('tc_form_versions').update(payload).eq('id', row.id)
    if (updErr) return { ok: false, error: `update: ${updErr.message}` }
  } else {
    const { data: inserted, error: insErr } = await sb.from('tc_form_versions').insert(payload).select('id').single()
    if (insErr || !inserted) return { ok: false, error: `insert: ${insErr?.message ?? 'failed'}` }
    row = { id: String(inserted.id) }
  }

  if (input.sourceFormId) {
    await sb
      .from('tc_form_versions')
      .update({
        update_available: true,
        superseded_by: row.id,
        retired_at: new Date().toISOString().slice(0, 10),
      })
      .eq('source_form_id', input.sourceFormId)
      .neq('source_version_id', input.sourceVersionId)
  }

  return { ok: true, formVersionId: row.id, sha256, fields: fieldMap.length }
}
