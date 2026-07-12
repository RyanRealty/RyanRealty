import 'server-only'

/**
 * Expired-listing outreach queue — DAL for the manual approve-and-send surface
 * at /admin/expired-outreach (Matt directive 2026-07-11: nothing sends without
 * a broker's click).
 *
 * Sendable = has a non-DNC phone, no hard-stop (litigator/TCPA/deceased per
 * skip-trace), NOT re-listed (a same-address newer on-market listing excludes
 * the row — never solicit another broker's active listing), and not already
 * sent. The re-list check ALSO re-runs at send time in the action; this read
 * is the queue view.
 */

import { createServiceClient } from '@/lib/supabase/service'

export interface ExpiredOutreachRow {
  listing_key: string
  street_address: string
  city: string | null
  postal_code: string | null
  owner_name: string | null
  contact_phone: string | null
  contact_email: string | null
  standard_status: string | null
  expired_at: string | null
  list_price: number | null
  hard_stop: boolean
  relisted: boolean
  outreach_sms_sent_at: string | null
  outreach_crm_person_id: number | null
  cma_slug: string | null
  cma_status: string | null
  cma_needs_review: boolean
  cma_recommended: number | null
}

/** One queue view: sendable + sent + excluded, classified server-side. */
export async function listExpiredOutreachQueue(): Promise<ExpiredOutreachRow[]> {
  const sb = createServiceClient()
  // Single round-trip via SQL RPC-less raw select is not possible for the
  // lateral join through PostgREST, so this runs three bounded reads and
  // composes in memory (135 rows total — far below any pagination limit).
  const { data: expired, error } = await sb
    .from('expired_listings')
    .select(
      'listing_key, street_address, city, postal_code, owner_name, contact_phone, contact_email, standard_status, expired_at, list_price, enrichment_notes, status_change_timestamp, outreach_sms_sent_at, outreach_crm_person_id',
    )
    .not('street_address', 'is', null)
    .order('expired_at', { ascending: false })
  if (error) {
    console.error('[listExpiredOutreachQueue]', error.message)
    return []
  }
  const rows = expired ?? []

  // Re-list check: pull only on-market rows matching our street numbers.
  const numbers = [...new Set(rows.map((r) => String(r.street_address).split(' ')[0]).filter(Boolean))]
  const { data: onMarket } = await sb
    .from('listings')
    .select('StreetNumber, StreetName, City, status_change_timestamp')
    .in('StandardStatus', ['Active', 'Pending', 'Coming Soon'])
    .in('StreetNumber', numbers)
  const relisted = (r: { street_address: string; city: string | null; status_change_timestamp: string | null }) => {
    const num = String(r.street_address).split(' ')[0]
    const namePrefix = String(r.street_address).slice(num.length + 1).split(' ')[0]?.toUpperCase() ?? ''
    return (onMarket ?? []).some(
      (l) =>
        String(l.StreetNumber) === num &&
        String(l.StreetName ?? '')
          .toUpperCase()
          .startsWith(namePrefix) &&
        String(l.City ?? '').toUpperCase() === String(r.city ?? '').toUpperCase() &&
        (r.status_change_timestamp == null || String(l.status_change_timestamp ?? '') > r.status_change_timestamp),
    )
  }

  // CMA join by the shared address slug.
  const { data: cmas } = await sb.from('cmas').select('slug, status, recommended_list, build_summary')

  const { slugifyAddress } = await import('@/lib/cma/address-slug')
  return rows.map((r) => {
    const slug = slugifyAddress(String(r.street_address))
    const cma = (cmas ?? []).find((c) => c.slug === slug) ?? null
    const summary = (cma?.build_summary ?? null) as { needs_review?: boolean } | null
    return {
      listing_key: r.listing_key,
      street_address: r.street_address,
      city: r.city,
      postal_code: r.postal_code,
      owner_name: r.owner_name,
      contact_phone: r.contact_phone,
      contact_email: r.contact_email,
      standard_status: r.standard_status,
      expired_at: r.expired_at,
      list_price: r.list_price != null ? Number(r.list_price) : null,
      hard_stop: /HARD STOP|LITIGATOR/i.test(String(r.enrichment_notes ?? '')),
      relisted: relisted(r),
      outreach_sms_sent_at: r.outreach_sms_sent_at,
      outreach_crm_person_id: r.outreach_crm_person_id,
      cma_slug: cma ? slug : null,
      cma_status: (cma?.status as string | null) ?? null,
      cma_needs_review: summary?.needs_review === true,
      cma_recommended: cma?.recommended_list != null ? Number(cma.recommended_list) : null,
    }
  })
}

