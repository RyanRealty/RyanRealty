'use server'

/**
 * Identity bridge — ties an anonymous browser session to a known crm_people
 * record once identified (an old email-click link carrying a legacy person
 * id, or a fresh sign-in), so prior anonymous browsing history attributes
 * correctly and future events on this browser resolve to the right person.
 *
 * identifyAuthenticatedSession uses the native personIdsByEmailCi() lookup.
 *
 * visitor_sessions.fub_person_id / visitor_identity_map.fub_person_id are kept
 * as historical column names (Matt directive 2026-07-09) — they now store the
 * native crm_people.id, which reuses the same numeric id space post-cutover.
 */

import { cookies, headers } from 'next/headers'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'
import {
  backfillSessionToFub,
  isAutomatedSession,
  stitchVisitorIdentity,
  type IdentifiedVia,
} from '@/lib/visitor-backfill'
import { identifiedViaForChannel, verifyPersonLinkToken } from '@/lib/identity/link-token'
import {
  PERSON_COOKIE,
  personCookieOptions,
  personCookieValue,
  readPersonCookie,
} from '@/lib/identity/person-cookie'
import { CONSENT_COOKIE, identificationAllowed } from '@/lib/identity/consent'
import { classifyAutomation } from '@/lib/analytics/automation'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import { personIdsByEmailCi } from '@/lib/data/crm/personByEmailCi'
import { personExistsById } from '@/lib/data/crm/personExistsById'

const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * What the browser itself reports about the request. `webdriver` is
 * navigator.webdriver: a scripted browser with an ordinary user agent, which no
 * request header shows. The identify calls run at page load, before the tracker
 * has created a session the action could ask about, so the browser says it here.
 */
export type IdentifySignals = { webdriver?: boolean }

/**
 * Legacy `?_fuid=<vendor CRM id>` links. RETIRED 2026-09-23 (P7 identity loop):
 * an unsigned id identifies nobody, because anyone could type any number and be
 * recorded as that contact. Every email link already in an inbox goes through
 * /api/track/e/click, whose HMAC-verified token names the recipient, and that
 * redirect now re-signs the destination; so a real recipient still arrives
 * identified. Kept exported so existing callers compile and get a clear refusal.
 */
export async function identifyPersonFromEmailClick(
  legacyPersonId: string,
  sessionId?: string,
): Promise<{ ok: boolean; error?: string }> {
  void legacyPersonId
  void sessionId
  return { ok: false, error: 'Unsigned identity links no longer identify a visitor' }
}

/**
 * The `?_pid=<signed token>` path (lib/identity/link-token.ts). The token is
 * minted by the one decoration helper (lib/identity/outbound-links.ts) on every
 * link we send to a known contact, so possession of the link IS the
 * identification, and a forged or bare id is refused. The id is re-checked
 * against crm_people (exists + not deleted) before anything is cookied.
 *
 * The same token is resolved server-side by /api/visitors/track on the landing
 * page view (the primary path, race-free); this action is the belt-and-braces
 * second path for surfaces whose tracker post may not carry the URL.
 */
export async function identifyPersonFromEmailClickNative(
  personToken: string,
  sessionId?: string,
  signals?: IdentifySignals,
): Promise<{ ok: boolean; error?: string }> {
  const verified = verifyPersonLinkToken(String(personToken ?? '').trim())
  if (!verified) return { ok: false, error: 'Invalid or unsigned identity token' }
  if (!(await personExistsById(verified.personId))) return { ok: false, error: 'No matching person found' }
  return bridgeIdentifiedPerson(verified.personId, sessionId, identifiedViaForChannel(verified.channel), signals)
}

/**
 * May this request identify anyone? Not automation: an email security scanner,
 * link previewer or crawler that opens a tracked link must not read as the
 * contact browsing (docs/TRACKING_POLICY.md, identity loop rule 5), so a request
 * whose user agent, or whose browser's own navigator.webdriver (`signals`),
 * lib/analytics/automation.ts classifies as automated identifies nobody,
 * whatever token it carries. Not a cookie-banner decline or a Global Privacy
 * Control signal either: those mean we record nothing. Every other tier,
 * including no answer at all, allows first-party identification of a person who
 * clicked our own link or signed in (disclosed in app/privacy).
 */
async function identificationRefusal(signals?: IdentifySignals): Promise<'automated' | 'declined' | null> {
  const [cookieStore, hdrs] = await Promise.all([cookies(), headers()])
  if (classifyAutomation({ userAgent: hdrs.get('user-agent'), webdriver: signals?.webdriver === true }).automated) return 'automated'
  const allowed = identificationAllowed({
    consentCookie: cookieStore.get(CONSENT_COOKIE)?.value ?? null,
    secGpc: hdrs.get('sec-gpc'),
  })
  return allowed ? null : 'declined'
}

/**
 * Shared tail of the email-click identify path: session backfill, then cookie +
 * GA4 + browser stitch.
 *
 * The backfill runs FIRST, and a session it reports as automation ends the
 * identification before anything else is written. The request's user agent
 * (identificationRefusal) catches a scanner that declares itself; a scripted
 * browser with an ordinary user agent reports navigator.webdriver, in the body of
 * its tracker post (the session row the track route flagged shows it) and in
 * `signals` on this call, which is all there is when the call comes before any
 * session exists (PersonIdentityBridge runs at mount, before VisitTracker posts).
 * Cookying that browser as the contact, tagging GA4, or mapping its rr_vid to the
 * contact would make it "the contact browsing" (docs/TRACKING_POLICY.md, identity
 * loop rule 5).
 */
