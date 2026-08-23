import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { FormSignerSource } from '@/lib/tc/required-signers'

type DbRow = Record<string, unknown>

/** Form sources on an envelope — who must sign, from the form not a guess. */
export async function getFormSourcesForEnvelope(envelopeId: string): Promise<FormSignerSource[]> {
  const supabase = createServiceClient()
  const { data: envDocs } = await supabase
    .from('tc_envelope_documents')
    .select('form_version_id')
    .eq('envelope_id', envelopeId)
  const ids = ((envDocs ?? []) as DbRow[])
    .map((d) => d.form_version_id)
    .filter(Boolean)
    .map(String)
  if (!ids.length) return []
  const { data: forms } = await supabase
    .from('tc_form_versions')
    .select('form_number, signer_profile, field_map')
    .in('id', ids)
  return ((forms ?? []) as DbRow[]).map((f) => ({
    formNumber: f.form_number == null ? null : String(f.form_number),
    signerProfile: f.signer_profile == null ? null : String(f.signer_profile),
    fieldMap: (f.field_map ?? []) as FormSignerSource['fieldMap'],
  }))
}
