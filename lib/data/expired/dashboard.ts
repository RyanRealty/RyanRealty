import 'server-only'

/**
 * Expireds Dashboard — one row per expired listing with the full pipeline
 * state: skip-trace → audit built → sent (SMS + email) → engagement (email
 * opens/clicks, SMS link clicks, audit-document views).
 *
 * Engagement sources (all batched — no per-row queries):
 *  - email_events            opens/clicks keyed by email_key `cma:<slug>`
 *  - crm_timeline            sms_out / sms_click / email_out keyed by person_id
 *  - visitor_events          audit-doc views keyed by page_url `/cma/<slug>`
 *  - cmas                    audit status + delivered_at keyed by slug
 */

import { createServiceClient } from '@/lib/supabase/service'
import { slugifyAddress } from '@/lib/cma/address-slug'

export interface ExpiredDashboardRow {
  listing_key: string
  street_address: string | null
  city: string | null
  full_address: string
  list_price: number | null
  expired_at: string | null
  standard_status: string | null
  owner_name: string | null
  contact_phone: string | null
  contact_email: string | null
  hard_stop: boolean
  relisted: boolean
  crm_person_id: number | null
  // Audit document.
  audit_slug: string | null
  audit_doc_type: string | null
  audit_status: string | null
  audit_needs_review: boolean
  audit_delivered_at: string | null
  audit_recommended: number | null
  // Sends.
  sms_sent_at: string | null
  email_sent_at: string | null
  // Engagement.
  email_opens: number
  email_clicks: number
  sms_clicks: number
  doc_views: number
  last_engagement_at: string | null
}

const num = (v: unknown): number | null => (v == null ? null : Number(v))

export async function listExpiredDashboardRows(): Promise<ExpiredDashboardRow[]> {
  const sb = createServiceClient()

  // 1. Every expired listing.
  const { data: expireds, error } = await sb
    .from('expired_listings')
    .select(
      'listing_key, street_address, city, full_address, list_price, expired_at, standard_status, owner_name, contact_phone, contact_email, enrichment_notes, status_change_timestamp, outreach_sms_sent_at, outreach_crm_person_id, fub_person_id',
    )
    .order('expired_at', { ascending: false, nullsFirst: false })
  if (error || !expireds) {
    if (error) console.error('[listExpiredDashboardRows]', error.message)
    return []
  }

  const slugByKey = new Map<string, string>()
  for (const e of expireds) {
    if (e.street_address) slugByKey.set(e.listing_key, slugifyAddress(String(e.street_address)))
  }
  const slugs = [...new Set(slugByKey.values())]
  const pids = [
    ...new Set(
      expireds
        .map((e) => (e.outreach_crm_person_id as number | null) ?? (e.fub_person_id as number | null))
        .filter((v): v is number => v != null),
    ),
  ]

  // 2. Audit documents (cmas by slug).
  const cmaBySlug = new Map<string, Record<string, unknown>>()
  for (let i = 0; i < slugs.length; i += 100) {
    const { data } = await sb
      .from('cmas')
      .select('slug, doc_type, status, delivered_at, recommended_list, client_email, build_summary')
      .in('slug', slugs.slice(i, i + 100))
    for (const c of data ?? []) cmaBySlug.set(String(c.slug), c)
  }

  // 3. Email opens/clicks keyed by email_key `cma:<slug>`.
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

  // 4. SMS link clicks + email_out per person (crm_timeline).
  const smsClicksByPid = new Map<number, { count: number; last: string | null }>()
  const emailOutByPid = new Map<number, string>()
  for (let i = 0; i < pids.length; i += 100) {
    const { data } = await sb
      .from('crm_timeline')
      .select('person_id, kind, ts')
      .in('person_id', pids.slice(i, i + 100))
      .in('kind', ['sms_click', 'email_out'])
    for (const t of data ?? []) {
      const pid = Number(t.person_id)
      if (t.kind === 'sms_click') {
        const agg = smsClicksByPid.get(pid) ?? { count: 0, last: null }
        agg.count++
        const at = t.ts as string | null
        if (at && (!agg.last || at > agg.last)) agg.last = at
        smsClicksByPid.set(pid, agg)
      } else {
        const at = t.ts as string
        const prev = emailOutByPid.get(pid)
        if (!prev || at > prev) emailOutByPid.set(pid, at)
      }
    }
  }

  // 5. Audit-document views (visitor_events, slug-keyed by page_url).
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

  // 6. Assemble.
  return expireds.map((e) => {
    const slug = slugByKey.get(e.listing_key) ?? null
    const cma = slug ? cmaBySlug.get(slug) : undefined
    const pid = (e.outreach_crm_person_id as number | null) ?? (e.fub_person_id as number | null)
    const em = slug ? emailAgg.get(slug) : undefined
    const sms = pid != null ? smsClicksByPid.get(pid) : undefined
    const views = slug ? viewsBySlug.get(slug) : undefined
    const bs = (cma?.build_summary ?? {}) as Record<string, unknown>
    const lastCandidates = [em?.last ?? null, sms?.last ?? null, views?.last ?? null].filter(
      (v): v is string => !!v,
    )
    return {
      listing_key: e.listing_key,
      street_address: e.street_address,
      city: e.city,
      full_address: e.full_address ?? `${e.street_address ?? ''}, ${e.city ?? ''}`,
      list_price: num(e.list_price),
      expired_at: e.expired_at ?? e.status_change_timestamp ?? null,
      standard_status: e.standard_status,
      owner_name: e.owner_name,
      contact_phone: e.contact_phone,
      contact_email: e.contact_email,
      hard_stop: /HARD STOP|LITIGATOR/i.test(String(e.enrichment_notes ?? '')),
      relisted: false, // per-row re-list checks are done at send time (guarded action)
      crm_person_id: pid,
      audit_slug: cma ? slug : null,
      audit_doc_type: (cma?.doc_type as string | null) ?? null,
      audit_status: (cma?.status as string | null) ?? null,
      audit_needs_review: String(bs.needs_review ?? '') === 'true' || bs.needs_review === true,
      audit_delivered_at: (cma?.delivered_at as string | null) ?? null,
      audit_recommended: num(cma?.recommended_list),
      sms_sent_at: (e.outreach_sms_sent_at as string | null) ?? null,
      email_sent_at: (cma?.delivered_at as string | null) ?? (pid != null ? emailOutByPid.get(pid) ?? null : null),
      email_opens: em?.opens ?? 0,
      email_clicks: em?.clicks ?? 0,
      sms_clicks: sms?.count ?? 0,
      doc_views: views?.count ?? 0,
      last_engagement_at: lastCandidates.length ? lastCandidates.sort().at(-1)! : null,
    }
  })
}
