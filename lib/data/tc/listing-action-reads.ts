/**
 * Reads for listing-file mutations (accept / duplicate / merge).
 * Raw .from() stays here (G1). Writes stay in app/actions/tc-listings.ts.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type TcDealActionRow = {
  id: string
  property_key: string
  address: string
  city: string | null
  state: string | null
  broker_name: string | null
  stage: string
  stage_detail: string | null
}

export type ListingCycleCopy = {
  id: string
  mls_number: string | null
  /** What the broker confirmed on the listing, from raw.propertyFacts. */
  property_facts: unknown
  sellers: unknown
  buyers: unknown
  listing_price: number | null
  checklist_type: string | null
  status: string | null
  listing_date: string | null
  expiration_date: string | null
}

export type ChecklistItemCopy = {
  name: string
  type_name: string | null
  status: string | null
  sort_order: number | null
}

export type DealContactCopy = {
  role: string
  name: string | null
  company: string | null
  email: string | null
  phone: string | null
  notes: string | null
}

const DEAL_COLS = 'id, property_key, address, city, state, broker_name, stage, stage_detail'

function client() {
  return createServiceClient()
}

function mapDeal(data: {
  id: unknown
  property_key: unknown
  address: unknown
  city: unknown
  state: unknown
  broker_name: unknown
  stage: unknown
  stage_detail: unknown
}): TcDealActionRow {
  return {
    id: String(data.id),
    property_key: String(data.property_key),
    address: String(data.address ?? ''),
    city: data.city == null ? null : String(data.city),
    state: data.state == null ? null : String(data.state),
    broker_name: data.broker_name == null ? null : String(data.broker_name),
    stage: String(data.stage ?? ''),
    stage_detail: data.stage_detail == null ? null : String(data.stage_detail),
  }
}

export async function getDealByPropertyKey(propertyKey: string): Promise<TcDealActionRow | null> {
  const { data } = await client().from('tc_deals').select(DEAL_COLS).eq('property_key', propertyKey).maybeSingle()
  return data ? mapDeal(data) : null
}

export async function getDealById(dealId: string): Promise<TcDealActionRow | null> {
  const { data } = await client().from('tc_deals').select(DEAL_COLS).eq('id', dealId).maybeSingle()
  return data ? mapDeal(data) : null
}

export async function listDealPropertyKeys(): Promise<string[]> {
  const { data } = await client().from('tc_deals').select('property_key')
  return (data ?? []).map((r) => String(r.property_key))
}

export type CdaCycleRow = {
  id: string
  deal_id: string
  sale_price: number | null
  listing_price: number | null
  office_gross: number | null
  commission_percent: number | null
  mls_number: string | null
  escrow_number: string | null
  escrow_closing_date: string | null
  address: string
  sellers: unknown
  buyers: unknown
}

export async function getCycleForCda(cycleId: string): Promise<CdaCycleRow | null> {
  const { data } = await client()
    .from('tc_cycles')
    .select(
      'id, deal_id, sale_price, listing_price, office_gross, commission_percent, mls_number, escrow_number, escrow_closing_date, sellers, buyers, tc_deals(address)',
    )
    .eq('id', cycleId)
    .maybeSingle()
  if (!data) return null
  const deal = data.tc_deals as { address?: string } | { address?: string }[] | null
  const address = Array.isArray(deal) ? deal[0]?.address : deal?.address
  return {
    id: String(data.id),
    deal_id: String(data.deal_id),
    sale_price: data.sale_price == null ? null : Number(data.sale_price),
    listing_price: data.listing_price == null ? null : Number(data.listing_price),
    office_gross: data.office_gross == null ? null : Number(data.office_gross),
    commission_percent: data.commission_percent == null ? null : Number(data.commission_percent),
    mls_number: data.mls_number == null ? null : String(data.mls_number),
    escrow_number: data.escrow_number == null ? null : String(data.escrow_number),
    escrow_closing_date: data.escrow_closing_date == null ? null : String(data.escrow_closing_date),
    address: address ? String(address) : 'Deal',
    sellers: data.sellers ?? [],
    buyers: data.buyers ?? [],
  }
}

export async function listCycleIdsForDeal(dealId: string): Promise<string[]> {
  const { data } = await client().from('tc_cycles').select('id').eq('deal_id', dealId)
  return (data ?? []).map((r) => String(r.id))
}

export async function getLatestListingCycle(dealId: string): Promise<ListingCycleCopy | null> {
  const { data } = await client()
    .from('tc_cycles')
    .select(
      'id, mls_number, sellers, buyers, listing_price, checklist_type, status, listing_date, expiration_date, raw',
    )
    .eq('deal_id', dealId)
    .eq('kind', 'listing')
    .order('created_at', { ascending: false })
    .limit(1)
  const row = data?.[0]
  if (!row) return null
  return {
    id: String(row.id),
    mls_number: row.mls_number == null ? null : String(row.mls_number),
    property_facts:
      row.raw && typeof row.raw === 'object' && !Array.isArray(row.raw)
        ? (row.raw as Record<string, unknown>).propertyFacts
        : null,
    sellers: row.sellers ?? [],
    buyers: row.buyers ?? [],
    listing_price: row.listing_price == null ? null : Number(row.listing_price),
    checklist_type: row.checklist_type == null ? null : String(row.checklist_type),
    status: row.status == null ? null : String(row.status),
    listing_date: row.listing_date == null ? null : String(row.listing_date),
    expiration_date: row.expiration_date == null ? null : String(row.expiration_date),
  }
}