/** One row by key, with the same classification (send-time re-checks). */
export async function getExpiredOutreachRow(listingKey: string): Promise<ExpiredOutreachRow | null> {
  const all = await listExpiredOutreachQueue()
  return all.find((r) => r.listing_key === listingKey) ?? null
}

export interface ExpiredListingDetail {
  listing_key: string
  full_address: string
  street_address: string | null
  city: string | null
  state: string | null
  postal_code: string | null
  subdivision: string | null
  property_type: string | null
  bedrooms: number | null
  bathrooms: number | null
  sqft: number | null
  standard_status: string | null
  list_price: number | null
  original_list_price: number | null
  days_on_market: number | null
  cumulative_days_on_market: number | null
  list_number: string | null
  expired_at: string | null
  status_change_timestamp: string | null
  detected_at: string | null
  list_agent_name: string | null
  list_agent_email: string | null
  list_office_name: string | null
  owner_name: string | null
  contact_phone: string | null
  contact_email: string | null
  contact_source: string | null
  owner_lookup_status: string | null
  enrichment_notes: string | null
  alert_sent_at: string | null
  outreach_sms_sent_at: string | null
  /** Resolved CRM person for this owner (send-created, else detection-created). */
  crm_person_id: number | null
  hard_stop: boolean
  relisted: boolean
  cma_slug: string | null
}

/** Full expired-listing record for the admin detail page. */
export async function getExpiredListingDetail(listingKey: string): Promise<ExpiredListingDetail | null> {
  const sb = createServiceClient()
  const { data: r, error } = await sb
    .from('expired_listings')
    .select(
      'listing_key, full_address, street_address, city, state, postal_code, subdivision, property_type, bedrooms, bathrooms, sqft, standard_status, list_price, original_list_price, days_on_market, cumulative_days_on_market, list_number, expired_at, status_change_timestamp, detected_at, list_agent_name, list_agent_email, list_office_name, owner_name, contact_phone, contact_email, contact_source, owner_lookup_status, enrichment_notes, alert_sent_at, outreach_sms_sent_at, outreach_crm_person_id, fub_person_id',
    )
    .eq('listing_key', listingKey.trim())
    .maybeSingle()
  if (error || !r) {
    if (error) console.error('[getExpiredListingDetail]', error.message)
    return null
  }
  const { slugifyAddress } = await import('@/lib/cma/address-slug')
  const slug = r.street_address ? slugifyAddress(String(r.street_address)) : null
  const { data: cma } = slug
    ? await sb.from('cmas').select('slug').eq('slug', slug).maybeSingle()
    : { data: null }
  // Re-list check for this one address.
  let relisted = false
  if (r.street_address) {
    const num = String(r.street_address).split(' ')[0]
    const namePrefix = String(r.street_address).slice(num.length + 1).split(' ')[0]?.toUpperCase() ?? ''
    const { data: onMarket } = await sb
      .from('listings')
      .select('StreetName, City, status_change_timestamp')
      .eq('StreetNumber', num)
      .in('StandardStatus', ['Active', 'Pending', 'Coming Soon'])
    relisted = (onMarket ?? []).some(
      (l) =>
        String(l.StreetName ?? '').toUpperCase().startsWith(namePrefix) &&
        String(l.City ?? '').toUpperCase() === String(r.city ?? '').toUpperCase() &&
        (r.status_change_timestamp == null || String(l.status_change_timestamp ?? '') > r.status_change_timestamp),
    )
  }
  return {
    listing_key: r.listing_key,
    full_address: r.full_address,
    street_address: r.street_address,
    city: r.city,
    state: r.state,
    postal_code: r.postal_code,
    subdivision: r.subdivision,
    property_type: r.property_type,
    bedrooms: r.bedrooms,
    bathrooms: r.bathrooms != null ? Number(r.bathrooms) : null,
    sqft: r.sqft,
    standard_status: r.standard_status,
    list_price: r.list_price != null ? Number(r.list_price) : null,
    original_list_price: r.original_list_price != null ? Number(r.original_list_price) : null,
    days_on_market: r.days_on_market,
    cumulative_days_on_market: r.cumulative_days_on_market,
    list_number: r.list_number,
    expired_at: r.expired_at,
    status_change_timestamp: r.status_change_timestamp,
    detected_at: r.detected_at,
    list_agent_name: r.list_agent_name,
    list_agent_email: r.list_agent_email,
    list_office_name: r.list_office_name,
    owner_name: r.owner_name,
    contact_phone: r.contact_phone,
    contact_email: r.contact_email,
    contact_source: r.contact_source,
    owner_lookup_status: r.owner_lookup_status,
    enrichment_notes: r.enrichment_notes,
    alert_sent_at: r.alert_sent_at,
    outreach_sms_sent_at: r.outreach_sms_sent_at,
    crm_person_id: (r.outreach_crm_person_id as number | null) ?? (r.fub_person_id as number | null) ?? null,
    hard_stop: /HARD STOP|LITIGATOR/i.test(String(r.enrichment_notes ?? '')),
    relisted,
    cma_slug: cma ? slug : null,
  }
}

