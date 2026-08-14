import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { pickPreferredOrefForm, type OrefFormCandidate } from '@/lib/tc/oref-fill'

type DbRow = Record<string, unknown>

function asString(v: unknown): string {
  return v == null ? '' : String(v)
}

function client() {
  return createServiceClient()
}

export async function loadPreferredOrefForm(): Promise<OrefFormCandidate | null> {
  const sb = client()
  const [{ data: libs }, { data: versions }] = await Promise.all([
    sb.from('tc_form_libraries').select('id, code'),
    sb
      .from('tc_form_versions')
      .select('id, library_id, form_number, name, field_map, blank_pdf_storage_path, update_available')
      .is('retired_at', null),
  ])
  const codeById = new Map(((libs ?? []) as DbRow[]).map((l) => [asString(l.id), asString(l.code)]))
  const candidates: OrefFormCandidate[] = ((versions ?? []) as DbRow[]).map((v) => {
    const fields = Array.isArray(v.field_map) ? v.field_map : []
    return {
      id: asString(v.id),
      libraryCode: codeById.get(asString(v.library_id)) ?? '',
      formNumber: v.form_number == null ? null : asString(v.form_number),
      name: asString(v.name),
      fieldCount: fields.length,
      blankPath: v.blank_pdf_storage_path ? asString(v.blank_pdf_storage_path) : null,
      updateAvailable: v.update_available === true,
    }
  })
  return pickPreferredOrefForm(candidates)
}

export async function getOrefCycleForFill(cycleId: string): Promise<{ data: DbRow | null; error: string | null }> {
  const { data, error } = await client()
    .from('tc_cycles')
    .select(
      'id, deal_id, sellers, buyers, listing_price, sale_price, mls_number, escrow_number, escrow_company, earnest_money, contract_acceptance_date, escrow_closing_date, actual_closing_date, broker_name, source_guid',
    )
    .eq('id', cycleId)
    .maybeSingle()
  if (error) {
    console.error('[getOrefCycleForFill]', error)
    return { data: null, error: 'Could not read the cycle.' }
  }
  return { data: (data as DbRow | null) ?? null, error: null }
}

export async function getOrefDealForFill(dealId: string): Promise<{ data: DbRow | null; error: string | null }> {
  const { data, error } = await client()
    .from('tc_deals')
    .select('id, address, city, state, zip, broker_name, property_key')
    .eq('id', dealId)
    .maybeSingle()
  if (error) {
    console.error('[getOrefDealForFill]', error)
    return { data: null, error: 'Could not read the deal.' }
  }
  return { data: (data as DbRow | null) ?? null, error: null }
}

export async function getOrefFormVersionRow(id: string): Promise<DbRow | null> {
  const { data } = await client()
    .from('tc_form_versions')
    .select('id, field_map, name, form_number, page_count')
    .eq('id', id)
    .maybeSingle()
  return (data as DbRow | null) ?? null
}

export async function getOrefDocumentRow(
  id: string,
): Promise<{ data: DbRow | null; error: string | null }> {
  const { data, error } = await client()
    .from('tc_documents')
    .select('id, name, storage_path, cycle_id, classification')
    .eq('id', id)
    .maybeSingle()
  if (error) {
    console.error('[getOrefDocumentRow]', error)
    return { data: null, error: 'Could not read the filled packet.' }
  }
  return { data: (data as DbRow | null) ?? null, error: null }
}

export async function getMattMailboxPersonId(email: string): Promise<number | null> {
  const { data } = await client()
    .from('crm_contact_points')
    .select('person_id')
    .eq('kind', 'email')
    .ilike('value', email)
    .maybeSingle()
  const personId = typeof data?.person_id === 'number' ? data.person_id : Number(data?.person_id)
  if (!Number.isFinite(personId) || personId <= 0) return null
  return personId
}

export async function getCycleDealId(cycleId: string): Promise<string | null> {
  const { data } = await client().from('tc_cycles').select('deal_id').eq('id', cycleId).maybeSingle()
  return data?.deal_id ? asString(data.deal_id) : null
}

export async function getOrefCycleForSeal(cycleId: string): Promise<DbRow | null> {
  const { data } = await client()
    .from('tc_cycles')
    .select('id, deal_id, source_guid')
    .eq('id', cycleId)
    .maybeSingle()
  return (data as DbRow | null) ?? null
}

export async function getEnvelopeIdForDocument(documentId: string): Promise<string | null> {
  const { data } = await client()
    .from('tc_envelope_documents')
    .select('envelope_id')
    .eq('document_id', documentId)
    .maybeSingle()
  return data?.envelope_id ? asString(data.envelope_id) : null
}