export type CycleDocumentCopy = {
  name: string
  storage_path: string | null
  bytes: number | null
  content_type: string | null
  page_count: number | null
  sha256: string | null
  classification: unknown
}

export async function listCycleDocumentCopies(cycleId: string): Promise<CycleDocumentCopy[]> {
  const { data } = await client()
    .from('tc_documents')
    .select('name, storage_path, bytes, content_type, page_count, sha256, classification')
    .eq('cycle_id', cycleId)
    .eq('archived', false)
  return (data ?? []).map((d) => ({
    name: String(d.name ?? 'Document'),
    storage_path: d.storage_path == null ? null : String(d.storage_path),
    bytes: d.bytes == null ? null : Number(d.bytes),
    content_type: d.content_type == null ? null : String(d.content_type),
    page_count: d.page_count == null ? null : Number(d.page_count),
    sha256: d.sha256 == null ? null : String(d.sha256),
    classification: d.classification ?? {},
  }))
}

export async function listChecklistItemCopies(cycleId: string): Promise<ChecklistItemCopy[]> {
  const { data } = await client()
    .from('tc_checklist_items')
    .select('name, type_name, status, sort_order')
    .eq('cycle_id', cycleId)
  return (data ?? []).map((it) => ({
    name: String(it.name ?? ''),
    type_name: it.type_name == null ? null : String(it.type_name),
    status: it.status == null ? null : String(it.status),
    sort_order: it.sort_order == null ? null : Number(it.sort_order),
  }))
}

export async function listDealContactCopies(dealId: string): Promise<DealContactCopy[]> {
  const { data } = await client()
    .from('tc_deal_contacts')
    .select('role, name, company, email, phone, notes')
    .eq('deal_id', dealId)
  return (data ?? []).map((c) => ({
    role: String(c.role ?? ''),
    name: c.name == null ? null : String(c.name),
    company: c.company == null ? null : String(c.company),
    email: c.email == null ? null : String(c.email),
    phone: c.phone == null ? null : String(c.phone),
    notes: c.notes == null ? null : String(c.notes),
  }))
}

export async function listDealContactKeys(
  dealId: string,
): Promise<Array<{ role: string; name: string | null; email: string | null }>> {
  const { data } = await client()
    .from('tc_deal_contacts')
    .select('role, name, email')
    .eq('deal_id', dealId)
  return (data ?? []).map((c) => ({
    role: String(c.role ?? ''),
    name: c.name == null ? null : String(c.name),
    email: c.email == null ? null : String(c.email),
  }))
}

export type InFlightEnvelope = {
  id: string
  name: string
  status: string
  formNumbers: string[]
}

export async function listInFlightEnvelopes(cycleId: string): Promise<InFlightEnvelope[]> {
  const { data: envs } = await client()
    .from('tc_envelopes')
    .select('id, name, status')
    .eq('cycle_id', cycleId)
    .in('status', ['sent', 'partially_signed', 'awaiting_other_side'])
  if (!envs?.length) return []
  const ids = envs.map((e) => String(e.id))
  const { data: docs } = await client()
    .from('tc_envelope_documents')
    .select('envelope_id, form_version_id, document_id')
    .in('envelope_id', ids)
  const versionIds = [...new Set((docs ?? []).map((d) => d.form_version_id).filter(Boolean).map(String))]
  const documentIds = [...new Set((docs ?? []).map((d) => d.document_id).filter(Boolean).map(String))]
  const numberByVersion = new Map<string, string>()
  if (versionIds.length) {
    const { data: forms } = await client()
      .from('tc_form_versions')
      .select('id, form_number')
      .in('id', versionIds)
    for (const f of forms ?? []) {
      if (f.form_number) numberByVersion.set(String(f.id), String(f.form_number))
    }
  }
  const nameByDoc = new Map<string, string>()
  if (documentIds.length) {
    const { data: files } = await client()
      .from('tc_documents')
      .select('id, name, classification')
      .in('id', documentIds)
    for (const f of files ?? []) {
      const classNum =
        f.classification && typeof f.classification === 'object' && !Array.isArray(f.classification)
          ? (f.classification as { form_number?: unknown }).form_number
          : null
      const label =
        (typeof classNum === 'string' && classNum.trim()) ||
        (f.name ? String(f.name) : '')
      if (label) nameByDoc.set(String(f.id), label)
    }
  }
  const numsByEnv = new Map<string, string[]>()
  for (const d of docs ?? []) {
    const eid = String(d.envelope_id)
    const n = d.form_version_id ? numberByVersion.get(String(d.form_version_id)) : null
    const fromDoc = d.document_id ? nameByDoc.get(String(d.document_id)) : null
    const arr = numsByEnv.get(eid) ?? []
    if (n) arr.push(n)
    else if (fromDoc) arr.push(fromDoc)
    numsByEnv.set(eid, arr)
  }
  return envs.map((e) => ({
    id: String(e.id),
    name: String(e.name ?? 'Envelope'),
    status: String(e.status ?? ''),
    formNumbers: numsByEnv.get(String(e.id)) ?? [],
  }))
}
