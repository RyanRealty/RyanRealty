/**
 * Anonymous-to-known visitor stitching.
 *
 * When a visitor identifies (via Google One-Tap, Facebook Login, or any
 * other auth path), this module:
 *   1. Marks their visitor_sessions row as identified, attaching the
 *      resolved CRM person id (crm_person_id, fub_person_id kept in
 *      lockstep for legacy readers) and email.
 *   2. Upserts the durable rr_vid → person link in visitor_identity_map.
 *   3. Marks the session's prior visitor_events as processed
 *      (pushed_to_fub_at cursor column, kept for idempotency) and stamps
 *      the events_backfilled_* summary on the session.
 *
 * The old FUB event replay + summary note (trackListingView / trackPageView /
 * addPersonNote per event) was a dead no-op after the 2026-06-24 FUB
 * decommission and was deleted — the first-party visitor_events rows ARE the
 * per-person browsing history the CRM and dashboards read.
 *
 * Called by:
 *   - /api/fub/identify (One-Tap / FB Login from WordPress)
 *   - /app/auth/callback (Supabase OAuth from Vercel)
 *   - any future identify path (email link, manual admin tag)
 *
 * Idempotent. Re-running for the same session_id is a no-op for already-
 * processed events.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

type IdentifiedVia = 'google' | 'facebook' | 'email_click_fuid' | 'email_click_pid' | 'form_submit' | 'magic_link'

export type BackfillResult = {
  ok: boolean
  sessionFound: boolean
  alreadyIdentified: boolean
  eventsBackfilled: number
  errors: string[]
}

function getServiceSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url?.trim() || !key?.trim()) return null
  return createClient(url, key)
}

/**
 * Upsert the anon->known link in visitor_identity_map: rr_vid (the durable
 * first-party cookie set by middleware) -> the known FUB person / email / auth
 * user. The single stitch reused by EVERY identify path — the WordPress One-Tap
 * bridge (backfillSessionToFub, below) AND the Vercel Supabase OAuth callback
 * (app/auth/callback) — so a Google/Facebook login feeds the Phase-5 identity
 * graph just like a form submit does. email / fub / crm_person_id / user_id
 * are set when-present so a re-identify never clobbers a previously-captured
 * value. crm_person_id is written in lockstep with fub_person_id (same native
 * id) — that is the column the packet §1b stitch rate counts.
 * Service-role write; never throws (must not block sign-in or tracking).
 */
/**
 * Pure identity-map upsert payload. The packet counts
 * visitor_identity_map.crm_person_id — fub_person_id is the legacy lockstep
 * column (same native crm_people.id post-cutover). A stitch that writes only
 * fub_person_id is invisible to §1b.
 */
export function buildIdentityMapPatch(params: {
  rrVid: string
  fubPersonId?: number | null
  email?: string | null
  userId?: string | null
  sessionId?: string | null
  source: string
  identifiedAt?: string
}): Record<string, unknown> {
  const row: Record<string, unknown> = {
    rr_vid: params.rrVid,
    identify_source: params.source,
    identified_at: params.identifiedAt ?? new Date().toISOString(),
  }
  if (params.fubPersonId != null) {
    row.fub_person_id = params.fubPersonId
    row.crm_person_id = params.fubPersonId
  }
  if (params.email) row.email = params.email.toLowerCase()
  if (params.userId) row.user_id = params.userId
  if (params.sessionId) row.session_id = params.sessionId
  return row
}

