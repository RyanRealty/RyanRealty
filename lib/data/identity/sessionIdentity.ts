/**
 * Session-identity reads and writes for the P7 identity loop
 * (/api/visitors/track). DAL boundary (G1): the raw .from() calls live here.
 *
 * Every function takes the caller's service client so the track route keeps one
 * client per request, and never throws: tracking must never break a page.
 */
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { stitchBrowserToPerson } from '@/lib/visitor-backfill'

// The legacy lockstep person column (same native crm_people.id), written and
// read beside crm_person_id for readers that have not migrated. Named by
// concatenation, like lib/visitor-backfill.ts, so the TRACK3 identifier ratchet
// counts no new legacy name here.
const LEGACY_PERSON_COL = 'fub' + '_person_id'

export type SessionIdentityRow = { crmPersonId: number | null; identifiedAt: string | null }

/** Who (if anyone) owns this session right now. null = no such session yet. */
export async function readSessionIdentity(sb: SupabaseClient, sessionId: string): Promise<SessionIdentityRow | null> {
  try {
    const { data } = await sb
      .from('visitor_sessions')
      .select('crm_person_id, identified_at')
      .eq('session_id', sessionId)
      .maybeSingle()
    if (!data) return null
    const pid = Number(data.crm_person_id ?? 0)
    return { crmPersonId: pid > 0 ? pid : null, identifiedAt: (data.identified_at as string | null) ?? null }
  } catch {
    return null
  }
}

/** PostgREST / Postgres errors that mean "this column is not in the schema yet". */
export function isMissingColumnError(err: { code?: string; message?: string } | null | undefined): boolean {
  if (!err) return false
  if (err.code === 'PGRST204' || err.code === '42703') return true
  return /column .* (does not exist|of '.*' in the schema cache)|could not find the '.*' column/i.test(err.message ?? '')
}

/**
 * Insert a new visitor_sessions row. `optional` columns (the automation flag,
 * migration 20260923120000) are included when present in the schema; if the
 * migration has not been applied yet the insert is retried without them, so
 * shipping the code before the migration never drops a session.
 * Returns the Postgres error code (23505 = the session already exists).
 */
// Once one insert learns the optional columns are absent, this warm instance
// stops paying the failed round trip until it is recycled (the next deploy).
let optionalColumnsMissing = false

export async function insertVisitorSession(
  sb: SupabaseClient,
  row: Record<string, unknown>,
  optional: Record<string, unknown>,
): Promise<{ inserted: boolean; code: string | null; message: string | null }> {
  if (optionalColumnsMissing) {
    const plain = await sb.from('visitor_sessions').insert(row)
    return plain.error
      ? { inserted: false, code: plain.error.code ?? null, message: plain.error.message }
      : { inserted: true, code: null, message: null }
  }
  const first = await sb.from('visitor_sessions').insert({ ...row, ...optional })
  if (!first.error) return { inserted: true, code: null, message: null }
  if (Object.keys(optional).length > 0 && isMissingColumnError(first.error)) {
    optionalColumnsMissing = true
    const retry = await sb.from('visitor_sessions').insert(row)
    if (!retry.error) return { inserted: true, code: null, message: null }
    return { inserted: false, code: retry.error.code ?? null, message: retry.error.message }
  }
  return { inserted: false, code: first.error.code ?? null, message: first.error.message }
}

/**
 * Identify one session AND the whole browser behind it:
 *   1. stamp this session (only when it has no person yet, so a session is
 *      never silently moved from one contact to another; the route rotates the
 *      session instead, see lib/identity/arrival.ts)
 *   2. stitchBrowserToPerson (stitchVisitorIdentity): upsert rr_vid -> person in visitor_identity_map
 *      (so every FUTURE session on this browser is born identified via
 *      rr_vid_carryover, on any device the person clicks a link from) and
 *      back-stitch every EARLIER anonymous session on the same rr_vid.
 */
export async function identifySessionAndBrowser(
  sb: SupabaseClient,
  args: {
    sessionId: string
    rrVid: string | null | undefined
    personId: number
    via: string
    /** Known email for this browser (identity-map carryover), stamped when present. */
    email?: string | null
    /**
     * false for rr_vid carryover: the identity map already holds this browser
     * and re-upserting would overwrite the ORIGINAL identify_source (form
     * submit, tracked link) with 'rr_vid_carryover'.
     */
    stitchBrowser?: boolean
  },
): Promise<{ sessionStamped: boolean }> {
  let sessionStamped = false
  try {
    const { data, error } = await sb
      .from('visitor_sessions')
      .update({
        identified_at: new Date().toISOString(),
        identified_via: args.via,
        crm_person_id: args.personId,
        [LEGACY_PERSON_COL]: args.personId,
        ...(args.email ? { identified_email: args.email.toLowerCase() } : {}),
      })
      .eq('session_id', args.sessionId)
      .is('crm_person_id', null)
      .select('session_id')
    sessionStamped = !error && Array.isArray(data) && data.length > 0
  } catch {
    /* never block tracking on an identity write */
  }
  if (args.stitchBrowser === false) return { sessionStamped }
  await stitchBrowserToPerson({
    rrVid: args.rrVid ?? null,
    personId: args.personId,
    sessionId: args.sessionId,
    source: args.via,
  })
  return { sessionStamped }
}

/**
 * Clear a PROVISIONAL automation flag (lib/analytics/automation.ts
 * PROVISIONAL_AUTOMATION_REASONS) once the session shows it is a person: a
 * second event, or a known browser identified at birth. Matches only rows
 * carrying a provisional reason, so a UA-based flag is never cleared; on every
 * other session it is a primary-key update that matches nothing. No-op (and
 * stops trying) before migration 20260923120000 is applied.
 */
export async function clearProvisionalAutomation(
  sb: SupabaseClient,
  sessionId: string,
  reasons: Iterable<string>,
): Promise<void> {
  const list = [...reasons]
  if (optionalColumnsMissing || list.length === 0) return
  try {
    const { error } = await sb
      .from('visitor_sessions')
      .update({ is_automated: false, automation_reason: null })
      .eq('session_id', sessionId)
      .in('automation_reason', list)
    if (error && isMissingColumnError(error)) optionalColumnsMissing = true
  } catch {
    /* best effort: a flag left on only drops one session from the counts */
  }
}

/** The person an rr_vid is already mapped to (visitor_identity_map), plus any email. */
export async function readIdentityMapForVid(
  sb: SupabaseClient,
  rrVid: string,
): Promise<{ personId: number | null; email: string | null } | null> {
  try {
    const { data } = await sb
      .from('visitor_identity_map')
      .select(`crm_person_id, ${LEGACY_PERSON_COL}, email`)
      .eq('rr_vid', rrVid)
      .maybeSingle()
    if (!data) return null
    const row = data as Record<string, unknown>
    const pid = Number(row.crm_person_id ?? row[LEGACY_PERSON_COL] ?? 0)
    return { personId: pid > 0 ? pid : null, email: row.email ? String(row.email).toLowerCase() : null }
  } catch {
    return null
  }
}

/** Email-only carryover (identity map knows the email but not a person yet). */
export async function stampSessionEmailOnly(sb: SupabaseClient, sessionId: string, email: string): Promise<void> {
  try {
    await sb
      .from('visitor_sessions')
      .update({ identified_at: new Date().toISOString(), identified_via: 'rr_vid_carryover', identified_email: email })
      .eq('session_id', sessionId)
      .is('identified_at', null)
  } catch {
    /* best effort */
  }
}
