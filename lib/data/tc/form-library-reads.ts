/**
 * Reads for the TC forms library (packets + clauses).
 * Raw .from() stays here (G1). Writes stay in app/actions/tc-library.ts.
 */
import 'server-only'

import { createServiceClient } from '@/lib/supabase/service'

export type FormPacket = { id: string; name: string; formVersionIds: string[] }
export type ClauseRow = { id: string; scope: string; category: string; title: string; body: string }

export async function listFormPackets(): Promise<FormPacket[]> {
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