export interface CmaExpiredLink {
  listingKey: string
  crmPersonId: number | null
  ownerName: string | null
  /** Their last list price — the price that failed to sell. */
  listPrice: number | null
  standardStatus: string | null
}

/** Per-CMA links for the admin CMA list: which expired listing + CRM person a
 *  CMA maps to (by address slug), plus the price they listed at (for the
 *  our-price-vs-their-price comparison). Slug-keyed map. */
export async function getCmaExpiredLinks(): Promise<Record<string, CmaExpiredLink>> {
  const sb = createServiceClient()
  const { data, error } = await sb
    .from('expired_listings')
    .select('listing_key, street_address, owner_name, list_price, standard_status, outreach_crm_person_id, fub_person_id')
    .not('street_address', 'is', null)
  if (error) {
    console.error('[getCmaExpiredLinks]', error.message)
    return {}
  }
  const { slugifyAddress } = await import('@/lib/cma/address-slug')
  const map: Record<string, CmaExpiredLink> = {}
  for (const r of data ?? []) {
    const slug = slugifyAddress(String(r.street_address))
    // First writer wins; expired rows are unique per address in practice.
    if (!map[slug]) {
      map[slug] = {
        listingKey: r.listing_key,
        crmPersonId: (r.outreach_crm_person_id as number | null) ?? (r.fub_person_id as number | null) ?? null,
        ownerName: r.owner_name,
        listPrice: r.list_price != null ? Number(r.list_price) : null,
        standardStatus: r.standard_status,
      }
    }
  }
  return map
}

/** Stamp a completed intro send. */
export async function markExpiredOutreachSent(params: {
  listingKey: string
  crmPersonId: number
  smsSid: string
}): Promise<{ ok: boolean; error?: string }> {
  const sb = createServiceClient()
  const { error } = await sb
    .from('expired_listings')
    .update({
      outreach_sms_sent_at: new Date().toISOString(),
      outreach_crm_person_id: params.crmPersonId,
      outreach_sms_sid: params.smsSid,
      updated_at: new Date().toISOString(),
    })
    .eq('listing_key', params.listingKey)
  if (error) return { ok: false, error: error.message }
  return { ok: true }
}
