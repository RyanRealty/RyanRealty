/**
 * getViewedListingsForLead — the homes a CRM lead is actually shopping.
 *
 * Joins the lead's behavioral trail (visitor_events.listing_mls, captured per
 * identified session) to the LIVE listing row (listing_tile_mv.listing_key) so
 * the broker sees each watched home with its CURRENT price + MLS status — not a
 * stale snapshot from whenever the page was viewed (§0 data-accuracy: prices and
 * statuses shown to a broker must be current). Distinct listings, most-recently
 * viewed first, capped.
 *
 * ── IDENTITY JOIN (native, 2026-07-21 — closes the legacy-fub-only gap) ──────
 * The old version keyed sessions on visitor_sessions.fub_person_id alone, so a
 * NATIVE lead (fub_legacy_id NULL) always resolved zero sessions and the panel
 * rendered empty. Sessions now resolve through the full native chain:
 *
 *   1. visitor_sessions.crm_person_id = crmPersonId — written by every identify
 *      path post-FUB-cutover (lib/visitor-backfill.ts:99 + :203 write
 *      crm_person_id and fub_person_id in lockstep with the native crm id).
 *   2. visitor_sessions.fub_person_id IN (crmPersonId, fubLegacyId) — lockstep
 *      rows written before readers migrated, plus true legacy FUB-import rows.
 *   3. visitor_identity_map rows matched by crm_person_id / fub_person_id /
 *      normalized email (writer: lib/visitor-backfill.ts:56-112
 *      stitchVisitorIdentity, called from app/auth/callback/route.ts:55 on
 *      every OAuth sign-in) → their session_id AND every session sharing the
 *      durable rr_vid (the first-party cookie set by middleware).
 *
 * DAL boundary: the raw .from() lives here, inside lib/data/ (G1).
 */
import { createServiceClient } from '@/lib/data/client'
import type { SupabaseClient } from '@supabase/supabase-js'

export type ViewedListing = {
  listingKey: string
  address: string
  city: string | null
  status: string | null
  photoUrl: string | null
  listPrice: number | null
  beds: number | null
  baths: number | null
  sqft: number | null
  addressSlug: string | null
  views: number
  saved: boolean
  lastViewedAt: string
  /**
   * Real consumer-store sources (public.likes / public.saved_listings) merged
   * in by buildHomesPanelUnion — distinct from the event-heuristic `saved`
   * flag. Optional so pre-union rows and legacy readers stay compatible.
   */
  consumerSources?: Array<'liked' | 'saved'>
}

export type LeadIdentityKeys = {
  crmPersonId: number
  fubLegacyId?: number | null
  /** Normalized (lowercased) emails — the FUB-independent identity key. */
  emails?: string[]
}

/**
 * Pure helper (unit-tested): build the PostgREST .or() filter that matches a
 * lead's visitor_sessions rows across BOTH id columns. Dedupes the lockstep
 * case (fubLegacyId === crmPersonId) so the filter stays minimal.
 */
export function buildSessionOrFilter(crmPersonId: number, fubLegacyId?: number | null): string {
  const parts = [`crm_person_id.eq.${crmPersonId}`, `fub_person_id.eq.${crmPersonId}`]
  if (fubLegacyId != null && fubLegacyId !== crmPersonId) {
    parts.push(`fub_person_id.eq.${fubLegacyId}`)
  }
  return parts.join(',')
}

/** Merge string lists, dedupe, drop falsy. Order-preserving. */
function unionStrings(...lists: Array<Iterable<string | null | undefined>>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const list of lists) {
    for (const v of list) {
      if (v && !seen.has(v)) {
        seen.add(v)
        out.push(v)
      }
    }
  }
  return out
}

/**
 * Resolve EVERY visitor session belonging to a CRM person via the native
 * identity chain (see file header). Shared by getViewedListingsForLead and
 * getContactBehaviorSummary so the two panels agree on whose trail this is.
 * Bounded reads; never throws (returns [] on any read failure).
 */
