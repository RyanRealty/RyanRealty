import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import type { MappedField } from '@/lib/tc/skyslope-field-map'

export async function getEnvelopeCycleKindAndDeal(
  cycleId: string,
): Promise<{ kind: string | null; dealId: string | null } | null> {
  const { data } = await createServiceClient()
    .from('tc_cycles')
    .select('kind, deal_id')
    .eq('id', cycleId)
    .maybeSingle()
  if (!data) return null
  return {
    kind: data.kind == null ? null : String(data.kind),
    dealId: data.deal_id == null ? null : String(data.deal_id),
  }
}

export type UnassignedEnvelopeFieldRow = {
  id: string
  documentId: string
  recipientId: string | null
  type: string
  page: number
  x: number
  y: number
}

export async function listUnassignedEnvelopeFields(
  envelopeId: string,
): Promise<UnassignedEnvelopeFieldRow[]> {
  const { data } = await createServiceClient()
    .from('tc_envelope_fields')
    .select('id, document_id, recipient_id, type, page, x, y')
    .eq('envelope_id', envelopeId)
    .is('recipient_id', null)
  return ((data ?? []) as Array<Record<string, unknown>>).map((f) => ({
    id: String(f.id),
    documentId: String(f.document_id ?? ''),
    recipientId: f.recipient_id == null ? null : String(f.recipient_id),
    type: String(f.type ?? ''),
    page: Number(f.page) || 1,
    x: Number(f.x) || 0,
    y: Number(f.y) || 0,
  }))
}

export async function listEnvelopeDocumentFormVersions(
  envelopeId: string,
): Promise<Array<{ documentId: string; formVersionId: string | null }>> {
  const { data } = await createServiceClient()
    .from('tc_envelope_documents')
    .select('document_id, form_version_id')
    .eq('envelope_id', envelopeId)
  return ((data ?? []) as Array<Record<string, unknown>>).map((d) => ({
    documentId: String(d.document_id ?? ''),
    formVersionId: d.form_version_id == null ? null : String(d.form_version_id),
  }))
}

export async function getFormVersionFieldMaps(
  versionIds: readonly string[],
): Promise<Map<string, MappedField[]>> {
  const mapByVersion = new Map<string, MappedField[]>()
  if (!versionIds.length) return mapByVersion
  const { data } = await createServiceClient()
    .from('tc_form_versions')
    .select('id, field_map')
    .in('id', [...versionIds])
  for (const f of (data ?? []) as Array<Record<string, unknown>>) {
    mapByVersion.set(String(f.id), Array.isArray(f.field_map) ? (f.field_map as MappedField[]) : [])
  }
  return mapByVersion
}

export async function getListPriceByMlsNumber(mlsNumber: string): Promise<number | null> {
  const k = mlsNumber.trim()
  if (!k) return null
  const { data } = await createServiceClient()
    .from('listing_tile_mv')
    .select('list_price')
    .eq('list_number', k)
    .maybeSingle()
  const n = Number((data as { list_price?: number | null } | null)?.list_price)
  return Number.isFinite(n) && n > 0 ? n : null
}
