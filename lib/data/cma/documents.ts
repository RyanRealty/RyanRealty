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

export type CmaServeHead = {
  html_path: string | null
  status: string
  broker_slug: string | null
}

export type CmaRenderSource = {
  html_path: string | null
  status: string
  render_args: Record<string, unknown> | null
  broker_slug: string | null
  build_summary: Record<string, unknown> | null
}

/** Metadata-only admin review read. Never pulls html_content / citations / render_args. */
export const CMA_ADMIN_REVIEW_COLUMNS =
  'id, slug, doc_type, status, subject_address, subject_city, subject_listing_key, subject_beds, subject_baths, subject_sqft, client_name, client_email, client_phone, client_notes, broker_slug, built_at, created_at, finalized_at, delivered_at, archived_at, html_path, recommended_list, value_low, value_high, published_to_listing, published_at, published_by, comps_count, build_error, build_summary, price_override, person_id, request_source'

/**
 * Full cmas row (including html_content + citations) by slug.
 *
 * P12: a failed read is NOT returned as null. Null means the slug is missing;
 * a transport/RLS/schema error throws so send/publish paths cannot treat a
 * broken read as "no document" and silently skip or mis-route.
 *
 * Do not use this on the review page or /view — blobs are hundreds of KB and
 * pin the pool for 45–60s. Use getCmaAdminReviewRowBySlug / getCmaServeHead.
 */
export async function getCmaAdminRowBySlug(slug: string): Promise<CmaAdminRow | null> {
  const sb = client()
  if (!sb) throw new Error('getCmaAdminRowBySlug: Supabase not configured')
  const { data, error } = await sb
    .from('cmas')
    .select('*')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  if (error) {
    console.error('[getCmaAdminRowBySlug]', error.message)
    throw new Error(`getCmaAdminRowBySlug failed: ${error.message}`)
  }
  return (data ?? null) as CmaAdminRow | null
}

/** Review chrome only. Missing slug → null (404). Transport error → throw. */
export async function getCmaAdminReviewRowBySlug(slug: string): Promise<CmaAdminRow | null> {
  const sb = client()
  if (!sb) throw new Error('getCmaAdminReviewRowBySlug: Supabase not configured')
  const { data, error } = await sb
    .from('cmas')
    .select(CMA_ADMIN_REVIEW_COLUMNS)
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  if (error) {
    console.error('[getCmaAdminReviewRowBySlug]', error.message)
    throw new Error(`getCmaAdminReviewRowBySlug failed: ${error.message}`)
  }
  return (data ?? null) as CmaAdminRow | null
}

/** Tiny existence + status read. Used so a wrong slug 404s instead of hanging. */
export async function getCmaServeHead(slug: string): Promise<CmaServeHead | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb
    .from('cmas')
    .select('html_path, status, broker_slug')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  if (error) {
    console.error('[getCmaServeHead]', error.message)
    throw new Error(`getCmaServeHead failed: ${error.message}`)
  }
  return (data ?? null) as CmaServeHead | null
}

export async function getCmaStoredHtmlBySlug(slug: string): Promise<string | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb
    .from('cmas')
    .select('html_content')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  if (error) {
    console.error('[getCmaStoredHtmlBySlug]', error.message)
    throw new Error(`getCmaStoredHtmlBySlug failed: ${error.message}`)
  }
  const html = (data as { html_content?: string | null } | null)?.html_content
  return typeof html === 'string' && html.length > 0 ? html : null
}

export async function getCmaRenderSourceBySlug(slug: string): Promise<CmaRenderSource | null> {
  const sb = client()
  if (!sb) return null
  const { data, error } = await sb
    .from('cmas')
    .select('html_path, status, render_args, broker_slug, build_summary')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  if (error) {
    console.error('[getCmaRenderSourceBySlug]', error.message)
    throw new Error(`getCmaRenderSourceBySlug failed: ${error.message}`)
  }
  return (data ?? null) as CmaRenderSource | null
}

