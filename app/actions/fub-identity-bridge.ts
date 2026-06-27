'use server'

import { cookies } from 'next/headers'
import { sendEvent, findPersonByEmail } from '@/lib/followupboss'
import { fireGa4Event, readGa4ClientIdFromCookies } from '@/lib/ga4-measurement-protocol'
import { backfillSessionToFub, stitchVisitorIdentity } from '@/lib/visitor-backfill'
import { createClient } from '@/lib/supabase/server'

const FUB_CID_COOKIE = 'fub_cid'
const COOKIE_MAX_AGE = 90 * 24 * 60 * 60 // 90 days
const UUID_V4_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * Called when user lands with FUB email-click param (e.g. ?_fuid=123).
 * Sets first-party cookie linking this browser to the FUB contact; sends "Visited Website" so FUB merges the session.
 * When the client also passes its rr_session_id, we stitch this browser's
 * prior anonymous browsing history to the now-known FUB person.
 * Run before any other logic (client component on mount).
 */
export async function identifyFubFromEmailClick(
  fubPersonId: string,
  sessionId?: string,
): Promise<{ ok: boolean; error?: string }> {
  const raw = String(fubPersonId).trim()
  const id = parseInt(raw, 10)
  if (!Number.isInteger(id) || id <= 0) return { ok: false, error: 'Invalid FUB person id' }

  const source = (process.env.NEXT_PUBLIC_SITE_URL ?? '')
    .replace(/^https?:\/\//, '')
    .replace(/\/$/, '')
    .toLowerCase() || 'ryan-realty.com'

  const res = await sendEvent({
    type: 'Visited Website',
    person: { id },
    source,
    system: 'Ryan Realty Website',
    sourceUrl: undefined,
  })
  if (!res.ok) return { ok: false, error: res.error ?? 'FUB event failed' }

  const cookieStore = await cookies()
  cookieStore.set(FUB_CID_COOKIE, String(id), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })

  // GA4 Measurement Protocol — record that this browser was just bridged
  // to a FUB person id. Helps us count email-click identifications in the
  // analytics funnel and ties future events on this browser to a known FUB id.
  const ga4ClientId = readGa4ClientIdFromCookies(cookieStore) ?? undefined
  void fireGa4Event({
    eventName: 'fub_person_created',
    clientId: ga4ClientId,
    eventParams: {
      fub_person_id: id,
      source: 'email-click',
    },
  }).catch((e) => console.warn('[fub-bridge] GA4 event failed:', e))

  // Stitch this browser's prior anonymous browsing history to the FUB person.
  // The email click is high-confidence identity (the link carried their id),
  // so replaying their anonymous session is exactly the "put a name to the
  // number" moment. No email here — the FUB id is the join key. Non-blocking.
  if (sessionId && UUID_V4_RE.test(sessionId)) {
    void backfillSessionToFub({
      sessionId,
      fubPersonId: id,
      identifiedVia: 'email_click_fuid',
    }).catch((e) => console.warn('[fub-bridge] session backfill failed (non-blocking):', e))
  }

  return { ok: true }
}

/**
 * Bridge a SIGNED-IN visitor's session to their known identity — the "Continue
 * with Google" / email-link / password counterpart to identifyFubFromEmailClick.
 *
 * The OAuth callback runs server-side and never sees the client's rr_session_id
 * (localStorage), so it cannot replay the browsing history. This action runs from
 * the client AFTER sign-in, carrying that session_id, and:
 *   1. Resolves the user SERVER-SIDE from the Supabase session (never trusts a
 *      client-passed email) and looks up their FUB person by email.
 *   2. Stamps the fub_cid cookie so every FUTURE event on this browser attributes
 *      to the person (forward attribution).
 *   3. Replays this browser's prior anonymous browsing history into FUB and marks
 *      the visitor session identified (backfillSessionToFub) — match identity to
 *      the activity they already did while anonymous.
 *   4. Also stitches by rr_vid so sessions without a client session_id are caught.
 *
 * Idempotent (backfillSessionToFub dedupes on pushed_to_fub_at; the cookie
 * short-circuits re-bridging). Never throws — must not break a page load.
 */
export async function identifyAuthenticatedSession(
  sessionId?: string,
): Promise<{ ok: boolean; bridged: boolean }> {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const email = user?.email?.trim().toLowerCase()
    if (!email) return { ok: true, bridged: false } // anonymous — nothing to bridge

    const person = await findPersonByEmail(email)
    const provider = (user?.app_metadata?.provider as string | undefined) ?? ''
    const via = provider === 'google' ? 'google' : provider === 'facebook' ? 'facebook' : 'magic_link'
    const rrVid = (await cookies()).get('rr_vid')?.value ?? null

    if (person?.id) {
      const cookieStore = await cookies()
      cookieStore.set(FUB_CID_COOKIE, String(person.id), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
      })
      if (sessionId && UUID_V4_RE.test(sessionId)) {
        await backfillSessionToFub({ sessionId, fubPersonId: person.id, email, identifiedVia: via })
      }
      // rr_vid catches this browser's other sessions (no client session_id).
      await stitchVisitorIdentity({ rrVid, fubPersonId: person.id, email, userId: user.id, sessionId: sessionId ?? null, source: 'auth_session' })
      return { ok: true, bridged: true }
    }

    // Known email but not yet a FUB contact: still record the identity graph +
    // mark the session identified by rr_vid so it is not anonymous.
    await stitchVisitorIdentity({ rrVid, email, userId: user.id, sessionId: sessionId ?? null, source: 'auth_session' })
    return { ok: true, bridged: false }
  } catch {
    return { ok: false, bridged: false }
  }
}

/**
 * Read FUB contact id from first-party cookie (set by identity bridge). Use when sending events for anonymous-but-identified visitors.
 */
export async function getFubPersonIdFromCookie(): Promise<number | null> {
  const cookieStore = await cookies()
  const value = cookieStore.get(FUB_CID_COOKIE)?.value?.trim()
  if (!value) return null
  const id = parseInt(value, 10)
  return Number.isInteger(id) && id > 0 ? id : null
}
