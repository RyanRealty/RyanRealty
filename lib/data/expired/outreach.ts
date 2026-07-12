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