/** Combined blob read. Prefer getCmaServeHead + getCmaStoredHtmlBySlug on hot paths. */
export async function getCmaHtmlBySlug(slug: string): Promise<{
  html_content: string | null
  html_path: string | null
  status: string
  /** Persisted renderCmaHtml input — the immersive web view renders from it. */
  render_args: Record<string, unknown> | null
  broker_slug: string | null
  /** Used only to hydrate keep-reasons on an already-built draft. */
  build_summary: Record<string, unknown> | null
} | null> {
  const sb = client()
  if (!sb) return null
  const { data } = await sb
    .from('cmas')
    .select('html_content, html_path, status, render_args, broker_slug, build_summary')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  return (data ?? null) as {
    html_content: string | null
    html_path: string | null
    status: string
    render_args: Record<string, unknown> | null
    broker_slug: string | null
    build_summary: Record<string, unknown> | null
  } | null
}

/** Patch a cmas row by slug. With `onlyWhenStatus`, the update is guarded:
 *  it applies only while the row still holds that status, and reports
 *  ok:false if the row moved on (e.g. a draft finalized mid-flight) — the
 *  compare-and-patch the intake merge path needs so a contact refresh can
 *  never land on a protected document. */
export async function updateCmaRowFieldsBySlug(
  slug: string,
  updates: Record<string, unknown>,
  options?: { onlyWhenStatus?: string },
): Promise<{ ok: boolean; error?: string }> {
  const sb = client()
  if (!sb) return { ok: false, error: 'Supabase not configured' }
  let q = sb.from('cmas').update(updates).eq('slug', slug.trim().toLowerCase())
  if (options?.onlyWhenStatus) q = q.eq('status', options.onlyWhenStatus)
  const { data, error } = await q.select('id')
  if (error) return { ok: false, error: error.message }
  if (options?.onlyWhenStatus && (data ?? []).length === 0) {
    return { ok: false, error: `row is no longer status '${options.onlyWhenStatus}'` }
  }
  return { ok: true }
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

/**
 * Identity + registration state for the /cma/[slug] access gate (Matt
 * 2026-08-05: only the lead the CMA was built for may view the web page,
 * behind registration). Returns the emails that may claim the doc and the
 * per-person registration marker the gate reads.
 */
export async function getCmaAccessIdentity(slug: string): Promise<{
  personId: number | null
  clientEmail: string | null
  clientName: string | null
  subjectAddress: string | null
  personEmails: string[]
  claimedBy: string | null
  consentRecorded: boolean
} | null> {
  const sb = client()
  if (!sb) return null
  const { data: row } = await sb
    .from('cmas')
    .select('person_id, client_email, client_name, subject_address')
    .eq('slug', slug.trim().toLowerCase())
    .maybeSingle()
  if (!row) return null
  const personId = (row.person_id as number | null) ?? null
  let personEmails: string[] = []
  let claimedBy: string | null = null
  let consentRecorded = false
  if (personId) {
    const { data: person } = await sb
      .from('crm_people')
      .select('emails, custom')
      .eq('id', personId)
      .maybeSingle()
    const emails = (person?.emails as Array<{ value?: string }> | null) ?? []
    personEmails = emails.map((e) => String(e?.value ?? '').trim().toLowerCase()).filter(Boolean)
    const custom = (person?.custom as Record<string, unknown> | null) ?? {}
    claimedBy = typeof custom.cmaClaimedBy === 'string' ? custom.cmaClaimedBy : null
    consentRecorded = Boolean(custom.cmaConsent)
  }
  return {
    personId,
    clientEmail: ((row.client_email as string | null) ?? '').trim().toLowerCase() || null,
    clientName: (row.client_name as string | null) ?? null,
    subjectAddress: (row.subject_address as string | null) ?? null,
    personEmails,
    claimedBy,
    consentRecorded,
  }
}
