/**
 * Reads for the TC forms library (packets + clauses).
 * Raw .from() stays here (G1). Writes stay in app/actions/tc-library.ts.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { LISTING_STANDARD_FORM_NUMBERS, SALE_STANDARD_FORM_NUMBERS } from '@/lib/tc/listing-actions'

export type FormPacket = { id: string; name: string; formVersionIds: string[] }
export type ClauseRow = { id: string; scope: string; category: string; title: string; body: string }

async function seedNamedPacket(name: string, nums: readonly string[]): Promise<void> {
  const sb = createServiceClient()
  const { count } = await sb.from('tc_form_packets').select('id', { count: 'exact', head: true }).eq('name', name)
  if ((count ?? 0) > 0) return
  const ids: string[] = []
  for (const n of nums) {
    const id = await findFormVersionIdByNumber(n)
    if (id) ids.push(id)
  }
  if (!ids.length) return
  await sb.from('tc_form_packets').insert({
    name,
    form_version_ids: ids,
    created_by: 'system',
  })
}

async function seedResidentialStandardPacket(): Promise<void> {
  await seedNamedPacket('Residential — Standard', SALE_STANDARD_FORM_NUMBERS)
}

async function seedListingStandardPacket(): Promise<void> {
  await seedNamedPacket('Listing — Standard', LISTING_STANDARD_FORM_NUMBERS)
}

export async function listFormPackets(): Promise<FormPacket[]> {
  await seedResidentialStandardPacket()
  await seedListingStandardPacket()
  const { data } = await createServiceClient()
    .from('tc_form_packets')
    .select('id, name, form_version_ids')
    .order('name')
  return (data ?? []).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    formVersionIds: Array.isArray(r.form_version_ids) ? r.form_version_ids.map(String) : [],
  }))
}

export async function findFormVersionIdByNumber(formNumber: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('tc_form_versions')
    .select('id')
    .eq('form_number', formNumber)
    .not('blank_pdf_storage_path', 'is', null)
    .limit(1)
  const id = data?.[0]?.id
  return id ? String(id) : null
}

export async function listClauses(): Promise<ClauseRow[]> {
  const { data } = await createServiceClient()
    .from('tc_clauses')
    .select('id, scope, category, title, body')
    .order('title')
  return (data ?? []).map((r) => ({
    id: String(r.id),
    scope: String(r.scope ?? ''),
    category: String(r.category ?? ''),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
  }))
}