export async function resolveLeadSessionIds(
  sb: SupabaseClient,
  keys: LeadIdentityKeys,
): Promise<string[]> {
  const { crmPersonId, fubLegacyId, emails } = keys
  if (!Number.isFinite(crmPersonId) || crmPersonId <= 0) return []

  // 1+2. Sessions keyed directly on the person (native + lockstep + legacy).
  const { data: direct } = await sb
    .from('visitor_sessions')
    .select('session_id')
    .or(buildSessionOrFilter(crmPersonId, fubLegacyId))
    .limit(500)
  const directIds = (direct ?? []).map((s) => s.session_id as string)

  // 3. Identity-map rows for this person → session_id + durable rr_vid.
  const orFilters = [`crm_person_id.eq.${crmPersonId}`, `fub_person_id.eq.${crmPersonId}`]
  if (fubLegacyId != null && fubLegacyId !== crmPersonId) orFilters.push(`fub_person_id.eq.${fubLegacyId}`)
  const cleanEmails = (emails ?? []).map((e) => e.trim().toLowerCase()).filter(Boolean)
  if (cleanEmails.length > 0) {
    orFilters.push(`email.in.(${cleanEmails.map((e) => `"${e}"`).join(',')})`)
  }
  const { data: idmap } = await sb
    .from('visitor_identity_map')
    .select('session_id,rr_vid')
    .or(orFilters.join(','))
    .limit(500)
  const idmapSessions = (idmap ?? []).map((r) => r.session_id as string | null)
  const rrVids = unionStrings((idmap ?? []).map((r) => r.rr_vid as string | null))

  // 3b. Every session sharing one of the person's durable rr_vids (covers
  // anonymous browsing in the same browser before/after the identify moment).
  let vidSessions: string[] = []
  if (rrVids.length > 0) {
    const { data: byVid } = await sb
      .from('visitor_sessions')
      .select('session_id')
      .in('rr_vid', rrVids)
      .limit(500)
    vidSessions = (byVid ?? []).map((s) => s.session_id as string)
  }

  return unionStrings(directIds, idmapSessions, vidSessions)
}

export async function getViewedListingsForLead(keys: LeadIdentityKeys): Promise<ViewedListing[]> {
  const sb = createServiceClient()

  // Sessions belonging to this lead, resolved via the native identity chain.
  const sessionIds = await resolveLeadSessionIds(sb, keys)
  if (sessionIds.length === 0) return []

  // Listing-level events across those sessions.
  const { data: events } = await sb
    .from('visitor_events')
    .select('listing_mls,event_type,event_at,listing_street,listing_city,listing_price')
    .in('session_id', sessionIds)
    .not('listing_mls', 'is', null)
    .order('event_at', { ascending: false })
    .limit(400)
  if (!events || events.length === 0) return []

  // Roll up per MLS key: view count, saved flag, last seen, snapshot fallback.
  type Agg = { views: number; saved: boolean; lastViewedAt: string; street: string | null; city: string | null; price: number | null }
  const byKey = new Map<string, Agg>()
  for (const e of events) {
    const key = String(e.listing_mls)
    const a = byKey.get(key) ?? { views: 0, saved: false, lastViewedAt: e.event_at as string, street: (e.listing_street as string | null) ?? null, city: (e.listing_city as string | null) ?? null, price: e.listing_price === null ? null : Number(e.listing_price) }
    a.views += 1
    if (/sav|favorit/i.test(String(e.event_type))) a.saved = true
    if ((e.event_at as string) > a.lastViewedAt) a.lastViewedAt = e.event_at as string
    byKey.set(key, a)
  }
  const keysList = [...byKey.keys()]
  if (keysList.length === 0) return []

  // Live listing data for the watched keys.
  const { data: live } = await sb
    .from('listing_tile_mv')
    .select('listing_key,street_number,street_name,city,standard_status,photo_url,list_price,beds,baths,sqft,address_slug')
    .in('listing_key', keysList)
  const liveByKey = new Map((live ?? []).map((r) => [String(r.listing_key), r]))

  const out: ViewedListing[] = keysList.map((key) => {
    const agg = byKey.get(key)!
    const r = liveByKey.get(key)
    const address = r
      ? [r.street_number, r.street_name].filter(Boolean).join(' ')
      : agg.street ?? 'Listing'
    return {
      listingKey: key,
      address,
      city: (r?.city as string | null) ?? agg.city,
      status: (r?.standard_status as string | null) ?? null,
      photoUrl: (r?.photo_url as string | null) ?? null,
      listPrice: r ? (r.list_price === null ? null : Number(r.list_price)) : agg.price,
      beds: r ? (r.beds === null ? null : Number(r.beds)) : null,
      baths: r ? (r.baths === null ? null : Number(r.baths)) : null,
      sqft: r ? (r.sqft === null ? null : Number(r.sqft)) : null,
      addressSlug: (r?.address_slug as string | null) ?? null,
      views: agg.views,
      saved: agg.saved,
      lastViewedAt: agg.lastViewedAt,
    }
  })

  // Most-recently viewed first; cap.
  out.sort((a, b) => (a.lastViewedAt < b.lastViewedAt ? 1 : -1))
  return out.slice(0, 8)
}
