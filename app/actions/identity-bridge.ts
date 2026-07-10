'use server'

/**
 * Identity bridge — ties an anonymous browser session to a known crm_people
 * record once identified (an old email-click link carrying a legacy person
 * id, or a fresh sign-in), so prior anonymous browsing history attributes
 * correctly and future events on this browser resolve to the right person.
 *
 * Renamed from fub-identity-bridge.ts 2026-07-09 (FUB decommissioned
 * 2026-06-24). Fixed a real bug found in the rename: identifyAuthenticatedSession
 * called the old findPersonByEmail(), which hits FollowUpBoss's API and has
 * unconditionally returned null since the decommission (getFubApiKey() always
 * returns undefined) — every sign-in silently skipped setting the identity
 * cookie and backfilling anonymous history, with no error surfaced. Replaced
 * with the native personIdsByEmailCi() lookup used everywhere else in the CRM.
 *
 * visitor_sessions.fub_person_id / visitor_identity_map.fub_person_id are kept
 * as historical column names (Matt directive 2026-07-09) — they now store the
 * native crm_people.id, which reuses the same numeric id space post-cutover.
 */

import { cookies } from 'next/headers'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'
import { backfillSessionToFub, stitchVisitorIdentity } from '@/lib/visitor-backfill'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'
import { getPersonIdByLegacyId } from '@/lib/data/crm/getPersonIdByLegacyId'
import { personExistsById } from '@/lib/data/crm/personExistsById'

const PERSON_ID_COOKIE = 'rr_pid'
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 // 90 days
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Called when a user lands with an old email-click param (e.g. ?_fuid=123,
 * from a pre-cutover FUB campaign email). The number is a legacy FUB person
 * id; resolve it to the native crm_people.id via fub_legacy_id, set a
 * first-party cookie linking this browser to that person, and (when the
 * client also passes its rr_session_id) stitch this browser's prior
 * anonymous browsing history to the now-known person.
 * Run before any other logic (client component on mount).
 */
export async function identifyPersonFromEmailClick(
  legacyPersonId: string,
  sessionId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const raw = String(legacyPersonId).trim()
  const legacyId = parseInt(raw, 10)
  if (!Number.isInteger(legacyId) || legacyId <= 0) return { ok: false, error: 'Invalid person id' }

  const id = await getPersonIdByLegacyId(legacyId)
  if (!id) return { ok: false, error: 'No matching person found for legacy id' }

  return bridgeIdentifiedPerson(id, sessionId, 'email_click_fuid')
}

/**
 * The native-id counterpart — called when a user lands with ?_pid=<crm_people.id>
 * (stamped by attributeSiteLinks on every post-cutover outbound email). Contacts
 * created after the FUB decommission have no fub_legacy_id, so without this path
 * their email clicks would track opens/clicks but never stitch the web session.
 * The id is validated against crm_people (exists + not deleted) before anything
 * is cookied — same trust model as the legacy param (possession of the emailed
 * link IS the identification).
 */
export async function identifyPersonFromEmailClickNative(
  personId: string,
  sessionId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const id = parseInt(String(personId).trim(), 10)
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Invalid person id' }
  if (!(await personExistsById(id))) return { ok: false, error: 'No matching person found' }
  return bridgeIdentifiedPerson(id, sessionId, 'email_click_pid')
}

