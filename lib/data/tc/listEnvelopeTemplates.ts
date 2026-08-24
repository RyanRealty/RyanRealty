import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { libraryRank } from '@/lib/tc/form-library-filter'

type DbRow = Record<string, unknown>

export type EnvelopeTemplateOption = {
  id: string
  name: string
  formNumber: string | null
  libraryCode: string
  libraryName: string
  versionLabel: string | null
  updateAvailable: boolean
  pendingVersionLabel: string | null
}

/** Production blanks a broker can compose from. Samples and forms without a PDF are omitted. */
export async function listEnvelopeTemplates(): Promise<EnvelopeTemplateOption[]> {
  const supabase = createServiceClient()
  const [{ data: versions }, { data: libs }] = await Promise.all([
    supabase
      .from('tc_form_versions')
      .select(
        'id, name, form_number, blank_pdf_storage_path, library_id, version_label, update_available, pending_version_label',
      )
      .is('retired_at', null)
      .not('blank_pdf_storage_path', 'is', null),
    supabase.from('tc_form_libraries').select('id, code, name'),
  ])
  const codeById = new Map(((libs ?? []) as DbRow[]).map((l) => [String(l.id), String(l.code)]))
  const nameById = new Map(((libs ?? []) as DbRow[]).map((l) => [String(l.id), String(l.name ?? l.code)]))
  return ((versions ?? []) as DbRow[])
    .filter((v) => v.blank_pdf_storage_path && !/\(SAMPLE/i.test(String(v.name ?? '')))
    .map((v) => {
      const libraryCode = codeById.get(String(v.library_id)) ?? '?'
      return {
        id: String(v.id),
        name: String(v.name),
        formNumber: v.form_number == null ? null : String(v.form_number),
        libraryCode,
        libraryName: nameById.get(String(v.library_id)) ?? libraryCode,
        versionLabel: v.version_label == null ? null : String(v.version_label),
        updateAvailable: v.update_available === true,
        pendingVersionLabel: v.pending_version_label == null ? null : String(v.pending_version_label),
      }
    })
    .sort(
      (a, b) =>
        Number(b.updateAvailable) - Number(a.updateAvailable) ||
        libraryRank(a.libraryCode) - libraryRank(b.libraryCode) ||
        (a.formNumber ?? a.name).localeCompare(b.formNumber ?? b.name),
    )
}
