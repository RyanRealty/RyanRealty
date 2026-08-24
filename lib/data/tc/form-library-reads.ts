/**
 * Reads for the TC forms library (packets + clauses).
 * Raw .from() stays here (G1). Writes stay in app/actions/tc-library.ts.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'
import { FORM_PACKET_SEEDS, formNameMatchesNeedle, type FormPacketSeed } from '@/lib/tc/form-packets'

export type FormPacket = { id: string; name: string; formVersionIds: string[] }
export type ClauseRow = { id: string; scope: string; category: string; title: string; body: string }

const LEFTOVER_ODS_INPUT = 'ODS Residential Input Form 2024-05'

function sameIds(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  const left = [...a].sort()
  const right = [...b].sort()
  return left.every((id, i) => id === right[i])
}

async function resolveSeedFormIds(seed: FormPacketSeed): Promise<string[]> {
  const ids: string[] = []
  if (seed.formNumbers) {
    for (const n of seed.formNumbers) {
      const id = await findFormVersionIdByNumber(n)
      if (id) ids.push(id)
    }
  }
  if (seed.nameIncludes) {
    for (const needle of seed.nameIncludes) {
      const id = await findFormVersionIdByNeedle(needle)
      if (id && !ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

async function seedPacket(seed: FormPacketSeed): Promise<void> {
  const sb = createServiceClient()
  const ids = await resolveSeedFormIds(seed)
  if (!ids.length) return
  const { data: existing } = await sb
    .from('tc_form_packets')
    .select('id, form_version_ids')
    .eq('name', seed.name)
    .maybeSingle()
  if (existing?.id) {
    const current = Array.isArray(existing.form_version_ids) ? existing.form_version_ids.map(String) : []
    if (sameIds(current, ids)) return
    await sb.from('tc_form_packets').update({ form_version_ids: ids }).eq('id', existing.id)
    return
  }
  await sb.from('tc_form_packets').insert({
    name: seed.name,
    form_version_ids: ids,
    created_by: 'system',
  })
}

async function retireLeftoverOdsInputSample(): Promise<void> {
  const sb = createServiceClient()
  await sb
    .from('tc_form_versions')
    .update({ retired_at: new Date().toISOString().slice(0, 10) })
    .eq('name', LEFTOVER_ODS_INPUT)
    .is('source_version_id', null)
    .is('retired_at', null)
}

export async function listFormPackets(): Promise<FormPacket[]> {
  await retireLeftoverOdsInputSample()
  for (const seed of FORM_PACKET_SEEDS) await seedPacket(seed)
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
    .select('id, name, source_version_id')
    .eq('form_number', formNumber)
    .is('retired_at', null)
    .not('blank_pdf_storage_path', 'is', null)
  const live = (data ?? []).filter((r) => !/\(SAMPLE/i.test(String(r.name ?? '')))
  const ranked = live.sort((a, b) => {
    const aExempt = /exempt/i.test(String(a.name ?? '')) ? 1 : 0
    const bExempt = /exempt/i.test(String(b.name ?? '')) ? 1 : 0
    if (aExempt !== bExempt) return aExempt - bExempt
    const aSrc = a.source_version_id ? 0 : 1
    const bSrc = b.source_version_id ? 0 : 1
    return aSrc - bSrc
  })
  const id = ranked[0]?.id
  return id ? String(id) : null
}

export async function findFormVersionIdByNeedle(needle: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from('tc_form_versions')
    .select('id, name')
    .is('retired_at', null)
    .not('blank_pdf_storage_path', 'is', null)
    .ilike('name', `%${needle}%`)
  const hit = (data ?? []).find((r) => formNameMatchesNeedle(String(r.name ?? ''), needle))
  return hit?.id ? String(hit.id) : null
}

export async function getFormVersionBlankRow(id: string): Promise<{
  id: string
  name: string
  form_number: string | null
  signer_profile: string | null
  page_count: number | null
} | null> {
  const { data } = await createServiceClient()
    .from('tc_form_versions')
    .select('id, name, form_number, signer_profile, page_count')
    .eq('id', id)
    .maybeSingle()
  if (!data) return null
  return {
    id: String(data.id),
    name: String(data.name ?? ''),
    form_number: data.form_number == null ? null : String(data.form_number),
    signer_profile: data.signer_profile == null ? null : String(data.signer_profile),
    page_count: data.page_count == null ? null : Number(data.page_count),
  }
}

export async function listLiveFormVersionsForMapping(): Promise<
  Array<{
    id: string
    name: string
    form_number: string | null
    signer_profile: string | null
    page_count: number | null
    blank_pdf_storage_path: string | null
    field_map: unknown
  }>
> {
  const { data } = await createServiceClient()
    .from('tc_form_versions')
    .select('id, name, form_number, signer_profile, page_count, blank_pdf_storage_path, field_map')
    .is('retired_at', null)
  return (data ?? []).map((v) => ({
    id: String(v.id),
    name: String(v.name ?? ''),
    form_number: v.form_number == null ? null : String(v.form_number),
    signer_profile: v.signer_profile == null ? null : String(v.signer_profile),
    page_count: v.page_count == null ? null : Number(v.page_count),
    blank_pdf_storage_path: v.blank_pdf_storage_path == null ? null : String(v.blank_pdf_storage_path),
    field_map: v.field_map,
  }))
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