/** Shared tail of both email-click identify paths: cookie + GA4 + session backfill. */
async function bridgeIdentifiedPerson(
  id: number,
  sessionId: string | undefined,
  via: 'email_click_fuid' | 'email_click_pid',
): Promise<{ ok: boolean; error?: string }> {
  const cookieStore = await cookies()
  cookieStore.set(PERSON_ID_COOKIE, String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  // GA4 Measurement Protocol — record that this browser was just bridged to
  // a known person. Helps count email-click identifications in the analytics
  // funnel and ties future events on this browser to a known id.
  const ga4ClientId = readGa4ClientIdFromCookies(cookieStore) ?? undefined
  void fireGa4Event({
    eventName: 'person_identified',
    clientId: ga4ClientId,
    eventParams: {
      person_id: id,
      source: 'email-click',
    },
  }).catch((e) => console.warn('[identity-bridge] GA4 event failed:', e))

  // Stitch this browser's prior anonymous browsing history to the person.
  // The email click is high-confidence identity (the link carried their id),
  // so replaying their anonymous session is exactly the "put a name to the
  // number" moment. No email here, the resolved id is the join key. Non-blocking.
  if (sessionId && UUID_V4_RE.test(sessionId)) {
    void backfillSessionToFub({
      sessionId,
      fubPersonId: id,
      identifiedVia: via,
    }).catch((e) => console.warn('[identity-bridge] session backfill failed (non-blocking):', e))
  }

  return { ok: true }
}

/**
 * Bridge a SIGNED-IN visitor's session to their known identity — the "Continue
 * with Google" / email-link / password counterpart to identifyPersonFromEmailClick.
 *
 * The OAuth callback runs server-side and never sees the client's rr_session_id
 * (localStorage), so it cannot replay the browsing history. This action runs from
 * the client AFTER sign-in, carrying that session_id, and:
 *   1. Resolves the user SERVER-SIDE from the Supabase session (never trusts a
 *      client-passed email) and looks up their crm_people record by email.
 *   2. Stamps the identity cookie so every FUTURE event on this browser attributes
 *      to the person (forward attribution).
 *   3. Replays this browser's prior anonymous browsing history and marks the
 *      visitor session identified (backfillSessionToFub), matching identity to
 *      the activity they already did while anonymous.
 *   4. Also stitches by rr_vid so sessions without a client session_id are caught.
 *
 * Idempotent (backfillSessionToFub dedupes on pushed_to_fub_at; the cookie
 * short-circuits re-bridging). Never throws, must not break a page load.
 */
export async function identifyAuthenticatedSession(
  sessionId?: string,
): Promise<{ ok: boolean; bridged: boolean }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email?.trim().toLowerCase()
    if (!email) return { ok: true, bridged: false } // anonymous — nothing to bridge

    const sb = createServiceClient()
    const matchIds = await personIdsByEmailCi(sb, email).catch(() => [] as number[])
    const personId = matchIds[0] ?? null
    const provider = (user?.app_metadata?.provider as string | undefined) ?? ''
    const via = provider === 'google' ? 'google' : provider === 'facebook' ? 'facebook' : 'magic_link'
    const rrVid = (await cookies()).get('rr_vid')?.value ?? null

    if (personId) {
      const cookieStore = await cookies()
      cookieStore.set(PERSON_ID_COOKIE, String(personId), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      })
      if (sessionId && UUID_V4_RE.test(sessionId)) {
        await backfillSessionToFub({ sessionId, fubPersonId: personId, email, identifiedVia: via })
      }
      // rr_vid catches this browser's other sessions (no client session_id).
      await stitchVisitorIdentity({ rrVid, fubPersonId: personId, email, userId: user.id, sessionId: sessionId ?? null, source: 'auth_session' })
      return { ok: true, bridged: true }
    }

    // Known email but not yet a CRM contact: still record the identity graph
    // and mark the session identified by rr_vid so it is not anonymous.
    await stitchVisitorIdentity({ rrVid, email, userId: user.id, sessionId: sessionId ?? null, source: 'auth_session' })
    return { ok: true, bridged: false }
  } catch {
    return { ok: false, bridged: false }
  }
}

/**
 * Read the crm_people.id from the first-party cookie (set by the identity
 * bridge). Use when sending events for anonymous-but-identified visitors.
 */
export async function getPersonIdFromCookie(): Promise<number | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(PERSON_ID_COOKIE)?.value?.trim()
  if (!value) return null
  const id = parseInt(value, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}