export async function stitchVisitorIdentity(params: {
  rrVid: string | null | undefined
  fubPersonId?: number | null
  email?: string | null
  userId?: string | null
  sessionId?: string | null
  source: string
}): Promise<void> {
  if (!params.rrVid) return
  const supabase = getServiceSupabase()
  if (!supabase) return
  const row = buildIdentityMapPatch({
    rrVid: params.rrVid,
    fubPersonId: params.fubPersonId,
    email: params.email,
    userId: params.userId,
    sessionId: params.sessionId,
    source: params.source,
  })
  try {
    await supabase.from('visitor_identity_map').upsert(row, { onConflict: 'rr_vid' })
  } catch {
    /* never block the caller (sign-in / tracking) on a graph write */
  }

  // Alerts plane: a known person + email must stamp listing_alerts.crm_person_id
  // so open/click attribution and the packet §1b alert stitch count stay on
  // the same person the identity map just wrote.
  if (params.email && params.fubPersonId != null) {
    try {
      const { stampListingAlertsCrmPerson } = await import('@/lib/data/leads/listingAlerts')
      await stampListingAlertsCrmPerson(params.email, params.fubPersonId)
    } catch {
      /* never block sign-in / capture on an alert stamp */
    }
  }

  // Flip this browser's anonymous sessions to identified (not anonymous). The
  // OAuth callback has the durable rr_vid cookie but NOT the client-side
  // session_id (localStorage), so stitch the session(s) by rr_vid here — this is
  // what turns a signed-in (Google / email / form) visitor's session from
  // anonymous to known in visitor_sessions + the /admin/visitors view. Only
  // fills a NULL identified_at so a re-identify keeps the original timestamp.
  if (params.fubPersonId != null || params.email) {
    const sessionPatch: Record<string, unknown> = {
      identified_at: new Date().toISOString(),
      identified_via: params.source,
    }
    // Post-FUB-cutover (2026-06-24) the id resolved by every identify path IS
    // the native crm_people.id. Write it to crm_person_id — the column the
    // visitors dashboard now keys on. fub_person_id is kept in lockstep for
    // legacy readers until they migrate.
    if (params.fubPersonId != null) {
      sessionPatch.fub_person_id = params.fubPersonId
      sessionPatch.crm_person_id = params.fubPersonId
    }
    if (params.email) sessionPatch.identified_email = params.email.toLowerCase()
    try {
      await supabase
        .from('visitor_sessions')
        .update(sessionPatch)
        .eq('rr_vid', params.rrVid)
        .is('identified_at', null)
    } catch {
      /* never block sign-in on a session-stitch write */
    }
  }
}

type EventRow = {
  id: number
}

type SessionRow = {
  session_id: string
  rr_vid: string | null
  identified_at: string | null
}

/**
 * Mark a session as identified and stitch it to the resolved CRM person.
 *
 * Pre-conditions:
 *   - sessionId is a valid uuid v4 the client passed in
 *   - fubPersonId is the result of a successful identify (already
 *     trust-verified; the native crm_people.id post-FUB-cutover)
 *
 * Post-conditions:
 *   - visitor_sessions row has identified_at, crm_person_id (+ fub_person_id
 *     in lockstep), identified_email, identified_via,
 *     events_backfilled_at, events_backfilled_count set
 *   - all unprocessed visitor_events for the session have pushed_to_fub_at
 *     set (idempotency cursor; no FUB push happens — FUB is decommissioned)
 *
 * Never throws. Returns a structured result; caller decides how to surface.
 */
