import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { pickPreferredOrefForm, type OrefFormCandidate } from '@/lib/tc/oref-fill'

export type PreferredOrefForm = {
  id: string
  formNumber: string
  name: string
  fieldCount: number
}

function asString(v: unknown): string {
  return v == null ? '' : String(v)
}

export async function getPreferredOrefSaleAgreement(): Promise<{
  data: PreferredOrefForm | null
  error: string | null
}> {
  try {
    const sb = createServiceClient()
    const [{ data: libs }, { data: versions }] = await Promise.all([
      sb.from('tc_form_libraries').select('id, code'),
      sb
        .from('tc_form_versions')
        .select('id, library_id, form_number, name, field_map, blank_pdf_storage_path')
        .is('retired_at', null),
    ])
    const codeById = new Map(
      ((libs ?? []) as Record<string, unknown>[]).map((l) => [asString(l.id), asString(l.code)]),
    )
    const candidates: OrefFormCandidate[] = ((versions ?? []) as Record<string, unknown>[]).map((v) => {
      const fields = Array.isArray(v.field_map) ? v.field_map : []
      return {
        id: asString(v.id),
        libraryCode: codeById.get(asString(v.library_id)) ?? '',
        formNumber: v.form_number == null ? null : asString(v.form_number),
        name: asString(v.name),
        fieldCount: fields.length,
        blankPath: v.blank_pdf_storage_path ? asString(v.blank_pdf_storage_path) : null,
      }
    })
    const picked = pickPreferredOrefForm(candidates)
    if (!picked) return { data: null, error: 'No OREF sale agreement is in the form library.' }
    return {
      data: {
        id: picked.id,
        formNumber: picked.formNumber ?? '',
        name: picked.name,
        fieldCount: picked.fieldCount,
      },
      error: null,
    }
  } catch (err) {
    console.error('[getPreferredOrefSaleAgreement]', err)
    return { data: null, error: 'Database is not configured.' }
  }
}