async function bridgeIdentifiedPerson(
  id: number,
  sessionId: string | undefined,
  via: IdentifiedVia,
  signals?: IdentifySignals,
): Promise<{ ok: boolean; error?: string }> {
  const refusal = await identificationRefusal(signals)
  if (refusal) return { ok: false, error: refusal === 'automated' ? 'Automated request' : 'Tracking declined' }
  const cookieStore = await cookies()
  const validSessionId = sessionId && UUID_V4_RE.test(sessionId) ? sessionId : null

  // Stitch this browser's browsing history to the person. The email click is
  // high-confidence identity (the link carried their id), so replaying their
  // session is exactly the "put a name to the number" moment. No email here,
  // the resolved id is the join key.
  //
  // Awaited (not void): in a serverless action a fire-and-forget promise can
  // be frozen with the lambda and never complete. And the landing page fires
  // the session-creating tracker POST and this identify concurrently on mount,
  // so when the session row does not exist yet we wait one beat and retry —
  // otherwise the very session the click created never stitches.
  if (validSessionId) {
    try {
      let result = await backfillSessionToFub({ sessionId: validSessionId, fubPersonId: id, identifiedVia: via })
      if (!result.sessionFound) {
        await new Promise((r) => setTimeout(r, 2500))
        result = await backfillSessionToFub({ sessionId: validSessionId, fubPersonId: id, identifiedVia: via })
      }
      if (result.automated) return { ok: false, error: 'Automated request' }
    } catch (e) {
      console.warn('[identity-bridge] session backfill failed (non-blocking):', e)
    }
  }

  cookieStore.set(PERSON_COOKIE, personCookieValue(id), personCookieOptions())

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

  // rr_vid stitch even when the client omitted session_id — otherwise an
  // email-click identify never writes visitor_identity_map.crm_person_id.
  const rrVid = cookieStore.get('rr_vid')?.value ?? null
  await stitchVisitorIdentity({
    rrVid,
    fubPersonId: id,
    sessionId: validSessionId,
    source: via,
  })

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
 *   2. Replays this browser's prior anonymous browsing history and marks the
 *      visitor session identified (backfillSessionToFub), matching identity to
 *      the activity they already did while anonymous. A session the track route
 *      flagged as automation ends it here: nothing below is written for it.
 *   3. Stamps the identity cookie so every FUTURE event on this browser attributes
 *      to the person (forward attribution).
 *   4. Also stitches by rr_vid so sessions without a client session_id are caught.
 *
 * Idempotent (backfillSessionToFub dedupes on pushed_to_fub_at; the cookie
 * short-circuits re-bridging). Never throws, must not break a page load.
 */
export async function identifyAuthenticatedSession(
  sessionId?: string,
  signals?: IdentifySignals,
): Promise<{ ok: boolean; bridged: boolean }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email?.trim().toLowerCase()
    if (!email || !user) return { ok: true, bridged: false } // anonymous — nothing to bridge
    if (await identificationRefusal(signals)) return { ok: true, bridged: false }

    const sb = createServiceClient()
    const matchIds = await personIdsByEmailCi(sb, email).catch(() => [] as number[])
    const personId = matchIds[0] ?? null
    const provider = (user?.app_metadata?.provider as string | undefined) ?? ''
    const via = provider === 'google' ? 'google' : provider === 'facebook' ? 'facebook' : 'magic_link'
    const rrVid = (await cookies()).get('rr_vid')?.value ?? null
    const validSessionId = sessionId && UUID_V4_RE.test(sessionId) ? sessionId : null

    if (personId) {
      // Backfill first: a session flagged as automation (see bridgeIdentifiedPerson)
      // is not identified, cookied or stitched, whoever signed in on it.
      if (validSessionId) {
        const backfill = await backfillSessionToFub({ sessionId: validSessionId, fubPersonId: personId, email, identifiedVia: via })
        if (backfill.automated) return { ok: true, bridged: false }
      }
      const cookieStore = await cookies()
      cookieStore.set(PERSON_COOKIE, personCookieValue(personId), personCookieOptions())
      // rr_vid catches this browser's other sessions (no client session_id).
      await stitchVisitorIdentity({ rrVid, fubPersonId: personId, email, userId: user.id, sessionId: sessionId ?? null, source: 'auth_session' })
      return { ok: true, bridged: true }
    }

    // Known email but not yet a CRM contact: still record the identity graph
    // and mark the session identified by rr_vid so it is not anonymous. Not for
    // a session flagged as automation.
    if (validSessionId && (await isAutomatedSession(validSessionId))) return { ok: true, bridged: false }
    await stitchVisitorIdentity({ rrVid, email, userId: user.id, sessionId: sessionId ?? null, source: 'auth_session' })
    return { ok: true, bridged: false }
  } catch {
    return { ok: false, bridged: false }
  }
}

/**
 * Read the crm_people.id from the first-party cookie (set by the identity
 * bridge). Use when sending events for anonymous-but-identified visitors.
 *
 * Accepts the signed value (2026-09-23 on) and, until the 90-day legacy
 * cookies age out, a bare id: callers use it only as a fallback guess when a
 * form carries no email (lib/crm/submitted-identity.ts). Access decisions read
 * signedPersonIdFromCookie (lib/identity/person-cookie.ts) instead.
 */
export async function getPersonIdFromCookie(): Promise<number | null> {
  const cookieStore = await cookies()
  return readPersonCookie(cookieStore.get(PERSON_COOKIE)?.value)?.personId ?? null
}