export async function backfillSessionToFub(params: {
  sessionId: string
  fubPersonId: number
  /** Optional. Form paths always have it; the email-click bridge knows only
   *  the FUB id, so it stitches without an email (the id is the join key). */
  email?: string
  identifiedVia: IdentifiedVia
}): Promise<BackfillResult> {
  const supabase = getServiceSupabase()
  if (!supabase) {
    return {
      ok: false,
      sessionFound: false,
      alreadyIdentified: false,
      eventsBackfilled: 0,
      errors: ['SUPABASE_SERVICE_ROLE_KEY not configured'],
    }
  }

  const errors: string[] = []

  // ─── 1. Mark the session as identified (idempotent) ────────────────────────
  // We use a conditional UPDATE: only set the identified_* fields if they are
  // currently NULL. That way a second identify call (e.g. user re-signs-in
  // with a different provider in the same browser) does NOT overwrite the
  // original identification timestamp, which would mess up downstream timing
  // reports.
  const { data: sessionRows, error: readErr } = await supabase
    .from('visitor_sessions')
    .select('session_id, rr_vid, identified_at')
    .eq('session_id', params.sessionId)
    .limit(1)

  if (readErr) {
    errors.push(`session read failed: ${readErr.message}`)
    return { ok: false, sessionFound: false, alreadyIdentified: false, eventsBackfilled: 0, errors }
  }

  const session = (sessionRows?.[0] ?? null) as SessionRow | null
  if (!session) {
    // Session may genuinely not exist if the user identified before the
    // snippet ever POSTed a tracking event (e.g. they clicked sign-in
    // immediately on landing). Not a failure — just no events to backfill.
    return {
      ok: true,
      sessionFound: false,
      alreadyIdentified: false,
      eventsBackfilled: 0,
      errors: [],
    }
  }

  const alreadyIdentified = !!session.identified_at

  if (!alreadyIdentified) {
    const { error: updateErr } = await supabase
      .from('visitor_sessions')
      .update({
        identified_at: new Date().toISOString(),
        // Native crm_people.id post-FUB-cutover; kept in both columns so the
        // visitors dashboard (crm_person_id) and legacy readers agree.
        fub_person_id: params.fubPersonId,
        crm_person_id: params.fubPersonId,
        identified_email: params.email?.toLowerCase() ?? null,
        identified_via: params.identifiedVia,
      })
      .eq('session_id', params.sessionId)
      .is('identified_at', null)
    if (updateErr) errors.push(`session update failed: ${updateErr.message}`)
  }

  // ─── 1b. Stitch the durable first-party visitor id into the identity graph ──
  // rr_vid (the middleware-set first-party cookie) is the anchor of the
  // anon->known graph. Recording it here means EVERY identify path — form
  // submit, Google/Facebook OAuth, the email-click bridge — writes one row per
  // visitor in visitor_identity_map, enriched the moment they become known.
  // Upsert on rr_vid; the email/fub fields are only set when present so a
  // re-identify (e.g. the email-click bridge, which has no email) never clobbers
  // a previously-captured email. Service-role write; never blocks the response.
  await stitchVisitorIdentity({
    rrVid: session.rr_vid,
    fubPersonId: params.fubPersonId,
    email: params.email,
    sessionId: params.sessionId,
    source: params.identifiedVia,
  })

  // ─── 2. Fetch all unprocessed events ───────────────────────────────────────
  const { data: eventsRaw, error: eventsErr } = await supabase
    .from('visitor_events')
    .select('id')
    .eq('session_id', params.sessionId)
    .is('pushed_to_fub_at', null)
    .order('event_at', { ascending: true })

  if (eventsErr) {
    errors.push(`events read failed: ${eventsErr.message}`)
    return { ok: false, sessionFound: true, alreadyIdentified, eventsBackfilled: 0, errors }
  }

  const events = (eventsRaw ?? []) as EventRow[]
  if (events.length === 0) {
    return { ok: true, sessionFound: true, alreadyIdentified, eventsBackfilled: 0, errors }
  }

  // ─── 3. Mark the events as processed ───────────────────────────────────────
  // The old per-event FUB replay was a dead no-op after the 2026-06-24
  // decommission and was deleted — the visitor_events rows themselves are the
  // person's browsing history now that the session carries crm_person_id.
  // Every event is stamped so re-runs stay idempotent (same cursor semantics
  // the replay used).
  const successfullyPushed: number[] = events.map((ev) => ev.id)

  // ─── 4. Mark processed events ──────────────────────────────────────────────
  if (successfullyPushed.length > 0) {
    const { error: markErr } = await supabase
      .from('visitor_events')
      .update({ pushed_to_fub_at: new Date().toISOString() })
      .in('id', successfullyPushed)
    if (markErr) errors.push(`mark pushed failed: ${markErr.message}`)
  }

  // ─── 5. Update session backfill summary ────────────────────────────────────
  if (successfullyPushed.length > 0) {
    const { error: summaryErr } = await supabase
      .from('visitor_sessions')
      .update({
        events_backfilled_at: new Date().toISOString(),
        events_backfilled_count: successfullyPushed.length,
      })
      .eq('session_id', params.sessionId)
    if (summaryErr) errors.push(`summary update failed: ${summaryErr.message}`)
  }

  // (The old step 6 — a chronological FUB summary note via addPersonNote — was
  // a dead no-op after the decommission and was deleted. The events themselves,
  // now joined to the person through the identified session, carry the
  // chronology.)

  return {
    ok: errors.length === 0,
    sessionFound: true,
    alreadyIdentified,
    eventsBackfilled: successfullyPushed.length,
    errors,
  }
}

const FORM_SUBMIT_SESSION_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Form-submit identify using the native crm_people id. Callers must not
 * spell the historical fubPersonId key — this wrapper is the TRACK3 seam
 * so new capture doors do not grow the identifier surface.
 */
export async function stitchFormSubmitIdentity(params: {
  personId: number
  email: string
  rrVid: string | null
  sessionId?: string | null
}): Promise<void> {
  const sessionId =
    params.sessionId && FORM_SUBMIT_SESSION_RE.test(params.sessionId) ? params.sessionId : null
  if (sessionId) {
    await backfillSessionToFub({
      sessionId,
      fubPersonId: params.personId,
      email: params.email,
      identifiedVia: 'form_submit',
    })
  }
  await stitchVisitorIdentity({
    rrVid: params.rrVid,
    fubPersonId: params.personId,
    email: params.email,
    sessionId,
    source: 'form_submit',
  })
}
