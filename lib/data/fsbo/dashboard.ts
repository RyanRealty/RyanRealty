import 'server-only'

/**
 * FSBO Dashboard — one row per detected FSBO with the pipeline state:
 * skip-trace → CMA prepared → intro SMS / CMA email sent → engagement
 * (email opens/clicks, SMS link taps, document views). Mirrors the Expireds
 * Dashboard (lib/data/expired/dashboard.ts); the engagement plumbing is
 * identical because FSBO CMAs ride the same cmas + tracked-send rails.
 */

import { createServiceClient } from '@/lib/supabase/service'
import { slugifyAddress } from '@/lib/cma/address-slug'

export interface FsboDashboardRow {
  fsbo_url: string
  fsbo_source: string | null
  street_address: string | null
  city: string | null
  full_address: string | null
  list_price: number | null
  days_listed: number | null
  detected_at: string | null
  status: string | null
  owner_name: string | null
  contact_phone: string | null
  contact_email: string | null
  hard_stop: boolean
  crm_person_id: number | null
  cma_slug: string | null
  cma_status: string | null
  cma_needs_review: boolean
  cma_delivered_at: string | null
  cma_recommended: number | null
  sms_sent_at: string | null
  email_opens: number
  email_clicks: number
  sms_clicks: number
  doc_views: number
  last_engagement_at: string | null
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

export async function listFsboDashboardRows(): Promise<FsboDashboardRow[]> {
  const sb = createServiceClient()

  const { data: fsbos, error } = await sb
    .from('fsbo_listings')
    .select(
      'fsbo_url, fsbo_source, street_address, city, full_address, list_price, days_listed, detected_at, status, owner_name, contact_phone, contact_email, enrichment_notes, fub_person_id, outreach_crm_person_id, outreach_sms_sent_at',
    )
    .order('detected_at', { ascending: false, nullsFirst: false })
  if (error || !fsbos) {
    if (error) console.error('[listFsboDashboardRows]', error.message)
    return []
  }

  const slugByUrl = new Map<string, string>()
  for (const f of fsbos) {
    if (f.street_address) slugByUrl.set(String(f.fsbo_url), slugifyAddress(String(f.street_address)))
  }
  const slugs = [...new Set(slugByUrl.values())]
  const pids = [
    ...new Set(
      fsbos
        .map((f) => (f.outreach_crm_person_id as number | null) ?? (f.fub_person_id as number | null))
        .filter((v): v is number => v != null),
    ),
  ]

  // CMA docs by slug.
  const cmaBySlug = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < slugs.length; i += 100) {
    const { data } = await sb
      .from('cmas')
      .select('slug, doc_type, status, delivered_at, recommended_list, build_summary')
      .in('slug', slugs.slice(i, i + 100))
    for (const c of data ?? []) cmaBySlug.set(String(c.slug), c)
  }

  // Email opens/clicks by email_key.
  const emailAgg = new Map<string, { opens: number; clicks: number; last: string | null }>()
  const emailKeys = slugs.map((s) => `cma:${s}`)
  for (let i = 0; i < emailKeys.length; i += 100) {
    const { data } = await sb
      .from('email_events')
      .select('email_key, event, occurred_at')
      .in('email_key', emailKeys.slice(i, i + 100))
      .in('event', ['open', 'click'])
    for (const ev of data ?? []) {
      const slug = String(ev.email_key).slice(4)
      const agg = emailAgg.get(slug) ?? { opens: 0, clicks: 0, last: null }
      if (ev.event === 'open') agg.opens++
      else agg.clicks++
      const at = ev.occurred_at as string | null
      if (at && (!agg.last || at > agg.last)) agg.last = at
      emailAgg.set(slug, agg)
    }
  }

  // SMS link taps per person.
  const smsClicksByPid = new Map<number, { count: number; last: string | null }>()
  for (let i = 0; i < pids.length; i += 100) {
    const { data } = await sb
      .from('crm_timeline')
      .select('person_id, kind, ts')
      .in('person_id', pids.slice(i, i + 100))
      .eq('kind', 'sms_click')
    for (const t of data ?? []) {
      const pid = Number(t.person_id)
      const agg = smsClicksByPid.get(pid) ?? { count: 0, last: null }
      agg.count++
      const at = t.ts as string | null
      if (at && (!agg.last || at > agg.last)) agg.last = at
      smsClicksByPid.set(pid, agg)
    }
  }

  // Document views by slug.
  const viewsBySlug = new Map<string, { count: number; last: string | null }>()
  {
    const { data } = await sb
      .from('visitor_events')
      .select('page_url, event_at')
      .eq('page_category', 'client-document')
      .eq('event_type', 'page_view')
      .like('page_url', '%/cma/%')
      .order('event_at', { ascending: false })
      .limit(5000)
    for (const v of data ?? []) {
      const m = String(v.page_url ?? '').match(/\/cma\/([a-z0-9-]+)/)
      if (!m) continue
      const slug = m[1]!
      const agg = viewsBySlug.get(slug) ?? { count: 0, last: null }
      agg.count++
      const at = v.event_at as string | null
      if (at && (!agg.last || at > agg.last)) agg.last = at
      viewsBySlug.set(slug, agg)
    }
  }

  return fsbos.map((f) => {
    const slug = slugByUrl.get(String(f.fsbo_url)) ?? null
    const cma = slug ? cmaBySlug.get(slug) : undefined
    const pid = (f.outreach_crm_person_id as number | null) ?? (f.fub_person_id as number | null)
    const em = slug ? emailAgg.get(slug) : undefined
    const sms = pid != null ? smsClicksByPid.get(pid) : undefined
    const views = slug ? viewsBySlug.get(slug) : undefined
    const bs = (cma?.build_summary ?? {}) as Record<string, unknown>
    const lastCandidates = [em?.last ?? null, sms?.last ?? null, views?.last ?? null].filter((v): v is string => !!v)
    return {
      fsbo_url: String(f.fsbo_url),
      fsbo_source: (f.fsbo_source as string | null) ?? null,
      street_address: f.street_address,
      city: f.city,
      full_address: f.full_address,
      list_price: num(f.list_price),
      days_listed: num(f.days_listed),
      detected_at: (f.detected_at as string | null) ?? null,
      status: (f.status as string | null) ?? null,
      owner_name: f.owner_name,
      contact_phone: f.contact_phone,
      contact_email: f.contact_email,
      hard_stop: /HARD STOP|LITIGATOR/i.test(String(f.enrichment_notes ?? '')),
      crm_person_id: pid,
      cma_slug: cma ? slug : null,
      cma_status: (cma?.status as string | null) ?? null,
      cma_needs_review: String(bs.needs_review ?? '') === 'true' || bs.needs_review === true,
      cma_delivered_at: (cma?.delivered_at as string | null) ?? null,
      cma_recommended: num(cma?.recommended_list),
      sms_sent_at: (f.outreach_sms_sent_at as string | null) ?? null,
      email_opens: em?.opens ?? 0,
      email_clicks: em?.clicks ?? 0,
      sms_clicks: sms?.count ?? 0,
      doc_views: views?.count ?? 0,
      last_engagement_at: lastCandidates.length ? lastCandidates.sort().at(-1)! : null,
    }
  })
}
