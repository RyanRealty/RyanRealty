import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

type DbRow = Record<string, unknown>

export type EnvelopeTemplateOption = {
  id: string
  name: string
  formNumber: string | null
  libraryCode: string
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
    supabase.from('tc_form_libraries').select('id, code'),
  ])
  const codeById = new Map(((libs ?? []) as DbRow[]).map((l) => [String(l.id), String(l.code)]))
  const rank = (code: string) => (code === 'OR' ? 0 : code === 'OREF' ? 1 : code === 'ODS' ? 2 : 9)
  return ((versions ?? []) as DbRow[])
    .filter((v) => v.blank_pdf_storage_path && !/\(SAMPLE/i.test(String(v.name ?? '')))
    .map((v) => ({
      id: String(v.id),
      name: String(v.name),
      formNumber: v.form_number == null ? null : String(v.form_number),
      libraryCode: codeById.get(String(v.library_id)) ?? '?',
      versionLabel: v.version_label == null ? null : String(v.version_label),
      updateAvailable: v.update_available === true,
      pendingVersionLabel: v.pending_version_label == null ? null : String(v.pending_version_label),
    }))
    .sort(
      (a, b) =>
        Number(b.updateAvailable) - Number(a.updateAvailable) ||
        rank(a.libraryCode) - rank(b.libraryCode) ||
        (a.formNumber ?? a.name).localeCompare(b.formNumber ?? b.name),
    )
}
