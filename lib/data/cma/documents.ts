/**
 * CMA document rows — reads + writes for `public.cmas` and `public.cma_comps`
 * used by the deterministic builder, the public /cma/[slug] route, and the
 * admin review flow.
 */

import 'server-only'
import { createServiceClient } from '@/lib/supabase/service'

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createServiceClient()
}

export type CmaAdminRow = Record<string, unknown>

/** Full cmas row (including html_content + citations) by slug. */
export async function getCmaAdminRowBySlug(slug: string): Promise<CmaAdminRow | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb.from('cmas').select('*').eq('slug', slug.trim().toLowerCase()).maybeSingle()
  return (data ?? null) as CmaAdminRow | null
}

/** The public view read: only what the /cma/[slug] route needs to serve. */
export async function getCmaHtmlBySlug(
  slug: string,
): Promise<{ html_content: string | null; html_path: string | null; status: string } | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('cmas')
    .select('html_content, html_path, status')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  return (data ?? null) as { html_content: string | null; html_path: string | null; status: string } | null
}

/** Patch a cmas row by slug. */
export async function updateCmaRowFieldsBySlug(
  slug: string,
  updates: Record<string, unknown>,
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error } = await sb.from('cmas').update(updates).eq('slug', slug.trim().toLowerCase())
  return error ? { ok: false, error: error.message } : { ok: true }
}

/** Delete a cmas row (and its comps) by id. */
export async function deleteCmaRowById(id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  await sb.from('cma_comps').delete().eq('cma_id', id)
  const { error } = await sb.from('cmas').delete().eq('id', id)
  return error ? { ok: false, error: error.message } : { ok: true }
}

export type CmaCompInsert = {
  cma_id: string
  comp_listing_key: string
  comp_order: number
  comp_address: string | null
  sold_price: number | null
  sold_date: string | null
  days_to_offer: number | null
  dom_total: number | null
  price_per_sqft: number | null
}

/** Replace the cma_comps set for one CMA (idempotent rebuilds). */
export async function replaceCmaComps(
  cmaId: string,
  comps: CmaCompInsert[],
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  const { error: delErr } = await sb.from('cma_comps').delete().eq('cma_id', cmaId)
  if (delErr) return { ok: false, error: delErr.message }
  if (comps.length === 0) return { ok: true }
  const { error } = await sb.from('cma_comps').insert(comps)
  return error ? { ok: false, error: error.message } : { ok: true }
}
