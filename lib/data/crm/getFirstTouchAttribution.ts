/**
 * getFirstTouchAttribution — recover a contact's ORIGINAL first-touch UTM
 * (CONTACT360 Phase 0.6).
 *
 * Native leads are frequently created with no UTM source — the lead-create
 * path drops the original campaign attribution. But the visitor's EARLIEST
 * session usually still carries it: the first `visitor_sessions` row stamped
 * for that person holds the utm_source / utm_medium / utm_campaign and the
 * landing_page from the very first visit. This reader walks the session
 * history for an identity and returns that first-touch attribution.
 *
 * The identity shape is resolvePersonIdentity-compatible: pass any of the
 * person's normalized emails, their stitched session ids, the legacy FUB id,
 * and/or an rr_vid. We match a `visitor_sessions` row to the person via ANY of
 * the four FUB-independent keys the snapshot exposes on that table:
 *
 *   - session_id        IN (identity.sessionIds)   — stitched sessions
 *   - fub_person_id     =  identity.fubPersonId     — FUB-identified sessions
 *   - rr_vid            =  identity.rrVid           — the anonymous visitor id
 *   - identified_email  IN (identity.emails)        — email-identified sessions
 *
 * FLAGGED visitor_sessions columns used (verified against
 * docs/DATABASE_SCHEMA_SNAPSHOT.md, the `visitor_sessions` table):
 *   - first_seen_at   timestamptz NOT NULL — the earliest-visit ordering key
 *   - utm_source / utm_medium / utm_campaign  text NULL — the attribution
 *   - landing_page    text NULL — the first URL the visitor hit
 *   - session_id      text NOT NULL, fub_person_id int NULL, rr_vid text NULL,
 *     identified_email text NULL — the four identity match keys
 * (the snapshot also carries utm_content / utm_term / referrer, not part of
 * first-touch attribution here.)
 *
 * DAL boundary (G1): the raw .from() read lives here, inside lib/data/.
 */
import { createServiceClient } from '@/lib/supabase/service'

/** A first-touch attribution result recovered from session history. */
export type FirstTouchAttribution = {
  source: string | null
  medium: string | null
  campaign: string | null
  landingUrl: string | null
  firstSeenAt: string | null
}

/** resolvePersonIdentity-shaped inputs the reader keys off. */
export type FirstTouchIdentity = {
  emails?: string[]
  sessionIds?: string[]
  fubPersonId?: number | null
  rrVid?: string | null
}

/**
 * The minimal session row shape the picker reasons over. Mirrors the
 * `visitor_sessions` columns we select (snake_case from PostgREST).
 */
export type FirstTouchSessionRow = {
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
  landing_page: string | null
  first_seen_at: string | null
}

/** True when a utm_source string carries a real (non-empty) value. */
function hasUtmSource(value: string | null | undefined): boolean {
  return String(value ?? '').trim().length > 0
}

/**
 * Pure helper (unit-tested directly): given a set of session rows, pick the
 * first-touch attribution.
 *
 * Rule:
 *   1. Among rows that HAVE a non-empty utm_source, return the EARLIEST one
 *      (by first_seen_at ascending) — the original campaign that brought the
 *      visitor in beats any later organic/returning visit.
 *   2. If NO row carries a utm_source, fall back to the earliest row overall
 *      and surface just its landing_page (no source/medium/campaign).
 *   3. Empty input => null.
 *
 * Sorting is done here (not relied on from the query) so the picker is total
 * and deterministic regardless of input order — null first_seen_at sorts last.
 */
export function pickFirstTouch(
  sessions: ReadonlyArray<FirstTouchSessionRow>,
): FirstTouchAttribution | null {
  if (!sessions || sessions.length === 0) return null

  // Earliest-first. A missing first_seen_at can never win the "earliest" slot.
  const sorted = [...sessions].sort((a, b) => {
    const ta = a.first_seen_at ?? ''
    const tb = b.first_seen_at ?? ''
    if (ta === tb) return 0
    if (ta === '') return 1
    if (tb === '') return -1
    return ta < tb ? -1 : 1
  })

  // 1. Earliest row that actually has a utm_source.
  const withUtm = sorted.find((s) => hasUtmSource(s.utm_source))
  if (withUtm) {
    return {
      source: String(withUtm.utm_source).trim(),
      medium: withUtm.utm_medium ?? null,
      campaign: withUtm.utm_campaign ?? null,
      landingUrl: withUtm.landing_page ?? null,
      firstSeenAt: withUtm.first_seen_at ?? null,
    }
  }

  // 2. No utm anywhere — fall back to the earliest row's landing url.
  const earliest = sorted[0]
  return {
    source: null,
    medium: null,
    campaign: null,
    landingUrl: earliest.landing_page ?? null,
    firstSeenAt: earliest.first_seen_at ?? null,
  }
}

/**
 * Recover the first-touch UTM attribution for a contact from their
 * `visitor_sessions` history. Returns null when the identity carries no usable
 * key or no matching session exists.
 */
export async function getFirstTouchAttribution(
  identity: FirstTouchIdentity,
): Promise<FirstTouchAttribution | null> {
  const emails = (identity.emails ?? []).map((e) => String(e ?? '').trim().toLowerCase()).filter(Boolean)
  const sessionIds = (identity.sessionIds ?? []).map((s) => String(s ?? '').trim()).filter(Boolean)
  const fubPersonId =
    identity.fubPersonId === null || identity.fubPersonId === undefined || !Number.isFinite(identity.fubPersonId)
      ? null
      : Number(identity.fubPersonId)
  const rrVid = identity.rrVid ? String(identity.rrVid).trim() || null : null

  // Build the FUB-independent OR-filter across the four identity keys. PostgREST
  // in.(...) values are quoted to stay literal-safe for emails/ids.
  const orFilters: string[] = []
  if (sessionIds.length > 0) {
    orFilters.push(`session_id.in.(${sessionIds.map((s) => `"${s}"`).join(',')})`)
  }
  if (fubPersonId !== null) {
    orFilters.push(`fub_person_id.eq.${fubPersonId}`)
  }
  if (rrVid !== null) {
    orFilters.push(`rr_vid.eq."${rrVid}"`)
  }
  if (emails.length > 0) {
    orFilters.push(`identified_email.in.(${emails.map((e) => `"${e}"`).join(',')})`)
  }
  if (orFilters.length === 0) return null

  const sb = createServiceClient()
  const { data, error } = await sb
    .from('visitor_sessions')
    .select('utm_source,utm_medium,utm_campaign,landing_page,first_seen_at')
    .or(orFilters.join(','))
    .order('first_seen_at', { ascending: true })
    .limit(500)

  if (error || !data || data.length === 0) return null

  const rows: FirstTouchSessionRow[] = data.map((r) => ({
    utm_source: (r.utm_source as string | null) ?? null,
    utm_medium: (r.utm_medium as string | null) ?? null,
    utm_campaign: (r.utm_campaign as string | null) ?? null,
    landing_page: (r.landing_page as string | null) ?? null,
    first_seen_at: (r.first_seen_at as string | null) ?? null,
  }))

  return pickFirstTouch(rows)
}
